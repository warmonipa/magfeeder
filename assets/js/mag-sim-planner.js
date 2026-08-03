// assets/js/mag-sim-planner.js
//
// Reverse planner for the Mag simulator: given a target mag id, enumerate the
// evolution chains (feeder-class/gender/Section-ID + condition, at each
// evolution level) that could have produced it. This is the mirror image of
// mag-sim-engine.js's forward `checkEvolution` — that function walks
// stage0->1->2->3->4 given a live state; this module walks the same rule
// tables BACKWARD from a target mag id, with no state/stats involved (a
// player armed with a chain still has to hit the stat conditions itself; this
// only tells them WHICH feeder/condition combinations are reachable at all).
//
// Pure, DOM-free, data injected via `data` (same convention as
// mag-sim-engine.js), so this is plain Node-importable and testable without a
// browser.

// planMag (below) forward-simulates candidate plans through the REAL engine as
// it builds them, then replays the finished plan a second time to assert the
// terminal state is EXACTLY the target — the engine is the single source of
// truth, so a wrong internal computation can only ever MISS a plan, never emit a
// wrong one.
import { createState, feedOnce, bankMag, feedCycles } from './mag-sim-engine.js';

// Any single representative Section ID from an idGroups bucket (A/B or
// Type1/2/3). Forward code (idGroupAB/idType in mag-sim-engine.js) treats
// every id in a bucket identically, so for "does some feeder satisfy this
// gate" purposes any one of them proves it — which one we quote is cosmetic.
function repId(data, group) {
    const ids = data.idGroups[group];
    return ids && ids.length ? ids[0] : undefined;
}

function feedTableIdOf(data, magId) {
    const m = data.mags[magId];
    return m ? m.feedTableId : undefined;
}

// --- stage0 -> stage1: gated purely on the feeder's class (wiki: "HU evolves
// Mag"). data.evolution.stage1 is a bijection {HU:'Varuna', RA:'Kalki',
// FO:'Vritra'}, so this returns at most one match.
function stage1Predecessors(data, magId) {
    const out = [];
    for (const cls of Object.keys(data.evolution.stage1)) {
        if (data.evolution.stage1[cls] !== magId) continue;
        out.push({
            stage: 1,
            magId,
            feedTableId: feedTableIdOf(data, magId),
            evoLevel: 10,
            feeder: { class: cls },
            condKey: null, // no stat condition at Lv.10 — class alone decides
        });
    }
    return out;
}

// --- stage1 -> stage2: keyed on the mag's OWN lineage + whichever of
// POW/DEX/MIND is strictly max (ties broken by evolution.tieBreak). Per
// mag-sim-engine.js checkEvolution, this branch reads `ev.stage2[state.magId]`
// — the feeder does not gate it at all (feeding only supplies the stats that
// decide the argmax), so `feeder` carries no class/section here.
function stage2Predecessors(data, magId) {
    const out = [];
    for (const stage1Mag of Object.keys(data.evolution.stage2)) {
        const branch = data.evolution.stage2[stage1Mag];
        for (const stat of Object.keys(branch)) {
            if (branch[stat] !== magId) continue;
            out.push({
                stage: 2,
                magId,
                feedTableId: feedTableIdOf(data, magId),
                evoLevel: 35,
                feeder: {},
                condKey: stat, // this stat must be the (tie-break-resolved) max
                _prevMagId: stage1Mag,
            });
        }
    }
    return out;
}

// --- stage2/stage3 -> stage3: the per-class ordered rule rows (first-match
// wins going forward; going backward every row that names this mag in its A
// or B column is a distinct way to reach it), plus FO's DEF>=45 override.
// Searched across EVERY class's rule table, not just one: the wiki's
// "transfer the Mag to another character" trick means the feeder's class at
// this step need not match the mag's original stage0 lineage, and the same
// mag name legitimately appears under more than one class's table (e.g.
// Varaha under both HU and RA).
function stage3Predecessors(data, magId) {
    const ev = data.evolution;
    const out = [];
    for (const cls of Object.keys(ev.stage3Rules || {})) {
        (ev.stage3Rules[cls] || []).forEach((row) => {
            for (const grp of ['A', 'B']) {
                if (row[grp] !== magId) continue;
                out.push({
                    stage: 3,
                    magId,
                    feedTableId: feedTableIdOf(data, magId),
                    evoLevel: 50,
                    feeder: { class: cls, sectionId: repId(data, grp) },
                    condKey: row.cond,
                    _lineageCls: cls,
                });
            }
        });
    }
    // FO's all-Section-ID DEF>=45 override sits ahead of (and outside) the
    // rule rows in stage3Next, but is still an FO-feeder-only path.
    const special = ev.stage3SpecialFO;
    if (special) {
        if (magId === special.powMax) {
            out.push({
                stage: 3,
                magId,
                feedTableId: feedTableIdOf(data, magId),
                evoLevel: 50,
                feeder: { class: 'FO', sectionId: repId(data, 'A') },
                condKey: `DEF>=${special.minDef} & POW is max`,
                _lineageCls: 'FO',
            });
        }
        if (magId === special.other) {
            out.push({
                stage: 3,
                magId,
                feedTableId: feedTableIdOf(data, magId),
                evoLevel: 50,
                feeder: { class: 'FO', sectionId: repId(data, 'A') },
                condKey: `DEF>=${special.minDef} & POW not max`,
                _lineageCls: 'FO',
            });
        }
    }
    return out;
}

// --- stage3 -> stage4: feeder class/gender/Section-ID Type, plus one of the
// three DEF/POW/DEX/MIND equalities (evolution.stage4[cls][gender][Type]).
// The formula is evaluated purely against the mag's STATS (stage4Next in
// mag-sim-engine.js) — it never looks at which of the 21 named 3rd-evolution
// mags is currently held — so every stage3 mag in the game is a legitimate
// predecessor here; which one gets filled in by the caller.
function stage4Predecessors(data, magId) {
    const ev = data.evolution;
    const out = [];
    for (const cls of Object.keys(ev.stage4 || {})) {
        const byGender = ev.stage4[cls];
        for (const g of Object.keys(byGender)) {
            const byType = byGender[g];
            for (const type of Object.keys(byType)) {
                const leaf = byType[type];
                for (const formula of Object.keys(leaf)) {
                    if (leaf[formula] !== magId) continue;
                    out.push({
                        stage: 4,
                        magId,
                        feedTableId: feedTableIdOf(data, magId),
                        evoLevel: 100,
                        feeder: { class: cls, gender: g, sectionId: repId(data, type) },
                        condKey: formula,
                    });
                }
            }
        }
    }
    return out;
}

// Every named 3rd-evolution mag in the game: the union of every rule row's
// A/B columns (across all classes) plus the FO DEF>=45 override's two mags.
// This is the candidate predecessor pool for stage4Predecessors (see comment
// there for why identity, not just stage, is genuinely unconstrained).
function allStage3MagIds(data) {
    const ev = data.evolution;
    const ids = new Set();
    for (const cls of Object.keys(ev.stage3Rules || {})) {
        (ev.stage3Rules[cls] || []).forEach((row) => { ids.add(row.A); ids.add(row.B); });
    }
    if (ev.stage3SpecialFO) {
        ids.add(ev.stage3SpecialFO.powMax);
        ids.add(ev.stage3SpecialFO.other);
    }
    return [...ids];
}

