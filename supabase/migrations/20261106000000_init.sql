-- Fairway Book: initial schema

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Golfer',
  handicap_index numeric(4,1) not null default 0 check (handicap_index between -10 and 54),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Golfer'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- courses (cached from GolfCourseAPI, or entered manually) ----------
-- tees: [{name, gender, rating, slope, par[], si[], yards[]}]
create table public.courses (
  id bigint generated always as identity primary key,
  external_id bigint unique,
  club_name text not null,
  course_name text,
  location text,
  tees jsonb not null check (jsonb_typeof(tees) = 'array'),
  source text not null default 'manual' check (source in ('manual', 'golfcourseapi')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
create index courses_club_name_idx on public.courses using gin (to_tsvector('simple', club_name || ' ' || coalesce(course_name, '')));

-- ---------- rounds ----------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  course_id bigint references public.courses(id) on delete set null,
  course_name text not null,
  tee jsonb not null,                       -- snapshot, so later course edits don't change old rounds
  format text not null check (format in ('stroke', 'stableford', 'match', 'skins')),
  scoring text not null default 'net' check (scoring in ('net', 'gross')),
  allowance int not null default 100 check (allowance between 0 and 100),
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  status text not null default 'live' check (status in ('live', 'done')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,   -- null = guest
  name text not null,
  handicap_index numeric(4,1) not null default 0,
  position int not null default 0,
  unique (round_id, user_id),
  unique (id, round_id)
);
create index round_players_user_idx on public.round_players (user_id);

create table public.scores (
  round_id uuid not null references public.rounds on delete cascade,
  player_id uuid not null,
  hole int not null check (hole between 1 and 18),
  strokes int check (strokes between 1 and 20),
  putts int check (putts between 0 and 10),
  fairway text check (fairway in ('L', 'H', 'R')),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (player_id, hole),
  foreign key (player_id, round_id) references public.round_players (id, round_id) on delete cascade
);
create index scores_round_idx on public.scores (round_id);

-- 3-2-1 player votes
create table public.votes (
  round_id uuid not null references public.rounds on delete cascade,
  voter_id uuid not null,
  nominee_id uuid not null,
  points int not null check (points in (1, 2, 3)),
  primary key (voter_id, points),
  unique (voter_id, nominee_id),
  check (voter_id <> nominee_id),
  foreign key (voter_id, round_id) references public.round_players (id, round_id) on delete cascade,
  foreign key (nominee_id, round_id) references public.round_players (id, round_id) on delete cascade
);
create index votes_round_idx on public.votes (round_id);

-- ---------- access helpers ----------
create function public.is_round_member(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.round_players where round_id = rid and user_id = auth.uid())
      or exists (select 1 from public.rounds where id = rid and created_by = auth.uid());
$$;

create function public.is_round_owner(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rounds where id = rid and created_by = auth.uid());
$$;

-- You can vote as yourself, or as a guest in a round you created.
create function public.can_act_for(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.round_players rp join public.rounds r on r.id = rp.round_id
    where rp.id = pid and (rp.user_id = auth.uid() or (rp.user_id is null and r.created_by = auth.uid()))
  );
$$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.rounds enable row level security;
alter table public.round_players enable row level security;
alter table public.scores enable row level security;
alter table public.votes enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "courses readable" on public.courses for select to authenticated using (true);
create policy "add manual course" on public.courses for insert to authenticated
  with check (created_by = auth.uid() and external_id is null and source = 'manual');
create policy "edit own manual course" on public.courses for update to authenticated
  using (created_by = auth.uid() and external_id is null) with check (created_by = auth.uid() and external_id is null);
create policy "delete own manual course" on public.courses for delete to authenticated
  using (created_by = auth.uid() and external_id is null);

create policy "members read rounds" on public.rounds for select to authenticated using (public.is_round_member(id));
create policy "create rounds" on public.rounds for insert to authenticated with check (created_by = auth.uid());
create policy "owner updates round" on public.rounds for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "owner deletes round" on public.rounds for delete to authenticated using (created_by = auth.uid());

create policy "members read players" on public.round_players for select to authenticated using (public.is_round_member(round_id));
create policy "owner adds players" on public.round_players for insert to authenticated with check (public.is_round_owner(round_id));
create policy "owner or self edits player" on public.round_players for update to authenticated
  using (public.is_round_owner(round_id) or user_id = auth.uid())
  with check (public.is_round_owner(round_id) or user_id = auth.uid());
create policy "owner removes players" on public.round_players for delete to authenticated using (public.is_round_owner(round_id));

-- Any member can mark anyone's card (one marker per group is common)
create policy "members read scores" on public.scores for select to authenticated using (public.is_round_member(round_id));
create policy "members write scores" on public.scores for insert to authenticated with check (public.is_round_member(round_id));
create policy "members update scores" on public.scores for update to authenticated
  using (public.is_round_member(round_id)) with check (public.is_round_member(round_id));
create policy "members delete scores" on public.scores for delete to authenticated using (public.is_round_member(round_id));

create policy "members read votes" on public.votes for select to authenticated using (public.is_round_member(round_id));
create policy "cast own votes" on public.votes for insert to authenticated with check (public.can_act_for(voter_id));
create policy "change own votes" on public.votes for delete to authenticated using (public.can_act_for(voter_id));

-- ---------- join by code ----------
create function public.peek_round(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'course_name', r.course_name, 'format', r.format,
    'guests', coalesce((select jsonb_agg(jsonb_build_object('id', rp.id, 'name', rp.name) order by rp.position)
                        from public.round_players rp where rp.round_id = r.id and rp.user_id is null), '[]'::jsonb))
  from public.rounds r
  where r.join_code = upper(trim(p_code)) and r.status = 'live' and auth.uid() is not null;
$$;

-- Join a live round; optionally claim a guest slot the organiser already added for you.
create function public.join_round(p_code text, p_claim uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.rounds;
  me public.profiles;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into r from public.rounds where join_code = upper(trim(p_code)) and status = 'live';
  if not found then raise exception 'No live round with that code'; end if;
  if exists (select 1 from public.round_players where round_id = r.id and user_id = auth.uid()) then
    return r.id;
  end if;
  select * into me from public.profiles where id = auth.uid();
  if p_claim is not null then
    update public.round_players set user_id = auth.uid(), handicap_index = me.handicap_index
    where id = p_claim and round_id = r.id and user_id is null;
    if found then return r.id; end if;
  end if;
  if r.format = 'match' and (select count(*) from public.round_players where round_id = r.id) >= 2 then
    raise exception 'This match already has two players';
  end if;
  insert into public.round_players (round_id, user_id, name, handicap_index, position)
  values (r.id, auth.uid(), me.display_name, me.handicap_index,
          (select coalesce(max(position), -1) + 1 from public.round_players where round_id = r.id));
  return r.id;
end $$;

revoke execute on function public.peek_round(text), public.join_round(text, uuid) from public, anon;
grant execute on function public.peek_round(text), public.join_round(text, uuid) to authenticated;

-- ---------- realtime (live leaderboards) ----------
alter publication supabase_realtime add table public.rounds, public.round_players, public.scores, public.votes;
