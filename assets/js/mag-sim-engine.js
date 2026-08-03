// assets/js/mag-sim-engine.js
export function magLevel(s) { return s.def + s.pow + s.dex + s.mind; }

export function createState(data, { start }) {
    const base = data.freshMag;
    const src = start.mode === 'custom' ? start : base;
    const s = {
        magId: src.magId,
        def: src.def, pow: src.pow, dex: src.dex, mind: src.mind,
        progress: { def: 0, pow: 0, dex: 0, mind: 0 },
        synchro: src.synchro, iq: src.iq,
        // The feeder is one of the 12 PSO classes; the class alone fixes the
        // class line, the gender AND the race (HUmar = HU/M/Human, HUcast =
        // HU/M/Android, …). Race only matters for the mag-cell race rules.
        feeder: { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' },
        // The pre-2017 mag-cell race rules (blnMagRacialRestriction in Aether89's
        // third-party planner Magatama).
        // DEFAULT OFF: Ephinea does not enforce them. Straight from the wiki's mag
        // pages — Elenor: "Originally, this Mag could only be equipped by android
        // characters. This was changed in an Ephinea update on January 9, 2017.";
        // Angel's Wing / Devil's Wing: "Originally, this Mag […] could not be
        // equipped by Androids. This was changed on an Ephinea update on January 9,
        // 2017." (And it was always a restriction on EQUIPPING the mag, never on
        // using the cell.) The rules are kept as an opt-in classic/vanilla-PSO
        // toggle only; enforcing them by default told honest Ephinea players that
        // perfectly legal mags were impossible.
        racialRestriction: false,
        // The value the session STARTED with. The live flag is a mutable player
        // setting; every change made after the first action is recorded in `log`
        // (see setRacialRestriction), so a replay needs the pre-session default
        // here rather than a snapshot of wherever the toggle happened to end up.
        _racial0: false,
        // Photon Blasts, up to 3, accumulated across the mag's evolutions (see
        // inheritPB). A FRESH mag starts with none; a CUSTOM start may already
        // hold some, and must — a real third-evolution mag learned its PBs at
        // levels 10/35/50 long before the player opened this simulator. Hard-
        // coding [] here started it with an empty rack and then promised it PBs
        // the player's actual mag can never get. Copied, never aliased: the start
        // object is reused by 重置 / exportSession.
        pbs: Array.isArray(src.pbs) ? [...src.pbs.slice(0, 3)] : [],
        log: [],
    };
    s._start = start;   // 供 exportSession / 重置复用
    return s;
}

const STAT_KEYS = ['def', 'pow', 'dex', 'mind'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function feedOnce(data, state, itemName) {
    if (data.magCells[itemName]) {
        // logged BEFORE the cell runs, so a resulting `evolve` entry lands
        // after its own feed line (the order checkEvolution's feeds produce).
        const entry = { kind: 'feedCell', item: itemName,
                        feeder: { ...state.feeder }, ok: false };
        state.log.push(entry);
        const events = checkCellEvolution(data, state, itemName);
        entry.ok = events.some((e) => e.type === 'evolve');
        const rejected = events.find((e) => e.type === 'magCellRejected');
        if (rejected) entry.reason = rejected.reason;   // shown in the history log
        return events;   // cells don't apply stat deltas
    }
    const events = [];
    const table = data.feedTables[data.mags[state.magId].feedTableId];
    const row = table[itemName]; // [DEF,POW,DEX,MIND,Sync,IQ]
    if (!row) throw new Error(`no feed row for ${itemName} in table`);

    // secondary stats
    state.synchro = clamp(state.synchro + row[4], 0, 120);
    state.iq = clamp(state.iq + row[5], 0, 200);

    const before = magLevel(state);
    // primary stats: progress accumulator with carry, respect 200 cap
    STAT_KEYS.forEach((k, i) => {
        const d = row[i];
        // A negative feed is ALL-OR-NOTHING. A reduction that would take the
        // hundredths bar below zero does not apply AT ALL — the bar is NOT
        // floored at zero, it is left exactly where it was. Aleron Ives
        // (pioneer2.net, "Mag feeding problem"), on a player's in-game
        // observation: "That is indeed how it works. If the bar has 1-14 points
        // in it, a reduction of 15 has no effect. Stats only go down if the bar
        // is filled far enough for the subtraction to take place without causing
        // a negative result, since Mags can't 'level down'." Corroborated by
        // tofuman ("attributes not reducing if the attribute reduction would
        // make it below 0"); Sodaboy confirms mag levelling/morphing is
        // client-side, so this is the game binary's own rule.
        //
        // So a Marutah with progress.mind = 3 fed a Trimate (MIND -15) keeps its
        // 3 — it does not burn the bar down to 0. There is no borrowing either:
        // mags never lose a level. (Flooring at zero is what the third-party
        // planner Magatama does; it is not what the game does.)
        if (d < 0 && state.progress[k] + d < 0) return;
        state.progress[k] += d;
        while (state.progress[k] >= 100) {
            if (magLevel(state) >= 200 || state[k] >= 200) { // capped
                state.progress[k] = 99; events.push({ type: 'capped', stat: k });
                break;
            }
            state[k] += 1; state.progress[k] -= 100;
        }
    });
    const after = magLevel(state);
    if (after > before) events.push({ type: 'levelUp', level: after });

    state.log.push({ kind: 'feed', item: itemName, feeder: { ...state.feeder } });
    events.push(...checkEvolution(data, state));
    return events;
}

// --- The classic-PSO race-rule toggle ----------------------------------------
// This is an ACTION, not a setting snapshot. exportSession used to write the
// flag once, at export time, while the UI mutated it live — so a link shared
// after the player had flipped it mid-run replayed a DIFFERENT mag: a cell that
// was rejected live got accepted on replay (and vice versa). Banks were promoted
// into the ordered action list for exactly this reason; the toggle was not.
//
// A change made BEFORE the first action is just the session's starting value
// (`_racial0`) and needs no log entry; anything later is an ordered action.
export function setRacialRestriction(state, on) {
    const next = !!on;
    if (state.racialRestriction === next) return [];
    state.racialRestriction = next;
    if (state.log.length === 0) state._racial0 = next;
    else state.log.push({ kind: 'racial', on: next });
    return [{ type: 'racialRestriction', on: next }];
}

// --- The bank / leave-game trick ---------------------------------------------
// Ephinea's own guide (Mags/Guide, "Advanced MIND Mag"):
//   "The Mag's stats end up being either 15/0/0/185 or 13/0/0/187 with a
//    time-consuming trick. […] When a Mag is put into the bank, any odd values
//    will round down to even values. Since odd values of DEF are common, this
//    can be used to lower how much total DEF the Mag has. If you bank after
//    every Monofluid, you should be able to just barely reach 13/0/0/22 by
//    Level 35."
// Depositing (or leaving the game) writes the mag back with each stat's
// FRACTIONAL progress — the hundredths, `state.progress` — rounded DOWN to the
// nearest even value. So a Monofluid's +5 hundredths of DEF banks as +4, and
// the shaved .01s add up to two whole DEF points by Lv200.
//
// It is NOT a feed: it touches `progress` only — never an integer stat, never
// the level, synchro, IQ or the PBs — and it must therefore NOT run an
// evolution check (a bank at Lv50 would otherwise evolve the mag for free).
export function bankMag(data, state) {
    STAT_KEYS.forEach((k) => { state.progress[k] -= state.progress[k] % 2; });
    state.log.push({ kind: 'bank' });
    return [{ type: 'banked' }];
}

// --- How long the plan really takes ------------------------------------------
// A mag accepts 3 feeds per feeding cycle (~210s). But banking is not free:
//   Miku: "quitting the game or depositing and withdrawing the mag […] will round
//   down all fractional levels to the nearest 0.02. HOWEVER, IT'LL START THE
//   TIMER FOR FEEDING THE MAG ALL OVER AGAIN so it may be time-consuming."
// So a bank ENDS the current cycle wherever it stands, and the guide's
// "bank after every Monofluid" route is 1 feed per cycle, not 3 — about three
// times the wall-clock time. Pricing every route at ceil(feeds / 3) told the
// player the 13/0/0/187 trick was free; the guide calls it "time-consuming" for
// exactly this reason.
//
// Walks the ORDERED log, because that is the only place the interleaving lives.
//
// A REJECTED mag cell (`feedCell` with `ok:false`) consumes NOTHING: the mag
// refuses it, so no item is spent, no feed slot is used and no meseta changes
// hands. It stays in the log — the player still wants to see *why* it failed —
// but it must not be billed. Everything that prices the log (feedCycles here,
// the UI's item counts and meseta total) filters through this one predicate.
export const consumesFeed = (e) =>
    e.kind === 'feed' || (e.kind === 'feedCell' && e.ok === true);

export function feedCycles(log) {
    let cycles = 0;
    let inCycle = 0;                       // feeds used out of this cycle's 3
    for (const e of log) {
        if (consumesFeed(e)) {
            if (inCycle === 0) cycles += 1;          // this feed opens a new cycle
            inCycle = (inCycle + 1) % 3;
        } else if (e.kind === 'bank') {
            inCycle = 0;                             // the timer restarts
        }
    }
    return cycles;
}

// --- Evolution engine --------------------------------------------------------
// Which stage keys on WHAT (from the wiki's own condition-line grammar):
//   Lv.10  `HU evolves Mag`             -> the FEEDER's class
//   Lv.35  `Evolves from Varuna`        -> the mag's LINEAGE (the only one)
//   Lv.50  `HU {{TypeA}} POW ≥ DEX ...` -> the FEEDER's class + Section-ID group
//   Lv.100 `Male HU {{Type1}} ...`      -> the FEEDER's class/gender/Section-ID Type
// Lineage = the first-evolution form (Varuna/Kalki/Vritra), fixed at Lv10, and
// used ONLY for the Lv.35 branch and its tie-break.
const LINEAGE_CLASS = { Varuna: 'HU', Kalki: 'RA', Vritra: 'FO' };

// strictly-max of POW/DEX/MIND; on a tie for max, return `tie`.
function argmaxStat(state, tie) {
    const v = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    const max = Math.max(v.POW, v.DEX, v.MIND);
    const top = ['POW', 'DEX', 'MIND'].filter(k => v[k] === max);
    return top.length === 1 ? top[0] : tie;
}

function idGroupAB(data, id) { return data.idGroups.A.includes(id) ? 'A' : 'B'; }

function idType(data, id) {
    if (data.idGroups.Type1.includes(id)) return 'Type1';
    if (data.idGroups.Type2.includes(id)) return 'Type2';
    return 'Type3';
}

// The single non-null formula on the Section-ID Type's leaf is the ONE equality
// that decides this evolution — the formula is a property of the Type, not of
// the stats. Testing "the first equality that holds globally" instead and then
// indexing the leaf with it silently SKIPPED the evolution whenever two
// equalities held at once (30/20/20/30 satisfies two) and the global winner was
// not the Type's own formula: the lookup returned null and nothing happened.
const FORMULA_TEST = {
    'DEF+POW=DEX+MIND': (s) => s.def + s.pow === s.dex + s.mind,
    'DEF+DEX=POW+MIND': (s) => s.def + s.dex === s.pow + s.mind,
    'DEF+MIND=POW+DEX': (s) => s.def + s.mind === s.pow + s.dex,
};

function stage4Next(leaf, state) {
    if (!leaf) return null;
    const formula = Object.keys(leaf).find((k) => leaf[k] !== null);
    if (!formula) return null;
    const test = FORMULA_TEST[formula];
    if (!test) throw new Error(`stage4: unknown formula ${formula}`);
    return test(state) ? leaf[formula] : null;
}

// --- stage 3: the wiki's ordered Lv.50 rows -----------------------------------
// Each class has SEVEN ordered rules; the FIRST one that holds wins, and the
// feeder's Section-ID group (A/B) picks the mag. The rules are `≥`/`>`/`=`
// chains over POW/DEX/MIND, evaluated left-to-right — a 5-token chain like
// `DEX = MIND > POW` asserts BOTH `DEX == MIND` and `MIND > POW`.
//
// The old 6-strict-permutation map plus one hard-coded tie row could not
// express this: it ranked the stats and broke ties by a fixed POW>DEX>MIND
// priority, so e.g. HU `DEX > MIND = POW` landed on 'DEX>POW>MIND' (Ila) when
// the wiki's row `DEX > MIND ≥ POW` says Nandin.
const RULE_OPS = {
    '>': (a, b) => a > b,
    '≥': (a, b) => a >= b,
    '=': (a, b) => a === b,
};

export function evalStage3Rule(cond, state) {
    const v = { POW: state.pow, DEX: state.dex, MIND: state.mind };
    const tok = cond.split(' ');
    for (let i = 0; i + 2 < tok.length; i += 2) {
        const op = RULE_OPS[tok[i + 1]];
        if (!op) throw new Error(`stage3 rule ${cond}: unknown operator ${tok[i + 1]}`);
        if (!op(v[tok[i]], v[tok[i + 2]])) return false;
    }
    return true;
}

// Keyed on the FEEDER's class (`f.class`), never on the mag's lineage — a
// Vritra-line mag fed by a Hunter takes the HU table. That is what makes
// "transfer the mag to another character" a real strategy.
function stage3Next(data, state, f) {
    const ev = data.evolution;
    const grp = idGroupAB(data, f.sectionId);
    // 1. FO's all-IDs DEF >= 45 override sits ahead of the rule rows — and it,
    //    too, keys on the feeder being a Force.
    if (f.class === 'FO' && state.def >= ev.stage3SpecialFO.minDef) {
        return argmaxStat(state, null) === 'POW'
            ? ev.stage3SpecialFO.powMax : ev.stage3SpecialFO.other;
    }
    // 2. the ordered rule rows: first match wins.
    const row = (ev.stage3Rules[f.class] || []).find((r) => evalStage3Rule(r.cond, state));
    return row ? row[grp] : null;
}

// A mag keeps every Photon Blast it learns, up to three: the first evolution
// fills slot 1, the second slot 2, the third slot 3 — but only if that PB is
// not already held. Magatama accumulates them the same way. (Fourth evolutions
// teach no PB at all — the wiki's Lv.100 rows have no 'PB Learned' column — so
// `mags[x].pb` is simply absent for them and this is a no-op.)
function inheritPB(data, state) {
    const pb = data.mags[state.magId] && data.mags[state.magId].pb;
    if (!pb || state.pbs.includes(pb) || state.pbs.length >= 3) return;
    state.pbs.push(pb);
}

export function checkEvolution(data, state) {
    const events = [];
    const ev = data.evolution;
    const f = state.feeder;
    const level = magLevel(state);
    const stageOf = (id) => data.mags[id].stage;
    const evolve = (next, stage) => {
        // Re-evolving into the form it already has is not an event: this is what
        // makes "check on every feed" quiet — feeding the SAME character over and
        // over at Lv50 lands on the same mag and produces nothing at all.
        if (!next || next === state.magId) return;
        const from = state.magId;
        state.magId = next;
        inheritPB(data, state);
        state.log.push({ kind: 'evolve', from, to: next, stage, level });
        events.push({ type: 'evolve', from, to: next, stage, level });
    };

    const stage = stageOf(state.magId);
    // Evolution LEVELS are discrete, not ranges. Wiki (Mags):
    //   "Third evolution Mags occur at level 50, and every five levels after that"
    //   "Fourth evolution Mags can occur beginning first at level 100, and every
    //    ten levels after that (110, 120, 130, etc.)"
    // A mag that overshoots one (49 -> 51 in a single feed) simply MISSES it and
    // waits for the next — which is exactly why the guide tells players to plan
    // "the level 49 -> 50 feed". The old 5-/10-wide sliding windows evolved at
    // levels 51/52/53/54 and, because the window slid only AFTER the check, never
    // fired at any boundary past the first (55, 60, 110, ...).
    //
    // There is NO "one evolution per evolution level" cap. This project invented
    // one out of the wiki's "a Mag can evolve again WITH ONE FEED during an
    // evolution level […] by transferring the Mag to a different character" —
    // but that sentence describes the TRIGGER (a single feed suffices; you need
    // not gain a level first), not a limit. Every primary source agrees:
    //   Aleron Ives (pioneer2.net, "Mag Evolution (Mag Locking)"): "The only Mags
    //     with locked evolutions are celled Mags and fourth evolutions. Even if
    //     you hack the server to 'lock' your level 200 evolution in place, your
    //     Mag will still evolve on the client when you feed it." (This line is
    //     Ives's, not Sodaboy's — Sodaboy posts in the same thread, but about
    //     server-vs-client packets.)
    //   Miku's mag-raising guide (pioneer2.net): "Any nonrare mag will still be
    //     able to transform every time it is fed if its level is any multiple of 5."
    //   Lemonilla/MagAi (github.com/Lemonilla/MagAi, c/feed.c), reverse-engineered
    //     from the game: the tier-3 gate is `lvl >= 50 && lvl % 5 == 0`, with no
    //     latch of any kind.
    // The latch also broke the recovery the wiki explicitly prescribes: "If a Mag
    // is leveled past 100 without evolving into a fourth evolution Mag […] it is
    // possible to transfer the Mag to another character that does have a fourth
    // evolution and feed the Mag once to evolve it." With a latch, a Lv200 mag
    // that had already re-evolved at 200 could never take that fourth evolution.
    const isStage3Level = level >= 50 && level % 5 === 0;
    const isStage4Level = level >= 100 && level % 10 === 0;

    // stage1: Lv10+, only from a fresh (stage 0) mag; by FEEDER class. No upper
    // bound, or a custom-start base Mag above Lv14 would be stuck at stage 0.
    if (stage === 0 && level >= 10) {
        evolve(ev.stage1[f.class], 1);
    }
    // stage2: Lv35+, from stage 0 or 1; by LINEAGE + max stat (lineage tie).
    else if (stage <= 1 && level >= 35) {
        const branch = ev.stage2[state.magId];
        if (branch) {
            const tie = ev.tieBreak[LINEAGE_CLASS[state.magId]];
            evolve(branch[argmaxStat(state, tie)], 2);
        }
    } else {
        // stage4: at 100, 110, 120, ...; from stage 3; by FEEDER class/gender/
        // Section-ID Type. Checked FIRST: level 100 is both a third- and a
        // fourth-evolution level, and the fourth evolution is the terminal one
        // (a mag that misses its stage-4 condition retries at 110, 120, ...).
        if (stage === 3 && isStage4Level) {
            const leaf = ((ev.stage4[f.class] || {})[f.gender] || {})[idType(data, f.sectionId)];
            evolve(stage4Next(leaf, state), 4);
        }
        // stage3: at 50, 55, 60, ...; by FEEDER class + Section ID. Open to a
        // stage-2 mag (its third evolution) AND to a stage-3 mag: the wiki says a
        // Mag "can evolve again every fifth level if another evolution condition
        // is met (e.g. the Mag is transferred to and fed by a different
        // character)" — "useful for the purposes of switching feeding tables".
        //
        // The stage is RE-READ, so a mag that just took its fourth evolution above
        // is excluded here: stage 4 is terminal.
        const st = stageOf(state.magId);
        if ((st === 2 || st === 3) && isStage3Level) {
            evolve(stage3Next(data, state, f), 3);
        }
    }

    return events;
}

// --- Mag Cells ---------------------------------------------------------------
// Mag Cells force an evolution directly (no stat feed, no level window) once
// their target-specific gates pass. A cell may list one or two possible
// targets; the first target whose gates pass wins.
//
// Every gate below is a key the generator parses out of the wiki's "Evolution
// Conditions" column (and keeps verbatim in `req.raw`). `minCharLevel` is the
// one gate deliberately NOT enforced: the sim models the mag, not the
// character, so it is carried in the data for display only.

// "35+ in all Mag stats" / "70+ in two Mag stats" — DEF/POW/DEX/MIND only.
function statThresholdOk(state, { value, count }) {
    const n = STAT_KEYS.filter((k) => state[k] >= value).length;
    return count === 'all' ? n === STAT_KEYS.length : n >= count;
}

// The cell's racial restriction (magCells[cell].raceRule — only three cells
// carry one). OFF unless the player opts into the classic/vanilla-PSO rules:
// Ephinea dropped these on 2017-01-09 (see createState). INDEPENDENT of every
// other gate: it keys on the *feeder's race*, not on the mag, so it is checked
// once, up front, for the whole cell.
// A feeder with no `race` (an old share link, a hand-built state) is never
// blocked by a `deny` rule — it can only fail an `only` rule.
// Returns a rejection reason, or null when the cell is allowed.
function raceRejection(cell, state) {
    const rule = cell.raceRule;
    if (!rule || !state.racialRestriction) return null;
    const race = state.feeder.race;
    if (rule.deny && race && rule.deny.includes(race)) {
        return `${RACE_ZH[race] || race}无法使用该 cell`;
    }
    if (rule.only && !rule.only.includes(race)) {
        return `仅${rule.only.map((r) => RACE_ZH[r] || r).join('/')}可使用该 cell`;
    }
    return null;
}
const RACE_ZH = { Human: '人类', Newman: '新人类', Android: '机器人' };

export function checkCellEvolution(data, state, cellName) {
    const cell = data.magCells[cellName];
    const lvl = magLevel(state);
    const cur = data.mags[state.magId]?.stage;
    const reject = (reason) => [{ type: 'magCellRejected', cell: cellName, reason }];
    // A stage-4 rare mag can only re-evolve via a whitelisted cell.
    if (cur === 4 && !cell.reEvoWhitelist) return reject('稀有 mag 无法再进化');
    const raceReason = raceRejection(cell, state);
    if (raceReason) return reject(raceReason);

    const targets = Array.isArray(cell.target) ? cell.target : [cell.target];
    for (const tgt of targets) {
        const req = (cell.requires && cell.requires[tgt]) || {};
        const species = req.requiresMag
            && (Array.isArray(req.requiresMag) ? req.requiresMag : [req.requiresMag]);
        if (species && !species.includes(state.magId)) continue;                        // species gate
        if (req.requiredStage !== undefined && cur !== req.requiredStage) continue;     // "third evolution Mag"
        if (req.minMagLevel && lvl < req.minMagLevel) continue;                         // mag-level gate
        if (req.race && idGroupAB(data, state.feeder.sectionId) !== req.race) continue; // Section-ID group gate
        if (req.minSynchro && state.synchro < req.minSynchro) continue;
        if (req.minIQ && state.iq < req.minIQ) continue;
        if (req.statThreshold && !statThresholdOk(state, req.statThreshold)) continue;

        const from = state.magId;
        state.magId = tgt;
        inheritPB(data, state);   // cell mags are 4th evolutions and teach no PB
        const stage = data.mags[tgt]?.stage;
        state.log.push({ kind: 'evolve', from, to: tgt, stage, level: lvl, viaCell: cellName });
        return [{ type: 'evolve', from, to: tgt, stage, level: lvl, viaCell: cellName }];
    }
    return reject('未满足该 cell 的进化条件');
}

// --- Session export / replay --------------------------------------------------
// Exports the ordered feed/feedCell/bank log (each feed entry carrying the
// feeder snapshot at the moment of that feed) plus the original start config, so
// a session can be losslessly reconstructed from data + this record alone.
//
// Banks and race-rule toggles are part of the ORDER, not a count/snapshot: the
// whole point of the bank trick is *when* you bank (after every Monofluid), and
// a toggle flipped mid-run decides which cell feeds were accepted. A `feeds`
// list that dropped either would replay a shared 13/0/0/187 plan as a 15/0/0/185
// mag, or accept a cell that was rejected live. They ride in the same list as
// `{ action: 'bank' }` / `{ action: 'racial', on }`; an entry without `action`
// is a feed, which is exactly what every link shared before this existed looks
// like. `racialRestriction` stays as a top-level scalar — but it is the value the
// session STARTED with, so old links (scalar only, no actions) still replay.
export function exportSession(state) {
    const ACTIONS = { feed: 1, feedCell: 1, bank: 1, racial: 1 };
    const action = (e) => {
        if (e.kind === 'bank') return { action: 'bank' };
        if (e.kind === 'racial') return { action: 'racial', on: e.on };
        return { item: e.item, feeder: { ...e.feeder } };
    };
    return {
        start: state._start,               // createState 时存下的 start 参数
        racialRestriction: state._racial0 ?? state.racialRestriction,
        feeds: state.log.filter((e) => ACTIONS[e.kind]).map(action),
        final: { magId: state.magId, def: state.def, pow: state.pow,
                 dex: state.dex, mind: state.mind, synchro: state.synchro,
                 iq: state.iq, level: magLevel(state), pbs: [...state.pbs] },
    };
}
export function replaySession(data, session) {
    const s = createState(data, { start: session.start });
    // absent in links shared before the toggle existed -> the engine default
    if (session.racialRestriction !== undefined) {
        s.racialRestriction = s._racial0 = !!session.racialRestriction;
    }
    for (const f of session.feeds) {
        if (f.action === 'bank') { bankMag(data, s); continue; }
        // Applied IN ORDER, so the feeds before it see the old rule and the feeds
        // after it see the new one — the whole point of logging the toggle.
        if (f.action === 'racial') { setRacialRestriction(s, f.on); continue; }
        s.feeder = { ...f.feeder };
        feedOnce(data, s, f.item);
    }
    return s;
}

// browser (non-module) global
if (typeof window !== 'undefined') {
    window.MagSimEngine = { magLevel, createState, feedOnce, bankMag, setRacialRestriction,
        feedCycles, consumesFeed, checkEvolution, checkCellEvolution, evalStage3Rule,
        exportSession, replaySession };
}