// Every ordered step-chain (stage1 first, target last) that ends at `magId`.
// Memoized per top-level call: chainsTo(magId) is a pure function of magId +
// data alone (it never depends on who's asking), and the same predecessor
// mag id is legitimately reached from many different branches above it.
function chainsTo(data, magId, memo) {
    if (memo.has(magId)) return memo.get(magId);
    // Cycle guard: stage strictly decreases on every recursive call below
    // (stage2 recurses into a stage1 predecessor, stage3 into stage2, stage4
    // into stage3), so this can only trip on malformed/hand-edited data.
    memo.set(magId, []);

    const info = data.mags[magId];
    let chains = [];
    if (info) {
        const stage = info.stage;
        if (stage === 1) {
            chains = stage1Predecessors(data, magId).map((step) => [step]);
        } else if (stage === 2) {
            for (const step of stage2Predecessors(data, magId)) {
                const prevMagId = step._prevMagId;
                const step2 = { ...step };
                delete step2._prevMagId;
                for (const prev of chainsTo(data, prevMagId, memo)) {
                    chains.push([...prev, step2]);
                }
            }
        } else if (stage === 3) {
            for (const step of stage3Predecessors(data, magId)) {
                const lineageCls = step._lineageCls;
                const step3 = { ...step };
                delete step3._lineageCls;
                const stage1Mag = data.evolution.stage1[lineageCls];
                const branch = stage1Mag ? data.evolution.stage2[stage1Mag] : null;
                if (!branch) continue;
                for (const stat of Object.keys(branch)) {
                    const stage2MagId = branch[stat];
                    for (const prev of chainsTo(data, stage2MagId, memo)) {
                        chains.push([...prev, step3]);
                    }
                }
            }
        } else if (stage === 4) {
            const stage3Ids = allStage3MagIds(data);
            for (const step of stage4Predecessors(data, magId)) {
                for (const stage3MagId of stage3Ids) {
                    for (const prev of chainsTo(data, stage3MagId, memo)) {
                        chains.push([...prev, step]);
                    }
                }
            }
        }
    }

    memo.set(magId, chains);
    return chains;
}

// Reverse-enumerate the evolution chains that produce `targetMagId`.
// Returns [] for an unknown id or a stage-0 (fresh) mag, which has no
// predecessor to enumerate.
export function evolutionChains(data, targetMagId) {
    const info = data.mags[targetMagId];
    if (!info || !info.stage) return [];
    const memo = new Map();
    const chains = chainsTo(data, targetMagId, memo);
    return chains.map((steps) => ({ steps, targetStage: info.stage }));
}

// ===========================================================================
// solveSegment — bounded exact per-segment four-stat solver
// ===========================================================================
//
// Given ONE feed table, a starting four-stat vector and an EXACT integer delta
// to add to each stat, find an ORDERED array of item names whose net integer
// stat gains equal `targetDelta` exactly. Returns `null` if it cannot within
// `maxItems` (or within its search budget — a hard case).
//
// This is pure stat arithmetic inside a single table: it does NOT check
// evolution (the Task-3 assembler keeps each segment under the next evolution
// level). Correctness is guaranteed by engine replay — the tests feed the
// solver's output through mag-sim-engine.js `feedOnce` and assert the exact
// resulting stats; the engine is ground truth.
//
// The stat model MUST match feedOnce bit-for-bit:
//   * each item vector is `[ΔDEF,ΔPOW,ΔDEX,ΔMIND,ΔSync,ΔIQ]` in HUNDREDTHS;
//   * a stat's integer level rises by 1 per 100 accumulated hundredths (carry),
//     level is re-read on every carry step for the 200 cap;
//   * NEGATIVE-FEED ALL-OR-NOTHING: a negative delta that would take a stat's
//     hundredths bar below 0 does NOT apply at all (the bar is untouched, not
//     floored). This is why Difluid=[0,-10,0,11] is pure-MIND when POW=0.
//   * integer levels NEVER decrease — so a target with any negative component
//     is unsolvable (returns null immediately).
//
// Algorithm: heuristic best-first bounded DFS over the state
// (4 hundredths accumulators + 4 integer gains). Each item application follows
// the engine's exact carry/negative-skip rules. Pruning: any stat's integer
// gain exceeding its target is a dead branch (levels never come back down);
// path length over `maxItems` is pruned; a `visited` set kills revisited
// states; a global node budget guarantees termination (return null, never
// hang). Candidates are ordered by remaining L1 hundredths-need so the search
// dives straight at tractable single-/few-dominant-stat targets.
//
// What it reliably solves: single-dominant-stat targets and modest multi-stat
// targets where near-pure items exist (the common planner cases). What it may
// return null on: tightly-coupled multi-stat targets that need exact negative
// interleaving, or anything whose search exceeds the node budget — by design,
// the caller falls back to nearest-reachable for those.

const SOLVE_STATS = ['def', 'pow', 'dex', 'mind'];
const SOLVE_MAX_NODES = 600000;

// Exact mirror of feedOnce's primary-stat block (mag-sim-engine.js lines
// ~72-101), minus synchro/iq/evolution which do not affect integer stat gains.
// `base` are the segment's starting integer stats (for the 200 cap and level).
// Returns the next {gain, prog} or null if the item is a no-op (changes
// nothing — every negative skipped and nothing carried), which the caller
// discards to avoid cycles.
function solveApply(state, vec, base) {
    const gain = { ...state.gain };
    const prog = { ...state.prog };
    let changed = false;
    for (let i = 0; i < SOLVE_STATS.length; i++) {
        const k = SOLVE_STATS[i];
        const d = vec[i];
        if (d === 0) continue;
        // negative all-or-nothing: skip entirely if it would go below 0
        if (d < 0 && prog[k] + d < 0) continue;
        prog[k] += d;
        if (d !== 0) changed = true;
        while (prog[k] >= 100) {
            const level = base.def + base.pow + base.dex + base.mind
                + gain.def + gain.pow + gain.dex + gain.mind;
            const statVal = base[k] + gain[k];
            if (level >= 200 || statVal >= 200) { prog[k] = 99; break; } // capped
            gain[k] += 1; prog[k] -= 100;
        }
    }
    return changed ? { gain, prog } : null;
}

function solveStatsOf(base, gain) {
    return { def: base.def + gain.def, pow: base.pow + gain.pow,
             dex: base.dex + gain.dex, mind: base.mind + gain.mind };
}

