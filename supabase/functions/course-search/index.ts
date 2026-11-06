// Searches GolfCourseAPI.com server-side (key never ships in the app) and caches results in `courses`.
// Secrets: GOLFCOURSEAPI_KEY (set with `supabase secrets set`). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided.
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.golfcourseapi.com/v1';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type ApiHole = { par?: number; yardage?: number; handicap?: number };
type ApiTee = { tee_name?: string; course_rating?: number; slope_rating?: number; holes?: ApiHole[] };
type ApiCourse = {
  id: number; club_name?: string; course_name?: string;
  location?: { city?: string; state?: string; country?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

function mapTees(c: ApiCourse) {
  const out = [];
  for (const [gender, list] of [['M', c.tees?.male], ['F', c.tees?.female]] as const) {
    for (const t of list ?? []) {
      const holes = t.holes ?? [];
      if (holes.length !== 9 && holes.length !== 18) continue;
      const par = holes.map(h => Number(h.par) || 4);
      out.push({
        name: t.tee_name ?? 'Tee',
        gender,
        rating: Number(t.course_rating) || par.reduce((a, b) => a + b, 0),
        slope: Number(t.slope_rating) || 113,
        par,
        si: holes.map((h, i) => Number(h.handicap) || i + 1),
        yards: holes.map(h => Number(h.yardage) || 0),
      });
    }
  }
  return out;
}

async function api(path: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Key ${Deno.env.get('GOLFCOURSEAPI_KEY')}` } });
  if (!res.ok) throw new Error(`Course API returned ${res.status}`);
  return res.json();
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { q } = await req.json().catch(() => ({ q: '' }));
    const query = String(q ?? '').trim();
    if (query.length < 3) return json({ courses: [] });

    const found: ApiCourse[] = (await api(`/search?search_query=${encodeURIComponent(query)}`)).courses ?? [];
    // Search results normally include tees; fetch details for any that don't (first 10 only).
    const full = await Promise.all(found.slice(0, 10).map(async c =>
      c.tees ? c : ((await api(`/courses/${c.id}`)).course ?? c)));

    const rows = full
      .map(c => ({
        external_id: c.id,
        club_name: c.club_name ?? c.course_name ?? 'Golf course',
        course_name: c.course_name && c.course_name !== c.club_name ? c.course_name : null,
        location: [c.location?.city, c.location?.state, c.location?.country].filter(Boolean).join(', '),
        tees: mapTees(c),
        source: 'golfcourseapi',
        created_by: null,
        updated_at: new Date().toISOString(),
      }))
      .filter(r => r.tees.length);
    if (!rows.length) return json({ courses: [] });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await admin.from('courses').upsert(rows, { onConflict: 'external_id' }).select();
    if (error) throw error;
    return json({ courses: data });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
