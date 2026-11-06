import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  courseHandicap, strokesOn, stablefordPoints, leaderboard, matchStatus, matchHoles, skins,
  handicapEstimate, scoreDifferential, playerStats, voteTotals, voteSlots, playingHandicaps,
} from '../src/lib/golf.ts';
import type { Card, Tee } from '../src/lib/golf.ts';

const tee: Tee = {
  name: 'White', rating: 71.2, slope: 128,
  par: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5],
  si: [7, 3, 15, 11, 1, 9, 17, 5, 13, 8, 16, 2, 12, 6, 4, 18, 10, 14],
  yards: Array(18).fill(0),
};
const card = (format: Card['format'], players: [string, number][], strokes: Record<string, number[]>): Card => ({
  tee, format, scoring: 'net', allowance: 100,
  players: players.map(([id, hi]) => ({ id, name: id, handicapIndex: hi })),
  scores: Object.fromEntries(Object.entries(strokes).map(([id, s]) => [id, s.map(x => ({ strokes: x }))])),
});

test('course handicap (WHS)', () => {
  assert.equal(courseHandicap(10.4, tee), 11); // 10.4*128/113 - 0.8 = 10.98
  assert.equal(courseHandicap(0, tee), -1);
  const nine: Tee = { ...tee, rating: 35.5, slope: 120, par: tee.par.slice(0, 9), si: [4, 2, 8, 6, 1, 5, 9, 3, 7] };
  assert.equal(courseHandicap(18, nine), Math.round(9 * 120 / 113 + (35.5 - 36)));
});

test('strokes received by stroke index', () => {
  assert.equal(strokesOn(20, 1, 18), 2);
  assert.equal(strokesOn(20, 2, 18), 2);
  assert.equal(strokesOn(20, 3, 18), 1);
  assert.equal(strokesOn(18, 18, 18), 1);
  assert.equal(strokesOn(0, 1, 18), 0);
  assert.equal(strokesOn(-2, 17, 18), -1);
  assert.equal(strokesOn(-2, 16, 18), 0);
});

test('stableford points', () => {
  assert.equal(stablefordPoints(4, 0, 4), 2);
  assert.equal(stablefordPoints(4, 1, 4), 3);
  assert.equal(stablefordPoints(4, 0, 7), 0);
  assert.equal(stablefordPoints(5, 0, 3), 4);
  assert.equal(stablefordPoints(4, 0, null), 0);
});

test('stableford leaderboard with ties', () => {
  const c = card('stableford', [['a', 0], ['b', 0], ['c', 0]], {
    a: tee.par.map(p => p), b: tee.par.map(p => p), c: tee.par.map(p => p + 1),
  });
  const lb = leaderboard(c);
  // CH 0 -> PH -1 (gives a stroke on SI 18): 35 pts for par golf
  assert.deepEqual(lb.map(r => [r.playerId, r.points, r.pos]), [['a', 35, 1], ['b', 35, 1], ['c', 17, 3]]);
});

test('match play status, dormie and early finish', () => {
  // equal handicaps, a wins first 10 holes, rest halved
  const a = tee.par.map((p, i) => (i < 10 ? p - 1 : p));
  const c = card('match', [['a', 10], ['b', 10]], { a, b: tee.par });
  assert.deepEqual(playingHandicaps(c), [0, 0]);
  const m = matchStatus(c);
  assert.equal(m.finished, true);
  assert.equal(m.text, 'a wins 10&8');
  // dormie: 3 up with 3 to play
  const c2 = card('match', [['a', 10], ['b', 10]], { a: [3, 3, 2, ...tee.par.slice(3, 15)], b: tee.par.slice(0, 15) });
  assert.equal(matchStatus(c2).text, 'a 3 up thru 15 (dormie)');
});

test('match play hole by hole with handicap strokes', () => {
  // b gets 2 strokes (CH 13 vs 11 -> PH 0 / 2): strokes on SI 1 (hole 5) and SI 2 (hole 12)
  const c = card('match', [['a', 10.4], ['b', 12.2]], {
    a: [4, 4, 3, 5, 4], // pars
    b: [5, 4, 2, 5, 5], // bogey, par, birdie, par, bogey (net par on hole 5)
  });
  assert.deepEqual(playingHandicaps(c), [0, 2]);
  assert.deepEqual(matchHoles(c).map(m => [m.hole, m.winnerId, m.diff]), [
    [0, 'a', 1], [1, null, 1], [2, 'b', 0], [3, null, 0], [4, null, 0],
  ]);
  assert.equal(matchStatus(c).text, 'All square thru 5');
});

test('skins carry over', () => {
  const c = card('skins', [['a', 0], ['b', 0]], { a: [4, 4, 2], b: [4, 4, 3] });
  const s = skins(c);
  assert.equal(s.won.a, 3); // holes 1-2 halved, carry to hole 3
  assert.equal(s.carry, 0);
});

test('handicap estimate table', () => {
  assert.equal(handicapEstimate([10, 12]), null);
  assert.equal(handicapEstimate([10, 12, 14]), 8); // lowest 1, -2
  assert.equal(handicapEstimate([10, 12, 14, 9, 11, 13]), 9.5 - 1); // lowest 2 avg 9.5, -1
});

test('score differential caps at net double bogey', () => {
  const blowup = [...tee.par]; blowup[0] = 12; // 0 index -> CH -1, cap = 4+2+0 = 6
  const c = card('stroke', [['a', 0]], { a: blowup });
  // AGS = 72 + 2 = 74 -> (74-71.2)*113/128 = 2.47
  assert.equal(scoreDifferential(c, 'a'), 2.5);
});

test('player stats: GIR, putts, fairways', () => {
  const c: Card = {
    tee, format: 'stroke', scoring: 'gross', allowance: 100,
    players: [{ id: 'a', name: 'a', handicapIndex: 5 }],
    scores: { a: tee.par.map(p => ({ strokes: p, putts: 2, fairway: p > 3 ? 'H' as const : null })) },
  };
  const s = playerStats([{ card: c, playerId: 'a' }]);
  assert.equal(s.avg18, 72);
  assert.equal(s.puttsPer18, 36);
  assert.equal(s.girPct, 100);
  assert.equal(s.fairwayPct, 100);
  assert.equal(s.mix.par, 18);
});

test('votes', () => {
  assert.deepEqual(voteSlots(2), [3]);
  assert.deepEqual(voteSlots(5), [3, 2, 1]);
  assert.deepEqual(voteTotals([
    { voter_id: 'a', nominee_id: 'b', points: 3 }, { voter_id: 'a', nominee_id: 'c', points: 2 },
    { voter_id: 'b', nominee_id: 'c', points: 3 },
  ]), { b: 3, c: 5 });
});