// Remaining hundredths-need to reach each stat's lower target bound. Zero for a
// stat already at (or past) its target level. `effProg[k] = 100*gain[k] +
// prog[k]`. Returns BOTH the total (`sum`) and the single worst stat (`max`):
// the greedy expansion sorts on `max` FIRST so it always chips at the
// BOTTLENECK stat, then breaks ties on `sum`. Sorting on `sum` alone let a
// side-stat-heavy item (e.g. a dex-rich cell) edge out the pow-focused item on
// a pow-dominant target by a hair, then the DFS sank the entire node budget into
// that dead-end subtree before ever backtracking to try the right item first.
function solveNeed(state, target) {
    let sum = 0, max = 0;
    for (const k of SOLVE_STATS) {
        const eff = 100 * state.gain[k] + state.prog[k];
        const lo = 100 * target[k];
        if (eff < lo) { const d = lo - eff; sum += d; if (d > max) max = d; }
    }
    return { sum, max };
}

export function solveSegment(data, opts) {
    const { table, startStats, targetDelta, maxItems = 400, orderConstraint,
            startProgress, maxNodes = SOLVE_MAX_NODES } = opts || {};
    const rows = data.feedTables[table];
    if (!rows) return null;

    // Hundredths already sitting in each stat's bar at the segment's start. The
    // engine's `progress` CARRIES ACROSS an evolution (feedOnce never resets it),
    // so the assembler MUST hand the live carried bar here or the solver's model
    // drifts from the engine on the first feed. Defaults to a clean 0 bar, which
    // is exactly the zero-progress contract the test suite relies on.
    const prog0 = {
        def: (startProgress && startProgress.def) | 0,
        pow: (startProgress && startProgress.pow) | 0,
        dex: (startProgress && startProgress.dex) | 0,
        mind: (startProgress && startProgress.mind) | 0,
    };

    const base = { def: startStats.def | 0, pow: startStats.pow | 0,
                   dex: startStats.dex | 0, mind: startStats.mind | 0 };
    const target = { def: targetDelta.def | 0, pow: targetDelta.pow | 0,
                     dex: targetDelta.dex | 0, mind: targetDelta.mind | 0 };
    // Integer levels never decrease: any negative target component is
    // unsolvable, and the whole segment must stay under the 200 cap.
    for (const k of SOLVE_STATS) {
        if (target[k] < 0) return null;
        if (base[k] + target[k] > 200) return null;
    }
    if (base.def + base.pow + base.dex + base.mind
        + target.def + target.pow + target.dex + target.mind > 200) return null;

    const items = Object.entries(rows); // [name, vec]
    const isGoal = (g) => SOLVE_STATS.every((k) => g[k] === target[k]);

    // orderConstraint: an optional predicate over the integer stats
    // ({def,pow,dex,mind}, base+gain) that must hold AFTER every feed
    // (e.g. `(s) => s.dex <= s.pow` for "DEX must never exceed POW").
    const orderOk = typeof orderConstraint === 'function'
        ? (gain) => orderConstraint(solveStatsOf(base, gain))
        : () => true;

    const start = { gain: { def: 0, pow: 0, dex: 0, mind: 0 },
                    prog: { ...prog0 } };
    if (isGoal(start.gain)) return [];
    if (!orderOk(start.gain)) return null;

    const key = (s) => `${s.gain.def},${s.gain.pow},${s.gain.dex},${s.gain.mind}|`
        + `${s.prog.def},${s.prog.pow},${s.prog.dex},${s.prog.mind}`;
    const visited = new Set([key(start)]);
    const path = [];
    let nodes = 0;
    let budgetHit = false;

    const dfs = (state) => {
        if (nodes++ > maxNodes) { budgetHit = true; return false; }
        if (path.length >= maxItems) return false;

        const cands = [];
        for (const [name, vec] of items) {
            const ns = solveApply(state, vec, base);
            if (!ns) continue;                                   // no-op item
            let over = false;
            for (const k of SOLVE_STATS) if (ns.gain[k] > target[k]) { over = true; break; }
            if (over) continue;                                  // integer overshoot: dead
            if (!orderOk(ns.gain)) continue;
            const kk = key(ns);
            if (visited.has(kk)) continue;
            cands.push({ name, ns, kk, need: solveNeed(ns, target) });
        }
        // Heuristic: expand the candidate that leaves the least remaining need
        // first, so tractable targets are reached with little/no backtracking.
        // Bottleneck stat (`max`) dominates the ordering, total (`sum`) breaks
        // ties — see solveNeed for why `sum` alone mis-orders pow-dominant runs.
        cands.sort((a, b) => (a.need.max - b.need.max) || (a.need.sum - b.need.sum));

        for (const c of cands) {
            if (isGoal(c.ns.gain)) { path.push(c.name); return true; }
            visited.add(c.kk);
            path.push(c.name);
            if (dfs(c.ns)) return true;
            path.pop();
            if (budgetHit) return false;
        }
        return false;
    };

    return dfs(start) ? [...path] : null;
}

// ===========================================================================
// planMag — assemble an EXACT plan and prove it by engine replay
// ===========================================================================
//
// Given a target mag id + four stats, return { plan, nearest, reason } where a
// non-null `plan` is GUARANTEED (by replay) to end at exactly that mag and those
// stats. `nearest` is populated by the nearest-reachable fallback below and
// is always null here.
//
// The crucial subtlety: the engine's hundredths `progress` CARRIES ACROSS an
// evolution — feedOnce never resets it. So the plan is built by forward-
// simulating through the real engine one segment at a time; each segment hands
// solveSegment the LIVE carried progress (`startProgress`) and the live integer
// stats, and the engine — not the solver — decides the actual carried state and
// which mag we evolve into. The solver only proposes the item order to reach the
// next checkpoint; the engine adjudicates. A final independent replay is the
// non-negotiable safety net.
//
// Strategy (mirrors the guide's structure for a stage-4 target):
//   * Pick a FEEDER (class/gender/Section-ID) from the reverse chains whose
//     Lv.100 formula is satisfied by the target — one feeder used throughout
//     (no mid-run character transfer), which is what real single-recipe guides
//     do.
//   * Cross Lv.10 (any stats), Lv.35 (DEX-heavy — Table-1's only DEF-free item,
//     Antidote, is DEX-dominant, so we ride the Marutah line and let POW catch
//     up later), Lv.50 (land on a stage-3 rule), Lv.100 (land EXACTLY on target,
//     satisfying the Lv.100 formula). DEF is held at its fresh value throughout
//     because integer levels never fall — any DEF gained early can never be
//     given back, so it must never cross a whole level.

const P_STATS = ['def', 'pow', 'dex', 'mind'];
const PRIM = ['pow', 'dex', 'mind'];

const PLAN_FORMULA = {
    'DEF+POW=DEX+MIND': (s) => s.def + s.pow === s.dex + s.mind,
    'DEF+DEX=POW+MIND': (s) => s.def + s.dex === s.pow + s.mind,
    'DEF+MIND=POW+DEX': (s) => s.def + s.mind === s.pow + s.dex,
};

function idTypeOf(data, id) {
    if (data.idGroups.Type1.includes(id)) return 'Type1';
    if (data.idGroups.Type2.includes(id)) return 'Type2';
    return 'Type3';
}
function idGroupABOf(data, id) { return data.idGroups.A.includes(id) ? 'A' : 'B'; }

// mirrors mag-sim-engine.js evalStage3Rule (kept local so the planner needs no
// engine internals beyond the replay primitives).
function evalRuleLocal(cond, v) {
    const OPS = { '>': (a, b) => a > b, '≥': (a, b) => a >= b, '=': (a, b) => a === b };
    const tok = cond.split(' ');
    for (let i = 0; i + 2 < tok.length; i += 2) {
        const op = OPS[tok[i + 1]];
        if (!op || !op(v[tok[i]], v[tok[i + 2]])) return false;
    }
    return true;
}
function argmax3(s, tie) {
    const v = { POW: s.pow, DEX: s.dex, MIND: s.mind };
    const mx = Math.max(v.POW, v.DEX, v.MIND);
    const top = ['POW', 'DEX', 'MIND'].filter((k) => v[k] === mx);
    return top.length === 1 ? top[0] : tie;
}
// mirrors engine stage3Next: which 3rd-evolution mag this feeder+stats yields.
function stage3MagFor(data, feeder, s) {
    const ev = data.evolution;
    if (feeder.class === 'FO' && s.def >= ev.stage3SpecialFO.minDef) {
        return argmax3(s, null) === 'POW' ? ev.stage3SpecialFO.powMax : ev.stage3SpecialFO.other;
    }
    const grp = idGroupABOf(data, feeder.sectionId);
    const V = { POW: s.pow, DEX: s.dex, MIND: s.mind };
    const row = (ev.stage3Rules[feeder.class] || []).find((r) => evalRuleLocal(r.cond, V));
    return row ? row[grp] : null;
}
// mirrors engine stage4Next: which 4th-evolution mag this feeder+stats yields.
function stage4MagFor(data, feeder, s) {
    const leaf = ((data.evolution.stage4[feeder.class] || {})[feeder.gender] || {})[idTypeOf(data, feeder.sectionId)];
    if (!leaf) return null;
    const formula = Object.keys(leaf).find((k) => leaf[k] !== null);
    if (!formula || !PLAN_FORMULA[formula]) return null;
    return PLAN_FORMULA[formula](s) ? leaf[formula] : null;
}

// Split `level` whole primary points across POW/DEX/MIND proportional to the
// target's growth `g`, clamped into [floor, cap] per stat and nudged so the
// parts sum to exactly `level`.
function distribute(level, g, floor, cap) {
    const gs = g.pow + g.dex + g.mind || 1;
    const a = {
        pow: Math.round(level * g.pow / gs),
        dex: Math.round(level * g.dex / gs),
        mind: 0,
    };
    a.mind = level - a.pow - a.dex;
    for (const k of PRIM) a[k] = Math.max(floor[k], Math.min(cap[k], a[k]));
    let s = a.pow + a.dex + a.mind, guard = 0;
    while (s !== level && guard++ < 2000) {
        if (s < level) {
            const k = PRIM.filter((k) => a[k] < cap[k]).sort((x, y) => g[y] - g[x])[0];
            if (k === undefined) break; a[k]++; s++;
        } else {
            const k = PRIM.filter((k) => a[k] > floor[k]).sort((x, y) => g[x] - g[y])[0];
            if (k === undefined) break; a[k]--; s--;
        }
    }
    return { def: floor.def, pow: a.pow, dex: a.dex, mind: a.mind, _lvl: floor.def + s };
}

// The ordered stat checkpoints to cross on the way to a stage-`stage` target.
// Returns a SMALL SET of candidate schemes (each a list of {evoLevel, stats}),
// because the exact stat split at an intermediate evolution level is not
// pinned down — only the level and the evolution gate are. A given feed table
// can hit some splits cleanly and not others (Table-2's Sol adds POW and DEX in
// a fixed 11:3 lump, so a Lv.50 that wants DEX+2 is unsolvable while DEX+3 is
// trivial). So we enumerate a few Lv.50 splits and let the caller's engine
// replay adjudicate which one actually lands. DEF stays at the fresh value on
// every intermediate checkpoint (integer levels never fall, so DEF must never
// cross a whole level early — see the header note).
function stage4Checkpoint(formula, floor, target, level) {
    const pairs = {
        'DEF+POW=DEX+MIND': [['def', 'pow'], ['dex', 'mind']],
        'DEF+DEX=POW+MIND': [['def', 'dex'], ['pow', 'mind']],
        'DEF+MIND=POW+DEX': [['def', 'mind'], ['pow', 'dex']],
    }[formula];
    if (!pairs || level % 2) return null;
    const half = level / 2;
    const point = {};
    for (const [a, b] of pairs) {
        const lo = Math.max(floor[a], half - target[b]);
        const hi = Math.min(target[a], half - floor[b]);
        if (lo > hi) return null;
        // Stay as close as possible to the requested final value. If that
        // value is above this evolution checkpoint's pair sum, clamping to hi
        // naturally postpones the excess growth until after the Mag is locked.
        point[a] = Math.max(lo, Math.min(hi, target[a]));
        point[b] = half - point[a];
    }
    return point;
}

function planSchemes(data, target, stage4Formula = null) {
    const fresh = data.freshMag;
    const D0 = fresh.def;
    const stage = data.mags[target.magId].stage;
    const g = { pow: target.pow - fresh.pow, dex: target.dex - fresh.dex, mind: target.mind - fresh.mind };
    const tgt = { def: target.def, pow: target.pow, dex: target.dex, mind: target.mind };
    const targetLevel = target.def + target.pow + target.dex + target.mind;
    const base = { def: D0, pow: fresh.pow, dex: fresh.dex, mind: fresh.mind };

    // Lv.10 — raise the target's dominant primary by (10 - DEF). No stat gate.
    const dom = PRIM.slice().sort((a, b) => g[b] - g[a])[0];
    const cp0 = { ...base };
    cp0[dom] = Math.min(tgt[dom], cp0[dom] + (10 - D0));
    const useCp0 = stage >= 1 && targetLevel > 10;

    // Lv.35 — DEX-heavy, and NOT free-form: Table-1's only DEF-free item is
    // Antidote, whose fixed +5 POW / +15 DEX hundredths force POW:DEX ≈ 1:3 on
    // any DEF-preserving run. So the checkpoint ADDS the ~25 remaining levels to
    // cp0 in that same 1:3 ratio (a proportional-to-target split overran POW and
    // left the segment unsolvable). Capped by the target.
    const prev1 = useCp0 ? cp0 : base;
    const cp1 = { ...prev1 };
    const add1 = Math.max(0, 35 - (prev1.def + prev1.pow + prev1.dex + prev1.mind));
    const powAdd = Math.round(add1 / 4);
    let left = add1;
    cp1.pow = Math.min(tgt.pow, cp1.pow + powAdd); left -= (cp1.pow - prev1.pow);
    cp1.dex = Math.min(tgt.dex, cp1.dex + left); left = add1 - (cp1.pow - prev1.pow) - (cp1.dex - prev1.dex);
    for (const k of PRIM) { while (left > 0 && cp1[k] < tgt[k]) { cp1[k]++; left--; } }
    const useCp1 = stage >= 2 && targetLevel > 35;

    const head = [];
    if (useCp0) head.push({ evoLevel: 10, stats: cp0 });
    if (useCp1) head.push({ evoLevel: 35, stats: cp1 });

    // Below stage 3 (or a target that never reaches Lv.50) there is no Lv.50
    // split to vary — one scheme suffices.
    if (stage < 3 || targetLevel <= 50) {
        return [[...head, { evoLevel: targetLevel, stats: tgt }]];
    }

    // Lv.50 — proportional split is the seed; enumerate DEX ±k around it (POW
    // takes up the slack so DEF(5)+POW+DEX+MIND == 50), keeping every part inside
    // [floor, target]. The proportional split matches the final stat ordering,
    // which keeps the stage-3 mag stable all the way to Lv.100.
    const floor2 = useCp1 ? cp1 : (useCp0 ? cp0 : base);
    const prop = distribute(45, g, { def: D0, pow: floor2.pow, dex: floor2.dex, mind: floor2.mind }, tgt);
    const mind2 = prop.mind;
    const schemes = [];
    const seenDex = new Set();
    for (let k = 0; k <= 8; k++) {
        for (const dex of (k === 0 ? [prop.dex] : [prop.dex + k, prop.dex - k])) {
            if (seenDex.has(dex)) continue; seenDex.add(dex);
            const pow = 45 - dex - mind2;
            if (dex < floor2.dex || dex > tgt.dex) continue;
            if (pow < floor2.pow || pow > tgt.pow) continue;
            const cp2 = { def: D0, pow, dex, mind: mind2 };
            const prefix = [...head, { evoLevel: 50, stats: cp2 }];
            if (stage !== 4 || !stage4Formula) {
                schemes.push([...prefix, { evoLevel: targetLevel, stats: tgt }]);
                continue;
            }

            // A fourth-evolution equality is a CHECKPOINT condition, not a
            // final-stat condition. Find an Lv100/110/... point between the
            // Lv50 state and the requested final stats where the equality
            // holds; after that the rare Mag is locked and can be fed freely.
            for (let level = 100; level <= targetLevel; level += 10) {
                const evo = stage4Checkpoint(stage4Formula, cp2, tgt, level);
                if (!evo) continue;
                const tail = P_STATS.every((stat) => evo[stat] === tgt[stat])
                    ? [] : [{ evoLevel: targetLevel, stats: tgt }];
                schemes.push([...prefix, { evoLevel: level, stats: evo }, ...tail]);
            }
        }
    }
    return schemes;
}

// Forward-build one candidate plan for a fixed feeder. Returns the plan object
// (segments + totals) or null if any segment is unsolvable / the run does not
// land on the target. Every stat number comes from the real engine.
function buildPlanForFeeder(data, target, feeder, cps, maxNodes) {
    const state = createState(data, { start: { mode: 'fresh' } });
    const segments = [];

    for (const cp of cps) {
        const magFrom = state.magId;
        const table = data.mags[magFrom].feedTableId;
        const cur = { def: state.def, pow: state.pow, dex: state.dex, mind: state.mind };
        const delta = {
            def: cp.stats.def - cur.def, pow: cp.stats.pow - cur.pow,
            dex: cp.stats.dex - cur.dex, mind: cp.stats.mind - cur.mind,
        };
        // While feeding a 3rd-evolution mag the engine re-checks stage-3 at every
        // multiple of 5 — hold the SAME mag (hence the same feed table) by
        // forbidding any feed that would re-target it.
        let orderConstraint;
        if (data.mags[magFrom].stage === 3) {
            const X = magFrom;
            orderConstraint = (s) => stage3MagFor(data, feeder, s) === X;
        }
        const seq = solveSegment(data, {
            table, startStats: cur, targetDelta: delta, maxItems: 1200,
            startProgress: { ...state.progress }, orderConstraint, maxNodes,
        });
        if (!seq) return null;

        state.feeder = { class: feeder.class, gender: feeder.gender, sectionId: feeder.sectionId, race: 'Human' };
        for (const item of seq) feedOnce(data, state, item);

        const counts = new Map();
        for (const it of seq) counts.set(it, (counts.get(it) || 0) + 1);
        segments.push({
            feeder: { class: feeder.class, gender: feeder.gender, sectionId: feeder.sectionId },
            magFrom, magTo: state.magId, evoLevel: cp.evoLevel,
            feeds: [...counts.entries()].map(([item, count]) => ({ item, count })),
            banks: 0,
            order: seq.map((item) => ({ item })),
        });
    }

    // land check (redundant with the replay below, but a cheap early out)
    if (!(state.magId === target.magId && state.def === target.def && state.pow === target.pow
        && state.dex === target.dex && state.mind === target.mind)) return null;

    // Totals from the actual run.
    const items = segments.reduce((n, s) => n + s.order.length, 0);
    let meseta = 0;
    for (const s of segments) for (const st of s.order) meseta += (data.costs[st.item] || 0);
    return {
        segments,
        totals: { items, meseta, cycles: feedCycles(state.log), banks: 0 },
    };
}

// THE SAFETY NET: replay a finished plan through a fresh engine and return the
// terminal state, so planMag can assert it equals the target before ever
// handing the plan back. Independent of the build-time simulation.
function replayPlan(data, plan) {
    const t = createState(data, { start: { mode: 'fresh' } });
    for (const seg of plan.segments) {
        t.feeder = { ...seg.feeder, race: 'Human' };
        for (const step of seg.order) { step.bank ? bankMag(data, t) : feedOnce(data, t, step.item); }
    }
    return t;
}

// Search for an EXACT, replay-validated plan landing on `T` (magId + four
// stats). Returns the fewest-items such plan or null. Extracted from planMag so
// Task-4's nearest fallback can re-run the identical exact machinery on nearby
// target points without duplicating any of the feeder-selection / replay logic.
//
// Candidate feeders: from the reverse chains, keep those whose Lv.100 formula
// the target satisfies, that use a single class from Lv.10 to Lv.100, and that
// actually map to the target mag. Dedup by class/gender/Section-Type. maxNodes
// per solveSegment is carved from `budget` so the whole search is bounded and
// can never hang. `nodeFloor` is the minimum maxNodes handed to solveSegment
// per attempt — see the budget-guard block below planMag for why this is a
// parameter rather than a hardcoded constant.
function exactPlanFor(data, T, budget, nodeFloor) {
    const chains = evolutionChains(data, T.magId);
    const feeders = [];
    const seen = new Set();
    for (const { steps } of chains) {
        const s4 = steps.find((s) => s.stage === 4);
        const s3 = steps.find((s) => s.stage === 3);
        const s1 = steps.find((s) => s.stage === 1);
        if (!s4 || !s1) continue;
        if (!PLAN_FORMULA[s4.condKey]) continue;
        const cls = s4.feeder.class, gen = s4.feeder.gender, section = s4.feeder.sectionId;
        if (s1.feeder.class !== cls) continue;
        if (s3 && s3.feeder.class !== cls) continue;
        const key = `${cls}/${gen}/${idTypeOf(data, section)}`;
        if (seen.has(key)) continue;
        const feeder = { class: cls, gender: gen, sectionId: section, formula: s4.condKey };
        seen.add(key);
        feeders.push(feeder);
    }
    if (!feeders.length) return null;

    const tryFeeders = feeders.slice(0, 6);
    const schemeSets = tryFeeders.map((feeder) =>
        planSchemes(data, T, feeder.formula).slice(0, 18));
    const attempts = Math.max(1, schemeSets.reduce((n, schemes) => n + schemes.length, 0));
    const maxNodes = Math.min(SOLVE_MAX_NODES, Math.max(nodeFloor, Math.floor(budget / (attempts * 4))));
    // Evaluate EVERY (feeder, scheme) combination in this small bounded set —
    // do not stop at the first feeder that yields any exact plan. solveSegment
    // is a heuristic near-optimal solver (NOT a guaranteed global minimum per
    // segment), so this is "pick the fewest-items candidate among those
    // actually tried," not a minimality proof — but picking only the FIRST
    // feeder to succeed (the prior behaviour) threw away strictly-cheaper
    // plans from later feeders/schemes for no reason, since the set is already
    // bounded (≤6 feeders × ≤18 schemes = ≤108 attempts) and cheap to finish.
    let best = null;
    for (let i = 0; i < tryFeeders.length; i++) {
        const feeder = tryFeeders[i];
        for (const cps of schemeSets[i]) {
            const plan = buildPlanForFeeder(data, T, feeder, cps, maxNodes);
            if (!plan) continue;
            const t = replayPlan(data, plan);           // non-negotiable replay
            if (!(t.magId === T.magId && t.def === T.def && t.pow === T.pow
                && t.dex === T.dex && t.mind === T.mind)) continue;   // reject silently
            if (!best || plan.totals.items < best.totals.items) best = plan;
        }
    }
    return best;
}

// Cell Mags are absent from the normal stage-4 formula table. Plan their
// required predecessor first, preserving the requested final stats, then feed
// the Cell as an explicit final segment and let the real engine validate every
// requirement (species/stage/level/Section ID/synchro/IQ/stat thresholds).
function cellRoutesTo(data, magId) {
    const routes = [];
    for (const [cellName, cell] of Object.entries(data.magCells || {})) {
        const targets = Array.isArray(cell.target) ? cell.target : [cell.target];
        if (!targets.includes(magId)) continue;
        routes.push({ cellName, req: (cell.requires || {})[magId] || {} });
    }
    return routes;
}

function stage3FeederCandidates(data, T) {
    const out = [];
    const seen = new Set();
    for (const { steps } of evolutionChains(data, T.magId)) {
        const s1 = steps.find((s) => s.stage === 1);
        const s3 = steps.find((s) => s.stage === 3);
        if (!s1 || !s3 || s1.feeder.class !== s3.feeder.class) continue;
        const feeder = {
            class: s3.feeder.class,
            gender: 'M',
            sectionId: s3.feeder.sectionId,
        };
        if (stage3MagFor(data, feeder, T) !== T.magId) continue;
        const key = `${feeder.class}/${idGroupABOf(data, feeder.sectionId)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(feeder);
    }
    return out;
}

function exactStage3PlanFor(data, T, budget, nodeFloor) {
    const feeders = stage3FeederCandidates(data, T).slice(0, 8);
    if (!feeders.length) return null;
    const schemes = planSchemes(data, T).slice(0, 18);
    const attempts = Math.max(1, feeders.length * schemes.length);
    const maxNodes = Math.min(
        SOLVE_MAX_NODES,
        Math.max(nodeFloor, Math.floor(budget / (attempts * 4))),
    );
    let best = null;
    for (const feeder of feeders) {
        for (const cps of schemes) {
            const plan = buildPlanForFeeder(data, T, feeder, cps, maxNodes);
            if (!plan) continue;
            const state = replayPlan(data, plan);
            if (state.magId !== T.magId
                || !P_STATS.every((k) => state[k] === T[k])) continue;
            if (!best || plan.totals.items < best.totals.items) best = plan;
        }
    }
    return best;
}

function cellPredecessorTargets(data, T, magId, req) {
    const fresh = data.freshMag;
    const minLevel = Math.max(50, req.minMagLevel || 0);
    const targetLevel = P_STATS.reduce((n, k) => n + T[k], 0);
    if (minLevel > targetLevel) return [];
    const growth = {
        pow: T.pow - fresh.pow,
        dex: T.dex - fresh.dex,
        mind: T.mind - fresh.mind,
    };
    const point = distribute(
        minLevel - fresh.def,
        growth,
        { def: fresh.def, pow: fresh.pow, dex: fresh.dex, mind: fresh.mind },
        T,
    );
    delete point._lvl;
    const out = [];
    const add = (p) => {
        if (!P_STATS.every((k) => p[k] >= fresh[k] && p[k] <= T[k])) return;
        if (P_STATS.reduce((n, k) => n + p[k], 0) !== minLevel) return;
        const key = P_STATS.map((k) => p[k]).join(',');
        if (!out.some((x) => P_STATS.map((k) => x[k]).join(',') === key)) {
            out.push({ ...p, magId });
        }
    };

    // The planner's DEF-preserving Lv35 route naturally reaches roughly
    // 5/11/19/0. Include the compatible Lv50 continuation first; a purely
    // proportional Lv50 split (e.g. 5/34/11/0) can ask the impossible and
    // "remove" DEX that was already gained before Lv35.
    if (minLevel >= 50) {
        const dex = Math.min(T.dex, 19);
        const mind = fresh.mind;
        const pow = minLevel - fresh.def - dex - mind;
        add({ def: fresh.def, pow, dex, mind });
    }
    add(point);
    return out;
}

function appendCellAndFinish(data, basePlan, cellName, T, maxNodes) {
    const state = replayPlan(data, basePlan);
    const feeder = { ...basePlan.segments.at(-1).feeder };
    state.feeder = { ...feeder, race: 'Human' };
    const from = state.magId;
    feedOnce(data, state, cellName);
    if (state.magId !== T.magId) return null;

    const segments = [...basePlan.segments, {
        feeder,
        magFrom: from,
        magTo: state.magId,
        evoLevel: P_STATS.reduce((n, k) => n + state[k], 0),
        feeds: [{ item: cellName, count: 1 }],
        banks: 0,
        order: [{ item: cellName }],
        viaCell: cellName,
    }];

    if (!P_STATS.every((k) => state[k] === T[k])) {
        const cur = Object.fromEntries(P_STATS.map((k) => [k, state[k]]));
        const delta = Object.fromEntries(P_STATS.map((k) => [k, T[k] - state[k]]));
        const seq = solveSegment(data, {
            table: data.mags[T.magId].feedTableId,
            startStats: cur,
            targetDelta: delta,
            startProgress: { ...state.progress },
            maxItems: 1200,
            maxNodes,
        });
        if (!seq) return null;
        for (const item of seq) feedOnce(data, state, item);
        if (state.magId !== T.magId || !P_STATS.every((k) => state[k] === T[k])) return null;
        const counts = new Map();
        for (const item of seq) counts.set(item, (counts.get(item) || 0) + 1);
        segments.push({
            feeder,
            magFrom: T.magId,
            magTo: T.magId,
            evoLevel: P_STATS.reduce((n, k) => n + T[k], 0),
            feeds: [...counts].map(([item, count]) => ({ item, count })),
            banks: 0,
            order: seq.map((item) => ({ item })),
        });
    }

    const items = segments.reduce((n, segment) => n + segment.order.length, 0);
    let meseta = 0;
    for (const segment of segments) {
        for (const step of segment.order) meseta += data.costs[step.item] || 0;
    }
    return {
        segments,
        totals: {
            items,
            meseta,
            cycles: feedCycles(state.log),
            banks: 0,
        },
    };
}

function exactCellPlanFor(data, T, budget, nodeFloor) {
    const level = T.def + T.pow + T.dex + T.mind;
    let best = null;
    for (const route of cellRoutesTo(data, T.magId)) {
        if (route.req.minMagLevel && level < route.req.minMagLevel) continue;
        const named = route.req.requiresMag
            ? (Array.isArray(route.req.requiresMag) ? route.req.requiresMag : [route.req.requiresMag])
            : [];
        const predecessors = named.length
            ? named
            : (route.req.requiredStage === 3 ? allStage3MagIds(data) : []);
        for (const magId of predecessors) {
            if (data.mags[magId]?.stage !== 3) continue;
            for (const baseTarget of cellPredecessorTargets(data, T, magId, route.req)) {
                const basePlan = exactStage3PlanFor(data, baseTarget, budget, nodeFloor);
                if (!basePlan) continue;
                const plan = appendCellAndFinish(data, basePlan, route.cellName, T, SOLVE_MAX_NODES);
                if (!plan) continue;
                const terminal = replayPlan(data, plan);
                if (terminal.magId !== T.magId
                    || !P_STATS.every((k) => terminal[k] === T[k])) continue;
                if (!best || plan.totals.items < best.totals.items) best = plan;
            }
        }
    }
    return best;
}

// ===========================================================================
// nearest-reachable fallback
// ===========================================================================
//
// When no EXACT plan lands on the target, still return something useful: the
// reachable four-stat vector CLOSEST (L1) to the target that genuinely evolves
// into `target.magId`, plus an `approximate:true` plan reaching it.
//
// Relax-to-L1, done at the CHECKPOINT level (not inside solveSegment): the exact
// engine can only land on a point that (a) sits at a valid 4th-evolution level
// (100,110,…,200) and (b) satisfies the feeder's Lv.100 equality — otherwise the
// engine never evolves it into the target mag. So the nearest search enumerates
// exactly those structurally-valid points near the target, ordered by L1
// distance, and re-runs the SAME exact machinery (exactPlanFor) on each. The
// first that builds is the nearest reachable point. Because it flows through the
// identical replay, the reported `nearest` stats are the ACTUAL replayed
// terminal stats of the approximate plan — never a computed guess. This is the
// promised "minimise L1 to the target instead of demanding equality": an
// optimisation over reachable terminals rather than a single feasibility solve.

// L1 radius that still counts as "near". Beyond it the mag is reported
// unreachable-for-this-target (nearest:null + reason) rather than as a wildly
// distant "nearest". 5/50/40/0's true nearest Deva is L1=5 (inside); a target
// like 5/0/0/190 whose nearest Deva is L1=185 falls outside → reason path.
const NEAREST_MAX_L1 = 40;

// --- budget guard -----------------------------------------------------------
// A review of the nearest-fallback path found a ~29s worst case (e.g. Sato,
// Nidra near-infeasible targets): up to NEAREST_TRIES_DEEP candidate points,
// each re-running exactPlanFor's up-to-108 feeder/scheme attempts, each
// segment solved with a maxNodes floor that used to be a HARDCODED 50000 —
// so even `opts.budget:1` couldn't make it fast, because that floor ignored
// the caller's budget entirely. Both knobs now derive from `budget` itself:
//   * nodeFloorFor  — the minimum maxNodes handed to every solveSegment call.
//   * maxTriesFor   — how many nearCandidates points nearestFallback re-runs.
// A tiny budget collapses both to their MIN clamp (fast, never hangs). A
// large budget (explicit, or opts.deep's bigger default) rises back to the
// original deep-search bounds — so "opts.deep=true" or "a large
// opts.budget" are equivalent opt-ins into the old exhaustive behaviour; no
// separate deep-mode branching is needed beyond picking the default budget.
const NODE_FLOOR_MIN = 500;
const NODE_FLOOR_DEEP = 50000;       // the original hardcoded floor
const NEAREST_TRIES_MIN = 2;
const NEAREST_TRIES_DEEP = 24;       // the original hardcoded cap

function nodeFloorFor(budget) {
    return Math.max(NODE_FLOOR_MIN, Math.min(NODE_FLOOR_DEEP, Math.floor(budget / 40)));
}
function maxTriesFor(budget) {
    return Math.max(NEAREST_TRIES_MIN, Math.min(NEAREST_TRIES_DEEP, Math.floor(budget / 50000)));
}

// Default budgets when the caller doesn't pass opts.budget: a small one for
// ordinary (interactive-UI) calls — keeps worst case to a few seconds — and a
// much larger one opted into via opts.deep for callers who want the
// exhaustive/slower search (e.g. an offline "solve me the best plan" tool).
const INTERACTIVE_BUDGET = 150_000;
const DEEP_BUDGET = 2_000_000;

// Which Lv.100 equalities produce `magId` (a stage-4 mag can be the leaf of one
// or more feeder Types). Drives both candidate generation and the reason string.
function targetFormulas(data, magId) {
    const set = new Set();
    for (const step of stage4Predecessors(data, magId)) set.add(step.condKey);
    return [...set];
}

// Each Lv.100 equality splits the four stats into two pairs that must sum-match;
// at a valid (even) 4th-evolution level L each pair therefore sums to L/2.
const NEAREST_PAIRS = {
    'DEF+POW=DEX+MIND': [['def', 'pow'], ['dex', 'mind']],
    'DEF+DEX=POW+MIND': [['def', 'dex'], ['pow', 'mind']],
    'DEF+MIND=POW+DEX': [['def', 'mind'], ['pow', 'dex']],
};

// Structurally-valid target points within `radius` L1 of T: sitting on one of
// `formulas`' planes, at a valid 4th-evolution level, every stat ≥ fresh and
// ≤ 200. Deduped, sorted nearest-first. Emptiness ⇒ genuinely unreachable for
// this target within the radius (the reason path).
function nearCandidates(data, T, formulas, radius) {
    const fresh = data.freshMag;
    const floor = { def: fresh.def, pow: fresh.pow, dex: fresh.dex, mind: fresh.mind };
    const l1 = (p) => Math.abs(p.def - T.def) + Math.abs(p.pow - T.pow)
        + Math.abs(p.dex - T.dex) + Math.abs(p.mind - T.mind);
    const out = new Map();
    for (const f of formulas) {
        const pairs = NEAREST_PAIRS[f];
        if (!pairs) continue;
        const [[a1, a2], [b1, b2]] = pairs;
        for (let L = 100; L <= 200; L += 10) {
            const half = L / 2;                       // integer: every valid L is even
            for (let av = floor[a1]; av <= half - floor[a2]; av++) {
                const a2v = half - av;
                if (a2v > 200) continue;
                const dA = Math.abs(av - T[a1]) + Math.abs(a2v - T[a2]);
                if (dA > radius) continue;            // pair A alone already too far
                for (let bv = floor[b1]; bv <= half - floor[b2]; bv++) {
                    const b2v = half - bv;
                    if (b2v > 200) continue;
                    const p = {};
                    p[a1] = av; p[a2] = a2v; p[b1] = bv; p[b2] = b2v;
                    const d = l1(p);
                    if (d === 0 || d > radius) continue;   // 0 == the (failed) exact target
                    const key = `${p.def},${p.pow},${p.dex},${p.mind}`;
                    const prev = out.get(key);
                    if (!prev || prev.dist > d) out.set(key, { point: p, dist: d });
                }
            }
        }
    }
    return [...out.values()].sort((x, y) => x.dist - y.dist);
}

// The fallback proper. Returns the {plan(approximate), nearest{…,dist}, reason}
// near-shape, or the {plan:null, nearest:null, reason} unreachable-shape.
// `maxTries`/`nodeFloor` are the budget-guard knobs derived in planMag (see
// the block above nearCandidates) — capped-fast for the interactive default,
// wide-open for opts.deep / a large explicit opts.budget.
function nearestFallback(data, T, budget, maxTries, nodeFloor) {
    const noNear = (reason) => ({ plan: null, nearest: null, reason });
    const info = data.mags[T.magId];
    // planMag itself only assembles 4th-evolution targets, so the fallback is
    // scoped the same — a lower-stage miss has no near plan to offer.
    if (!info || info.stage !== 4) return noNear('目前仅支持第四进化目标的最近可达 fallback');

    const formulas = targetFormulas(data, T.magId);
    if (!formulas.length) return noNear(`没有任何 feeder 能产出 ${T.magId}`);

    const cands = nearCandidates(data, T, formulas, NEAREST_MAX_L1);
    if (!cands.length) {
        // Nothing reachable within the radius ⇒ genuinely unreachable for these
        // stats. Name the conflicting evolution rule (the Lv.100 equality).
        return noNear(`此四维无法进化成 ${T.magId}：Lv100 需 ${formulas.join(' 或 ')}，当前不成立`);
    }

    // Try nearest-first; each candidate is a real target point run through the
    // exact planner. First that builds wins (it is the closest reachable point).
    // No extra floor on perBudget here — nodeFloor (passed straight through to
    // exactPlanFor) is the real floor now, so a tiny top-level `budget` still
    // shrinks maxNodes as far as nodeFloor allows instead of being masked by a
    // second hardcoded minimum.
    const perBudget = Math.max(1, Math.floor(budget / maxTries));
    for (const { point } of cands.slice(0, maxTries)) {
        const cand = { magId: T.magId, ...point };
        const plan = exactPlanFor(data, cand, perBudget, nodeFloor);
        if (!plan) continue;
        const t = replayPlan(data, plan);                       // replay is truth
        if (t.magId !== T.magId) continue;
        const dist = Math.abs(t.def - T.def) + Math.abs(t.pow - T.pow)
            + Math.abs(t.dex - T.dex) + Math.abs(t.mind - T.mind);
        if (dist === 0) continue;   // would be exact — already tried, keep dist>0
        return {
            plan: { ...plan, approximate: true },
            nearest: { def: t.def, pow: t.pow, dex: t.dex, mind: t.mind, dist },
            reason: `最近可达（L1=${dist}），无精确解`,
        };
    }
    return noNear(`${T.magId} 附近存在可达点，但预算内未能构造近似计划`);
}

export function planMag(data, target, opts = {}) {
    // No explicit opts.budget → pick a small interactive default (fast, bounds
    // worst case to a few seconds) unless opts.deep opts into the old
    // exhaustive default. An explicit opts.budget always wins outright — a
    // tiny one (even `{budget:1}`) must still return fast, and a large one is
    // itself the "opt into exhaustive search" the brief asks for; see the
    // budget-guard block above nearCandidates for how nodeFloorFor/maxTriesFor
    // turn `budget` into actual search bounds.
    const budget = opts.budget ?? (opts.deep ? DEEP_BUDGET : INTERACTIVE_BUDGET);
    const nodeFloor = nodeFloorFor(budget);
    const maxTries = maxTriesFor(budget);
    const fail = (reason) => ({ plan: null, nearest: null, reason });
    if (!target || !data.mags[target.magId]) return fail('unknown mag');

    const fresh = data.freshMag;
    const T = { magId: target.magId, def: target.def | 0, pow: target.pow | 0,
                dex: target.dex | 0, mind: target.mind | 0 };
    // Integer levels never fall, so every stat must start no lower than the fresh
    // mag's, and the whole thing must fit under the 200 cap. Both are hard
    // impossibilities (no nearer reachable point can rescue them) → nearest:null.
    for (const k of P_STATS) if (T[k] < fresh[k]) return fail('stat below fresh mag');
    if (T.def + T.pow + T.dex + T.mind > 200) return fail('level over cap');

    // 1) Exact plan — normal evolution or a Cell as the explicit final step;
    // both are replay-guaranteed to end on exactly the requested target.
    const cellPlan = exactCellPlanFor(data, T, budget, nodeFloor);
    if (cellPlan) return { plan: cellPlan, nearest: null, reason: 'exact' };
    const plan = exactPlanFor(data, T, budget, nodeFloor);
    if (plan) return { plan, nearest: null, reason: 'exact' };

    const cellRoutes = cellRoutesTo(data, T.magId);
    if (cellRoutes.length && !targetFormulas(data, T.magId).length) {
        return fail(`未能构造满足 ${cellRoutes.map((r) => r.cellName).join(' / ')} 前置条件的喂养方案`);
    }

    // 2) No exact plan — nearest-reachable fallback (approximate plan + nearest),
    //    or an unreachable verdict with a reason.
    return nearestFallback(data, T, budget, maxTries, nodeFloor);
}

// browser (non-module) global — mirrors mag-sim-engine.js's window.MagSimEngine
if (typeof window !== 'undefined') {
    window.MagSimPlanner = { evolutionChains, solveSegment, planMag };
}
