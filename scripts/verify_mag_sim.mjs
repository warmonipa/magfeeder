/* Engine unit tests. Run: node scripts/verify_mag_sim.mjs */
import { readFileSync } from 'node:fs';
import { createState, magLevel, feedOnce, bankMag, checkEvolution, checkCellEvolution,
         setRacialRestriction, feedCycles, consumesFeed, exportSession, replaySession }
    from '../assets/js/mag-sim-engine.js';

const src = readFileSync('assets/js/mag-sim-data.js', 'utf8');
const win = {};
new Function('window', src)(win);
const DATA = win.MAG_SIM;

let failed = 0;
const check = (n, c) => { if (c) console.log(`  ok   ${n}`); else { console.error(`  FAIL ${n}`); failed++; } };

// --- createState
const s = createState(DATA, { start: { mode: 'fresh' } });
check('fresh 起始 level 5', magLevel(s) === 5);
check('fresh DEF 5 其余 0', s.def === 5 && s.pow === 0 && s.mind === 0);
check('fresh synchro 20 iq 0', s.synchro === 20 && s.iq === 0);
check('fresh magId=Mag', s.magId === 'Mag');
// There is no sliding "evolution window", and no per-level latch either.
// Evolution LEVELS are discrete (50/55/60… and 100/110/120…) and the check is
// re-run on EVERY feed — the state carries nothing about past evolutions.
check('state 上不再有 window 字段', s.window === undefined);
check('state 上不再有 lastEvoLevel 字段（每次喂食都重新判定）',
  s.lastEvoLevel === undefined);

check('fresh 起始没有 PB', Array.isArray(s.pbs) && s.pbs.length === 0);

// --- createState: a CUSTOM start keeps its Photon Blasts -----------------------
// A custom third-evolution mag has, in reality, already learned its PBs at levels
// 10 / 35 / 50 — createState hard-coded `pbs: []` even for mode:'custom', so the
// sim started such a mag with an empty rack and then promised it PBs the player's
// real mag can never get (it would have to un-learn and re-learn them).
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Bana',
    def: 5, pow: 0, dex: 0, mind: 95, synchro: 20, iq: 0,
    pbs: ['Farlla', 'Mylla & Youlla', 'Estlla'] } });
  check('custom 起始保留 PB（三阶 mag 早就学会了 10/35/50 的 PB）',
    t.pbs.join() === 'Farlla,Mylla & Youlla,Estlla');
}
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Bana',
    def: 5, pow: 0, dex: 0, mind: 95, synchro: 20, iq: 0,
    pbs: ['Farlla', 'Golla', 'Estlla', 'Pilla', 'Leilla'] } });
  check('custom 起始最多只取前 3 个 PB', t.pbs.length === 3
    && t.pbs.join() === 'Farlla,Golla,Estlla');
}
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Bana',
    def: 5, pow: 0, dex: 0, mind: 95, synchro: 20, iq: 0 } });
  check('custom 起始未给 PB → 空数组（不是 undefined）',
    Array.isArray(t.pbs) && t.pbs.length === 0);
}
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Bana',
    def: 5, pow: 0, dex: 0, mind: 95, synchro: 20, iq: 0, pbs: 'Farlla' } });
  check('custom 起始 pbs 不是数组 → 忽略', Array.isArray(t.pbs) && t.pbs.length === 0);
}
// The start's array must not be ALIASED: feeding the mag must never mutate the
// caller's start object (which the UI reuses for 重置 and exportSession).
{
  const start = { mode: 'custom', magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2,
    synchro: 20, iq: 0, pbs: ['Farlla'] };
  const t = createState(DATA, { start });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' };
  feedOnce(DATA, t, 'Star Atomizer');   // -> Yaksa, learns Golla
  check('custom 起始的 pbs 数组被复制，不是引用（喂食不会污染 start）',
    start.pbs.join() === 'Farlla' && t.pbs.join() === 'Farlla,Golla');
}
// …and a custom start with a full rack learns nothing more on re-evolution.
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Rudra',
    def: 41, pow: 2, dex: 5, mind: 2, synchro: 20, iq: 0,
    pbs: ['Farlla', 'Mylla & Youlla', 'Estlla'] } });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('custom 起始 PB 已满 3 槽 → 三阶进化学不到新 PB',
    t.magId === 'Yaksa' && t.pbs.join() === 'Farlla,Mylla & Youlla,Estlla');
}
// A custom start round-trips through export/replay with its PBs intact.
{
  const start = { mode: 'custom', magId: 'Bana', def: 5, pow: 0, dex: 0, mind: 95,
    synchro: 20, iq: 0, pbs: ['Farlla', 'Estlla'] };
  const t = createState(DATA, { start });
  const replayed = replaySession(DATA, exportSession(t));
  check('custom 起始的 PB 经导出→回放后仍在', replayed.pbs.join() === 'Farlla,Estlla');
}

// --- feedOnce: stat progress, carry, caps
{
  const t = createState(DATA, { start: { mode: 'fresh' } }); // DEF5
  feedOnce(DATA, t, 'Monomate'); // Table0: DEF+5 POW+40 DEX+5 MIND0 Sync+3 IQ+3
  check('喂 Monomate 后 progress POW=40', t.progress.pow === 40);
  check('喂 Monomate 后 synchro 23', t.synchro === 23);
  check('单喂不升级（progress<100）', magLevel(t) === 5);
}
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  for (let i = 0; i < 3; i++) feedOnce(DATA, t, 'Trimate'); // POW+50 ×3 = 150
  check('POW 150 经验 → +1 级 progress 50', t.pow === 1 && t.progress.pow === 50);
}
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.synchro = 119; feedOnce(DATA, t, 'Monomate'); // +3 → 夹到 120
  check('synchro 封顶 120', t.synchro === 120);
}

// --- evolution engine
// checkEvolution export exists
check('checkEvolution 已导出', typeof checkEvolution === 'function');

const cs = (o) => createState(DATA, { start: { mode: 'custom', synchro: 20, iq: 0, ...o } });
function feedN(state, item, n) { for (let i = 0; i < n; i++) feedOnce(DATA, state, item); }
// Star Atomizer exists in every feed table and is all-positive & small, so a
// single feed from progress 0 never crosses 100 -> stats & level stay put,
// which triggers a window check exactly on the mag's current level.

// stage1 by FEEDER class: HU -> Varuna
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedN(t, 'Trimate', 10);
  check('Lv10 stage1 HU -> Varuna', t.magId === 'Varuna' && DATA.mags[t.magId].stage === 1);
}
// stage1 by feeder class FO -> Vritra (proves stage1 keys on feeder.class)
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'FO', gender: 'M', sectionId: 'Viridia' };
  feedN(t, 'Trimate', 10);
  check('Lv10 stage1 FO -> Vritra', t.magId === 'Vritra');
}

// stage2 by LINEAGE + max stat: Varuna + POW -> Rudra, even with feeder RA
{
  const t = cs({ magId: 'Varuna', def: 20, pow: 15, dex: 0, mind: 0 }); // level 35
  t.feeder = { class: 'RA', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv35 Varuna+POW -> Rudra (lineage, feeder RA ignored)', t.magId === 'Rudra');
}
// stage2 tie broken by LINEAGE tie-break, not feeder: POW==DEX (both max),
// lineage Varuna=HU tie=POW -> Rudra (feeder RA tie=DEX would give Marutah)
{
  const t = cs({ magId: 'Varuna', def: 20, pow: 7, dex: 7, mind: 1 }); // level 35
  t.feeder = { class: 'RA', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv35 tie POW==DEX -> Rudra via lineage HU (not Marutah)', t.magId === 'Rudra');
}

// stage3 by the wiki's ordered rules: Rudra, POW ≥ DEX ≥ MIND, HU feeder, ID A -> Varaha
{
  const t = cs({ magId: 'Rudra', def: 48, pow: 2, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // group A
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 stage3 HU/A POW ≥ DEX ≥ MIND -> Varaha',
    t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}
// === EVOLUTION LEVELS ARE DISCRETE ==========================================
// Wiki (Mags#Third evolution Mags): "Third evolution Mags occur at level 50,
// and every five levels after that". (Mags#Fourth evolution Mags): "Fourth
// evolution Mags can occur beginning first at level 100, and every ten levels
// after that (110, 120, 130, etc.)". And: "a Mag can evolve again with ONE feed
// during an evolution level (e.g. the Mag is currently level 50, 55, 75, etc.)".
//
// These tests are the ones whose ABSENCE let the sliding-window bug ship: every
// evolution assertion in this suite used to sit at exactly Lv50 or Lv100 — the
// only two levels at which the (wrong) 5-/10-wide sliding windows happened to
// agree with the wiki. Nothing ever fed a mag through 55, 60 or 110.

// A stage-2 mag that arrives at Lv55 evolves on the FIRST feed at 55 — 55 is an
// evolution level in its own right, there is no window to "slide" to it.
{
  const t = cs({ magId: 'Rudra', def: 53, pow: 2, dex: 0, mind: 0 }); // level 55
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer'); // 55 % 5 === 0 -> evolves right here
  check('Lv55 是进化等级：二段 mag 首次喂食即三段进化',
    magLevel(t) === 55 && t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}
// ...and so is Lv60.
{
  const t = cs({ magId: 'Rudra', def: 58, pow: 2, dex: 0, mind: 0 }); // level 60
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv60 是进化等级：二段 mag 首次喂食即三段进化',
    magLevel(t) === 60 && DATA.mags[t.magId].stage === 3);
}
// (a) OVERSHOOT: a mag that jumps 49 -> 51 in one feed MISSES level 50 and does
// NOT evolve — that is exactly why the guide tells players to plan the 49 -> 50
// feed. It then evolves when it later LANDS on 55.
// (The old suite asserted the opposite — "Lv49 -> 51 overshoot still evolves at
// stage3" — because the broken window covered the whole range 50..54.)
{
  const t = cs({ magId: 'Rudra', def: 47, pow: 2, dex: 0, mind: 0 }); // level 49
  t.progress.def = 99; t.progress.pow = 99;
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };      // group A
  feedOnce(DATA, t, 'Star Atomizer'); // def+1 pow+1 -> level 51, jumps clean over 50
  check('Lv49 -> 51 跳过 50：不进化（仍是二段 Rudra）',
    magLevel(t) === 51 && t.magId === 'Rudra' && DATA.mags[t.magId].stage === 2);
  // keep feeding: 52, 53, 54 are NOT evolution levels either.
  for (let i = 0; i < 200 && magLevel(t) < 55; i++) {
    feedOnce(DATA, t, 'Star Atomizer');
    if (magLevel(t) < 55) {
      check(`Lv${magLevel(t)} 不是进化等级：仍是二段`,
        DATA.mags[t.magId].stage === 2);
    }
  }
  check('错过 50 的 mag 在 Lv55 进化', magLevel(t) === 55 && t.magId === 'Varaha');
}
// (b) the same for the fourth evolution: a Lv99 stage-3 mag that jumps to 102
// misses the Lv100 evolution and stays a third-evolution mag.
{
  const t = cs({ magId: 'Varaha', def: 40, pow: 30, dex: 9, mind: 20 }); // level 99
  t.progress.def = 99; t.progress.pow = 99; t.progress.dex = 99;
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer'); // -> 41/31/10/20 = Lv102 (DEF+DEX=POW+MIND holds)
  check('Lv99 -> 102 跳过 100：不四段进化（公式成立也没用）',
    magLevel(t) === 102 && t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}
// (c) the Lv110 LANDING feed: a stage-3 mag that satisfies its Type's stage-4
// formula evolves on the feed that lands it on 110 — not one feed later, and not
// never (the old sliding window fired only at 100 and could never reach 110).
{
  const t = cs({ magId: 'Varaha', def: 44, pow: 30, dex: 10, mind: 25 }); // level 109
  t.progress.def = 99;
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer'); // def 44 -> 45: 45/30/10/25 = Lv110, DEF+DEX=POW+MIND (55=55)
  check('Lv110 落地喂食：HU/M/Type1 公式成立 → Deva（就在这一喂）',
    magLevel(t) === 110 && t.magId === 'Deva' && DATA.mags[t.magId].stage === 4);
}
// (d) non-evolution levels never evolve anything: 51-54 (stage2 mag) and
// 101/105 (stage3 mag whose Type formula DOES hold, so only the LEVEL can stop it).
for (const lvl of [51, 52, 53, 54]) {
  const t = cs({ magId: 'Rudra', def: lvl - 2, pow: 2, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check(`Lv${lvl} 不是三段进化等级 → 不进化`,
    magLevel(t) === lvl && t.magId === 'Rudra');
}
// 101 / 102 / 105 are not FOURTH-evolution levels. All three states below have
// POW ≥ DEX ≥ MIND, so the HU/A third-evolution rule maps Varaha back onto
// Varaha — the stage-3 path is a guaranteed no-op and ONLY a stage-4 evolution
// could change the mag. (105 *is* a third-evolution level; that is the point.)
// Lv102 additionally satisfies Type1's DEF+DEX = POW+MIND (51 = 51), so there
// the level gate is the ONLY thing standing between it and Deva.
for (const [lvl, st] of [[101, { def: 20, pow: 40, dex: 30, mind: 11 }],
                         [102, { def: 21, pow: 40, dex: 30, mind: 11 }],
                         [105, { def: 24, pow: 40, dex: 30, mind: 11 }]]) {
  const t = cs({ magId: 'Varaha', ...st });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer');
  check(`Lv${lvl} 不是四段进化等级 → 不进化（仍是三段 Varaha）`,
    magLevel(t) === lvl && t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}
check('Lv102 的构造确实满足 Type1 公式 DEF+DEX = POW+MIND（51 = 51）',
  21 + 30 === 40 + 11);
// (e) a custom-start base Mag above Lv14 (the setup dropdown offers exactly
// this) must still take its stage1 evolution, not be stuck at stage 0 forever.
// Stages 1 and 2 have NO "every N levels" rule — they are plain `level >=` gates.
{
  const t = cs({ magId: 'Mag', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('custom Mag at Lv50 evolves (stage1 has no upper bound)', t.magId === 'Varuna');
}
{
  const t = cs({ magId: 'Mag', def: 51, pow: 0, dex: 0, mind: 0 }); // level 51 — NOT an evo level
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv51 的 stage0 mag 照样一段进化（一/二段无“每 N 级”规则）',
    t.magId === 'Varuna');
}
// (f) a stage-3 mag sitting on a NON-evolution level (121) never evolves, no
// matter how many times it is fed.
{
  const t = cs({ magId: 'Varaha', def: 121, pow: 0, dex: 0, mind: 0 }); // level 121
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  feedN(t, 'Star Atomizer', 3);
  check('Lv121 三段 mag 反复喂食也不进化', t.magId === 'Varaha');
}
// (g) THE REAL RULE: a third-evolution mag re-evolves on EVERY feed taken while
// it sits on an evolution level. There is NO "one evolution per evolution level"
// cap — that rule was invented here out of the wiki's
//   "a Mag can evolve again with ONE feed during an evolution level […] by
//    transferring the Mag to a different character"
// which describes the TRIGGER (one feed suffices; you need not level up again),
// not a cap. Corroborated three ways:
//   Sodaboy (Ephinea admin): "The only Mags with locked evolutions are celled
//     Mags and fourth evolutions."
//   Miku's guide: "Any nonrare mag will still be able to transform every time it
//     is fed if its level is any multiple of 5."
//   Lemonilla/MagAi (decompiled from the game binary): tier-3 gate is
//     `lvl>=50 && lvl%5==0`, with no latch of any kind.
// So: alternate the feeder at Lv50 and the mag flips form EVERY feed.
{
  const t = cs({ magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2 }); // level 50
  const evolves = [];
  for (let i = 0; i < 4; i++) {
    // HU/B -> Yaksa, RA/B -> Varaha: alternating feeders, each with its own answer
    t.feeder = { class: i % 2 === 0 ? 'HU' : 'RA', gender: 'M', race: 'Human',
                 sectionId: 'Greenill' };
    evolves.push(...feedOnce(DATA, t, 'Star Atomizer').filter((e) => e.type === 'evolve'));
  }
  check('Lv50 反复喂食 + 交替职业 → 每一喂都重新进化（4 次喂食 4 次进化）',
    evolves.length === 4 && magLevel(t) === 50);
  check('Lv50 交替职业 → 在两种形态之间来回切换（HU=Yaksa / RA=Varaha）',
    evolves.map((e) => e.to).join() === 'Yaksa,Varaha,Yaksa,Varaha');
  check('state 上不再有 lastEvoLevel 闩锁', t.lastEvoLevel === undefined);
}
// …and feeding the SAME character produces no event at all: the mag re-runs the
// check, lands on the form it already has, and evolve() early-returns.
{
  const t = cs({ magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' };
  const first = feedOnce(DATA, t, 'Star Atomizer').filter((e) => e.type === 'evolve');
  const rest = [];
  for (let i = 0; i < 3; i++) {
    rest.push(...feedOnce(DATA, t, 'Star Atomizer').filter((e) => e.type === 'evolve'));
  }
  check('Lv50 同一角色反复喂食 → 只有第一次进化，之后没有任何事件',
    first.length === 1 && first[0].to === 'Yaksa' && rest.length === 0
    && t.magId === 'Yaksa');
  check('Lv50 同一角色反复喂食 → 日志里只有一条 evolve',
    t.log.filter((e) => e.kind === 'evolve').length === 1);
}
// A Lv200 third-evolution mag re-evolves on EVERY feed when the feeder changes.
// (Level 200 is capped, so the stats never move — the ONLY variable is who feeds.)
// 5/60/50/85 satisfies NONE of the three stat-balance formulas (DEF+POW=65,
// DEF+DEX=55, DEF+MIND=90, and at Lv200 each would have to be 100), so no feeder
// can end the run with a fourth evolution: the mag stays on the stage-3 carousel.
{
  const t = cs({ magId: 'Bana', def: 5, pow: 60, dex: 50, mind: 85 }); // level 200
  const evolves = [];
  for (const cls of ['RA', 'FO', 'HU', 'RA']) {   // Kabanda, Kumara, Bana, Kabanda
    t.feeder = { class: cls, gender: 'M', race: 'Human', sectionId: 'Greenill' };
    evolves.push(...feedOnce(DATA, t, 'Star Atomizer').filter((e) => e.type === 'evolve'));
  }
  check('Lv200 三阶 mag：每换一次喂食者就重新进化一次（200 不是终点）',
    evolves.length === 4 && evolves.every((e) => e.level === 200 && e.stage === 3));
  check('Lv200 三阶 mag：形态跟着喂食者走（Kabanda→Kumara→Bana→Kabanda）',
    evolves.map((e) => e.to).join() === 'Kabanda,Kumara,Bana,Kabanda');
  check('Lv200 三阶 mag 的四维在满级后不再变化（只有喂食者在变）',
    `${t.def}/${t.pow}/${t.dex}/${t.mind}` === '5/60/50/85' && magLevel(t) === 200);
}
// The wiki's PRESCRIBED RECOVERY, which the invented latch made impossible:
//   "If a Mag is leveled past 100 without evolving into a fourth evolution Mag
//    (due to the character who performed the level 100 feed not having the
//    correct formula), it is possible to transfer the Mag to another character
//    that does have a fourth evolution and feed the Mag once to evolve it."
// A Lv200 Bana 5/50/50/95 fed on HU/M/Viridia (Type1) fails the stage-4 formula
// and merely re-evolves as a third-evolution mag. Transferring it to HU/M/Oran
// (Type2, whose formula DOES hold) must still produce the fourth evolution.
{
  const t = cs({ magId: 'Bana', def: 5, pow: 50, dex: 50, mind: 95 }); // level 200
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv200 在“公式不成立”的角色上喂一口 → 仍是三阶（没有四阶）',
    DATA.mags[t.magId].stage === 3);
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Oran' }; // Type2
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv200 转到“公式成立”的角色上再喂一口 → 四阶进化（wiki 明写的补救路线）',
    DATA.mags[t.magId].stage === 4 && magLevel(t) === 200);
}
// A stage-3 re-evolution DOES pick up a new Photon Blast when a slot is free:
//   "If the Mag does not learn a Photon Blast at level 50, it may learn another
//    one if it evolves again into another Mag that has a Photon Blast not
//    previously learned."
{
  const t = cs({ magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' };
  feedOnce(DATA, t, 'Star Atomizer');                       // -> Yaksa   (PB Golla)
  const pbAfterFirst = [...t.pbs];
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');                       // -> Nandin  (PB Estlla)
  check('三阶再进化：有空槽且新形态的 PB 未持有 → 学到新 PB',
    t.magId === 'Nandin' && pbAfterFirst.join() === 'Golla'
    && t.pbs.length === 2 && t.pbs.includes(DATA.mags['Nandin'].pb));
  check('三阶再进化：旧 PB 不会被顶掉', pbAfterFirst.every((pb) => t.pbs.includes(pb)));
}
// …but a full PB rack (3) never grows, and PBs are never duplicated.
{
  const t = cs({ magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2 }); // level 50
  t.pbs = ['Farlla', 'Mylla & Youlla', 'Estlla'];
  for (const cls of ['HU', 'RA', 'FO', 'HU']) {
    t.feeder = { class: cls, gender: 'M', race: 'Human', sectionId: 'Greenill' };
    feedOnce(DATA, t, 'Star Atomizer');
  }
  check('三阶反复再进化：PB 槽满 3 个后不再增加，也不重复',
    t.pbs.length === 3 && new Set(t.pbs).size === 3);
}
// Stage 4 is still TERMINAL: a fourth-evolution mag sitting on an evolution
// level never falls back onto the stage-3 path, no matter who feeds it.
{
  const t = cs({ magId: 'Deva', def: 40, pow: 30, dex: 10, mind: 20 }); // level 100, stage4
  for (const cls of ['HU', 'RA', 'FO']) {
    t.feeder = { class: cls, gender: 'M', race: 'Human', sectionId: 'Greenill' };
    feedOnce(DATA, t, 'Star Atomizer');
  }
  check('四阶是终点：Lv100 的四阶 mag 换任何职业喂食都不会退回三阶路径',
    t.magId === 'Deva' && !t.log.some((e) => e.kind === 'evolve'));
}
// Evolution-level coverage beyond 50/55/60/100/110: a stage-2 mag takes its
// third evolution at 105, 150, 195 and 200 too (level >= 50 && level % 5 === 0).
for (const lvl of [105, 150, 195, 200]) {
  const t = cs({ magId: 'Rudra', def: lvl - 9, pow: 2, dex: 5, mind: 2 });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' };
  check(`Lv${lvl} 构造正确`, magLevel(t) === lvl);
  feedOnce(DATA, t, 'Star Atomizer');
  check(`Lv${lvl} 是三段进化等级 → 二阶 Rudra 进化为 Yaksa`,
    t.magId === 'Yaksa' && DATA.mags[t.magId].stage === 3);
}
// …and the fourth evolution really does fire at 150 and 200, not just 100/110.
// (Type1's formula DEF+DEX = POW+MIND forces level = 2·(POW+MIND), so each stat
// line is spelled out rather than derived from the level.)
for (const [lvl, st] of [[150, { def: 40, pow: 40, dex: 35, mind: 35 }],
                         [200, { def: 60, pow: 50, dex: 40, mind: 50 }]]) {
  const t = cs({ magId: 'Varaha', ...st });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // Type1
  check(`Lv${lvl} 构造正确（DEF+DEX=POW+MIND 成立）`,
    magLevel(t) === lvl && t.def + t.dex === t.pow + t.mind);
  feedOnce(DATA, t, 'Star Atomizer');
  check(`Lv${lvl} 是四段进化等级 → Deva`,
    t.magId === 'Deva' && DATA.mags[t.magId].stage === 4);
}

// stage3 tie case (non-FO): Rudra HU, DEX==MIND > POW -> tie mag Varaha (A),
// NOT strict-perm Nandin (DEX>MIND>POW/A).
{
  const t = cs({ magId: 'Rudra', def: 43, pow: 1, dex: 3, mind: 3 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // A
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 stage3 tie DEX==MIND>POW/A -> Varaha (tie beats strict Nandin)',
    t.magId === 'Varaha');
}

// FO special (POW strictly max, DEF>=45) -> Andhaka
{
  const t = cs({ magId: 'Namuci', def: 45, pow: 5, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'FO', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('FO DEF>=45 POW-max -> Andhaka', t.magId === 'Andhaka');
}
// The FO special sits AHEAD of the rule rows: DEF>=45 with POW not strictly max
// -> Bana, even though the rule rows would match `POW = DEX > MIND` -> Naga (A).
{
  const t = cs({ magId: 'Namuci', def: 45, pow: 2, dex: 2, mind: 1 }); // level 50
  t.feeder = { class: 'FO', gender: 'M', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('FO 特例优先于规则行（POW 非严格最大）-> Bana', t.magId === 'Bana');
}

// stage4 -> Deva: HU/M/Type1, whose one formula is DEF+DEX=POW+MIND
{
  const t = cs({ magId: 'Varaha', def: 40, pow: 30, dex: 10, mind: 20 }); // level 100
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv100 HU/M/Type1 DEF+DEX=POW+MIND -> Deva',
    t.magId === 'Deva' && DATA.mags[t.magId].stage === 4);
}

// --- BUG 4: the stage-4 formula comes FROM the Section-ID Type's leaf --------
// Each leaf carries exactly ONE non-null formula. The engine used to pick the
// first equality that held GLOBALLY and then index the leaf with it — so when
// two equalities held at once and the global winner was not the Type's own
// formula, the lookup returned null and the evolution was silently skipped.
// 30/20/20/30 satisfies BOTH DEF+POW=DEX+MIND (50=50, the global first) and
// Type1's DEF+DEX=POW+MIND (50=50). The wiki says Deva; we used to give nothing.
{
  const t = cs({ magId: 'Varaha', def: 30, pow: 20, dex: 20, mind: 30 }); // level 100
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv100 HUmar/Viridia 30/20/20/30 → Deva（公式取自 Type 的槽位）',
    t.magId === 'Deva' && DATA.mags[t.magId].stage === 4);
}
// ...and the Type's formula genuinely NOT holding still leaves the mag at stage3.
// (This test used to feed 25/25/25/25 and assert "no evolution" — but Type1's
// formula DOES hold there, so it was asserting the bug. It now uses a state
// where DEF+DEX (75) != POW+MIND (25).)
{
  const t = cs({ magId: 'Varaha', def: 50, pow: 25, dex: 25, mind: 0 }); // level 100
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // Type1
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv100 Type1 公式不成立 → 仍是三段 Varaha',
    t.magId === 'Varaha' && DATA.mags[t.magId].stage === 3);
}

// --- BUG 5: a third-evolution mag re-evolves every FIFTH level ---------------
// Wiki (Mags#Evolution): "after level 50, Mags can evolve again every fifth
// level if another evolution condition is met (e.g. the Mag is transferred to
// and fed by a different character)" — "useful for the purposes of switching
// feeding tables". The stage-3 branch used to be gated on `stage === 2`, so a
// third-evolution mag could never change again and the sliding window was dead.
// It re-evolves on the FIRST feed at the evolution level — 55 is an evolution
// level, there is no window that has to catch up to it.
{
  const t = cs({ magId: 'Varaha', def: 53, pow: 2, dex: 0, mind: 0 }); // level 55, stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' }; // B
  feedOnce(DATA, t, 'Star Atomizer'); // 55 is an evolution level -> re-evolve on the B table
  check('Lv55 换 Section ID 组 → 三段 mag 首喂即重新进化 Varaha → Kama',
    magLevel(t) === 55 && t.magId === 'Kama' && DATA.mags[t.magId].stage === 3);
}
{
  // ...and switching the feeder's CLASS re-evolves it onto that class's table.
  const t = cs({ magId: 'Varaha', def: 53, pow: 2, dex: 0, mind: 0 }); // level 55, stage3
  t.feeder = { class: 'RA', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // A
  feedOnce(DATA, t, 'Star Atomizer'); // RA/A POW > DEX ≥ MIND -> Kama
  check('Lv55 换喂食者职业 → 三段 mag 走 RA 表（Varaha → Kama）',
    magLevel(t) === 55 && t.magId === 'Kama');
}
{
  // ...and it works at Lv60 too (the old sliding window could never reach it).
  const t = cs({ magId: 'Varaha', def: 58, pow: 2, dex: 0, mind: 0 }); // level 60, stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' }; // B
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv60 换 Section ID 组 → 三段 mag 重新进化 Varaha → Kama',
    magLevel(t) === 60 && t.magId === 'Kama');
}
{
  // a FOURTH-evolution mag must NOT re-evolve through the stage-3 rules — at a
  // stage-3 evolution level (55) or at a level that is BOTH (100, 110).
  for (const def of [53, 98, 108]) {   // levels 55, 100, 110
    const t = cs({ magId: 'Deva', def, pow: 2, dex: 0, mind: 0 });
    t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' };
    feedN(t, 'Star Atomizer', 3);
    check(`四段 mag 在 Lv${def + 2} 不会通过三段规则再进化`, t.magId === 'Deva');
  }
}

// --- BUG 6: Photon Blast inheritance (up to 3 slots) ------------------------
// A mag keeps every PB it learns: the 1st/2nd/3rd evolutions fill slots 1-3,
// skipping a PB it already holds. Only the current form's single PB used to be
// shown, so a player feeding for a PB set had no answer at all.
const pbs = (t) => JSON.stringify(t.pbs);
check('createState 的 pbs 起始为空', Array.isArray(s.pbs) && s.pbs.length === 0);
{
  // a fresh Mag fed through stages 1 -> 2 -> 3, PBs accumulating in order.
  // Varuna(Farlla) -> Rudra(Golla) -> Bhirava(Pilla) = three distinct PBs.
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // A
  const at = (o) => { Object.assign(t, o); t.progress = { def: 0, pow: 0, dex: 0, mind: 0 }; };

  at({ def: 10, pow: 0, dex: 0, mind: 0 });          // Lv10
  feedOnce(DATA, t, 'Star Atomizer');
  check('一段 Varuna → PB 槽1 Farlla',
    t.magId === 'Varuna' && pbs(t) === JSON.stringify(['Farlla']));

  at({ def: 30, pow: 5, dex: 0, mind: 0 });          // Lv35, POW max
  feedOnce(DATA, t, 'Star Atomizer');
  check('二段 Rudra → PB 槽2 Golla',
    t.magId === 'Rudra' && pbs(t) === JSON.stringify(['Farlla', 'Golla']));

  at({ def: 40, pow: 8, dex: 0, mind: 2 });          // Lv50, POW ≥ MIND > DEX
  feedOnce(DATA, t, 'Star Atomizer');
  check('三段 Bhirava → PB 槽3 Pilla（三格集齐）',
    t.magId === 'Bhirava' && pbs(t) === JSON.stringify(['Farlla', 'Golla', 'Pilla']));

  // slots are FULL: a stage-3 re-evolution at Lv55 to Nandin (Estlla) adds nothing
  at({ def: 45, pow: 0, dex: 8, mind: 2 });          // Lv55 — an evolution level
  feedOnce(DATA, t, 'Star Atomizer');                // DEX > MIND ≥ POW -> re-evolves at once
  check('三格满后再进化 Nandin(Estlla) 不再入槽',
    t.magId === 'Nandin' && pbs(t) === JSON.stringify(['Farlla', 'Golla', 'Pilla']));
}
{
  // no duplicates: Rudra(Golla) -> Varaha(Golla) must not fill a second slot.
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  const at = (o) => { Object.assign(t, o); t.progress = { def: 0, pow: 0, dex: 0, mind: 0 }; };
  at({ def: 10, pow: 0, dex: 0, mind: 0 }); feedOnce(DATA, t, 'Star Atomizer'); // Varuna
  at({ def: 30, pow: 5, dex: 0, mind: 0 }); feedOnce(DATA, t, 'Star Atomizer'); // Rudra  (Golla)
  at({ def: 40, pow: 8, dex: 2, mind: 0 }); feedOnce(DATA, t, 'Star Atomizer'); // Varaha (Golla)
  check('已持有的 PB 不重复入槽（Rudra/Varaha 同为 Golla）',
    t.magId === 'Varaha' && pbs(t) === JSON.stringify(['Farlla', 'Golla']));
}
{
  // PBs survive export -> replay (replay re-runs feedOnce, so it recomputes them)
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  feedN(t, 'Trimate', 40);
  const session = exportSession(t);
  check('exportSession 带上 pbs', Array.isArray(session.final.pbs));
  check('回放后 pbs 一致', pbs(replaySession(DATA, session)) === pbs(t));
  check('回放后 pbs 非空（确实进化过）', Array.isArray(t.pbs) && t.pbs.length > 0);
}

// cap boundary: feeding past level 200 caps at 200
{
  const t = cs({ magId: 'Mag', def: 100, pow: 99, dex: 0, mind: 0 }); // level 199
  feedN(t, 'Trimate', 5);
  check('level caps at 200', magLevel(t) === 200);
}
// --- BUG 1: a negative feed is ALL-OR-NOTHING, never floored -----------------
// A reduction that would take the hundredths bar below zero DOES NOT APPLY AT
// ALL — the bar keeps its current value. It is NOT clamped to 0, and it never
// borrows from the integer stat (mags cannot level down).
//
// Aleron Ives (pioneer2.net, "Mag feeding problem"), on a player's in-game
// observation: "That is indeed how it works. If the bar has 1-14 points in it, a
// reduction of 15 has no effect. Stats only go down if the bar is filled far
// enough for the subtraction to take place without causing a negative result,
// since Mags can't 'level down'." Corroborated by tofuman ("attributes not
// reducing if the attribute reduction would make it below 0"); Sodaboy confirms
// mag levelling is client-side, so this is the game binary's own rule.
//
// THE DISCRIMINATING REGION IS 0 < bar < |reduction| — and the suite used to be
// blind to it: every negative-feed test started from bar 0 (0-15 -> 0 under BOTH
// models) or bar 80 (80-15 = 65 under BOTH). The floor-at-zero bug shipped
// because nothing here could tell the two models apart. These do.
{
  // THE repro: a Marutah (table 2, Trimate MIND -15) with 3 hundredths of MIND.
  // Floor-at-zero says 0 and burns the bar; the game leaves the 3 alone.
  const t = cs({ magId: 'Marutah', def: 20, pow: 10, dex: 5, mind: 5 });
  t.progress.mind = 3;
  feedOnce(DATA, t, 'Trimate'); // [8, 16, 2, -15]
  check('负值喂食：进度条 3 < |-15| → 减法完全不生效，仍是 3（不是归零）',
    t.progress.mind === 3 && t.mind === 5);
  // ...and the same feed's POSITIVE deltas still land — it is per-stat, not
  // per-feed: only the reduction that would go negative is skipped.
  check('负值喂食：同一次喂食的正值增量照常生效（DEF/POW/DEX）',
    t.progress.def === 8 && t.progress.pow === 16 && t.progress.dex === 2);
}
{
  // bar one less than |delta| -> the reduction does NOT apply.
  const t = cs({ magId: 'Marutah', def: 20, pow: 10, dex: 5, mind: 5 });
  t.progress.mind = 14;
  feedOnce(DATA, t, 'Trimate'); // MIND -15
  check('负值喂食：进度条 14 = |-15| - 1 → 减法不生效，仍是 14', t.progress.mind === 14);
}
{
  // bar EXACTLY |delta| -> the reduction DOES apply, and the bar lands on 0.
  const t = cs({ magId: 'Marutah', def: 20, pow: 10, dex: 5, mind: 5 });
  t.progress.mind = 15;
  feedOnce(DATA, t, 'Trimate'); // MIND -15
  check('负值喂食：进度条 15 = |-15| → 减法生效，归零（0 不是负数）',
    t.progress.mind === 0 && t.mind === 5);
}
{
  // bar 0: nothing to take, so nothing happens (this is the case the OLD suite
  // tested — it passes under both models and proves nothing on its own).
  const t = cs({ magId: 'Rudra', def: 10, pow: 0, dex: 0, mind: 5 });
  feedOnce(DATA, t, 'Trimate'); // MIND -15 against an empty bar
  check('负值喂食：空进度条不借位，MIND 保持 5、进度仍是 0',
    t.mind === 5 && t.progress.mind === 0);
}
// a reduction the bar CAN absorb is applied in full (80 -> 65)
{
  const t = cs({ magId: 'Rudra', def: 10, pow: 0, dex: 0, mind: 5 });
  t.progress.mind = 80;
  feedOnce(DATA, t, 'Trimate'); // MIND -15
  check('负值喂食：进度条够扣时照常扣减（80 -> 65）',
    t.mind === 5 && t.progress.mind === 65);
}
// the reported repro: a Diwari (table 7) at 20/20/20/20 = Lv80 fed one Monomate
// ([-4,+21,-15,-5]) used to drop to Lv77.
{
  const t = cs({ magId: 'Diwari', def: 20, pow: 20, dex: 20, mind: 20 }); // level 80
  feedOnce(DATA, t, 'Monomate');
  check('Diwari Lv80 喂 Monomate 后仍是 Lv80（不掉级）', magLevel(t) === 80);
}
// even a capped Lv200 mag must not be knocked back down to 198
{
  const t = cs({ magId: 'Diwari', def: 50, pow: 50, dex: 50, mind: 50 }); // level 200
  feedOnce(DATA, t, 'Monomate');
  check('Lv200 满级 mag 喂 Monomate 后仍是 Lv200', magLevel(t) === 200);
}

// --- BUG 2: stage 3 keys on the FEEDER's class, not the mag's lineage --------
// The wiki's Lv.50 condition lines read `HU {{TypeA}} …` — the class, not the
// lineage. (Only Lv.35 is lineage-keyed: `Evolves from Varuna`.) Feeding a mag
// with a different character is the documented way to switch evolution tables.
{
  // Namuci is a Vritra(FO)-line mag; fed by a HUNTER it must take the HU table.
  // HU/A, POW ≥ DEX ≥ MIND -> Varaha. (The FO table would give Naraka.)
  const t = cs({ magId: 'Namuci', def: 40, pow: 8, dex: 2, mind: 0 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 Vritra 血统 + HU 喂食者 → 走 HU 表（Varaha，不是 Naraka）',
    t.magId === 'Varaha');
}
{
  // ...and the FO DEF>=45 special keys on the feeder too: an HU-line Rudra fed
  // by a FORCE with DEF 45 and POW strictly max takes it.
  const t = cs({ magId: 'Rudra', def: 45, pow: 5, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'FO', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 Varuna 血统 + FO 喂食者 DEF≥45 POW 最大 → Andhaka', t.magId === 'Andhaka');
}
{
  // ...while an FO-line mag with DEF>=45 fed by a HUNTER must NOT take it.
  const t = cs({ magId: 'Namuci', def: 45, pow: 5, dex: 0, mind: 0 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 Vritra 血统 + HU 喂食者 DEF≥45 → 不触发 FO 特例（Varaha）',
    t.magId === 'Varaha');
}

// --- BUG 3: stage 3 follows the wiki's ORDERED rows, not 6 strict permutations
// The old engine ranked the three stats into one of 6 strict orderings, breaking
// ties by a fixed POW>DEX>MIND priority. That cannot express the wiki's seven
// ordered `≥`/`>`/`=` rows. Canonical counter-example: HU/A with DEX > MIND = POW
// matches row 5 `DEX > MIND ≥ POW` -> Nandin, but the perm key 'DEX>POW>MIND'
// (POW winning the tie) gave Ila.
{
  const t = cs({ magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // A
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 HU/A DEX > MIND = POW → Nandin（有序规则，不是 Ila）',
    t.magId === 'Nandin');
}
// the same state in ID group B -> Yaksa (the row's B mag)
{
  const t = cs({ magId: 'Rudra', def: 41, pow: 2, dex: 5, mind: 2 }); // level 50
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Greenill' }; // B
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 HU/B DEX > MIND = POW → Yaksa', t.magId === 'Yaksa');
}
// rule ORDER matters: RA row 1 `POW > DEX ≥ MIND` must win over row 4
// `POW > MIND > DEX` for a state that only the first can match.
{
  const t = cs({ magId: 'Surya', def: 40, pow: 8, dex: 2, mind: 0 }); // level 50
  t.feeder = { class: 'RA', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // A
  feedOnce(DATA, t, 'Star Atomizer');
  check('Lv50 RA/A POW > DEX ≥ MIND → Kama（首个命中的规则行获胜）',
    t.magId === 'Kama');
}
// the superseded structures are gone from the data
check('evolution.stage3（6 排列表）已删除', DATA.evolution.stage3 === undefined);
check('evolution.stage3Ties 已删除', DATA.evolution.stage3Ties === undefined);

// --- mag cell evolution
check('checkCellEvolution 已导出', typeof checkCellEvolution === 'function');

// level gate: Chu Chu needs Lv50+ mag
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Kama', def: 10, pow: 10, dex: 10, mind: 10, synchro: 20, iq: 0 } }); // level 40
  const ev = feedOnce(DATA, t, 'Heart of Chu Chu');
  check('cell level too low → magCellRejected', ev.some(e => e.type === 'magCellRejected'));
  check('rejected cell leaves magId', t.magId === 'Kama'); }
// species gate: D-Photon Core needs current mag = Kama
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0, synchro: 20, iq: 0 } }); // level 100, stage3
  const ev = feedOnce(DATA, t, 'D-Photon Core');
  check('D-Photon Core on Kama Lv100 → Gael Giel', t.magId === 'Gael Giel'); }
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Rudra', def: 70, pow: 30, dex: 0, mind: 0, synchro: 20, iq: 0 } });
  check('D-Photon Core on non-Kama → rejected',
        feedOnce(DATA, t, 'D-Photon Core').some(e => e.type === 'magCellRejected') && t.magId === 'Rudra'); }
// multi-target by Section-ID group: Cell of Mag 213 A→Churel, B→Preta.
// Both need a *third evolution* mag (Varaha), not the stage-2 Rudra this test
// used to pass with — the wiki forbids that (review I2b).
{ const t = cs({ magId: 'Varaha', def: 100, pow: 50, dex: 25, mind: 25 }); // level 200, stage3
  t.feeder.sectionId = 'Viridia'; // group A
  feedOnce(DATA, t, 'Cell of Mag 213'); check('Cell213 TypeA → Churel', t.magId === 'Churel'); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 50, dex: 25, mind: 25 });
  t.feeder.sectionId = 'Greenill'; // group B
  feedOnce(DATA, t, 'Cell of Mag 213'); check('Cell213 TypeB → Preta', t.magId === 'Preta'); }
{ const t = cs({ magId: 'Rudra', def: 100, pow: 50, dex: 25, mind: 25 }); // stage2
  check('Cell213 on a stage-2 mag → rejected (needs third evolution)',
    feedOnce(DATA, t, 'Cell of Mag 213').some(e => e.type === 'magCellRejected')
    && t.magId === 'Rudra'); }

// --- mag-cell gates the engine used to skip entirely (review I2) ------------
// (a) minMagLevel must hold even when requiresMag matches. The generator used
// to store the *character* level of the System chain as `minLevel` and the
// engine skipped minLevel whenever requiresMag was present.
{ const t = cs({ magId: 'Kama', def: 10, pow: 10, dex: 10, mind: 10 }); // level 40, stage3
  check('D-Photon Core on a Lv40 Kama → rejected (needs Lv100+)',
    feedOnce(DATA, t, 'D-Photon Core').some(e => e.type === 'magCellRejected')
    && t.magId === 'Kama'); }
{ const t = cs({ magId: 'Naga', def: 10, pow: 0, dex: 0, mind: 0 }); // level 10, stage3
  check("Panther's Spirit on a Lv10 Naga → rejected (needs Lv50+)",
    feedOnce(DATA, t, "Panther's Spirit").some(e => e.type === 'magCellRejected')
    && t.magId === 'Naga'); }
{ const t = cs({ magId: 'Naga', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50
  feedOnce(DATA, t, "Panther's Spirit");
  check("Panther's Spirit on a Lv50 Naga → Panzer's Tail", t.magId === "Panzer's Tail"); }
// (b) the "third evolution Mag" precondition (requiredStage)
{ const t = cs({ magId: 'Mitra', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50, stage2
  check('Heart of Chu Chu on a stage-2 Mitra → rejected (needs third evolution)',
    feedOnce(DATA, t, 'Heart of Chu Chu').some(e => e.type === 'magCellRejected')
    && t.magId === 'Mitra'); }
{ const t = cs({ magId: 'Kama', def: 50, pow: 0, dex: 0, mind: 0 }); // level 50, stage3
  feedOnce(DATA, t, 'Heart of Chu Chu');
  check('Heart of Chu Chu on a Lv50 stage-3 Kama → Chu Chu', t.magId === 'Chu Chu'); }
// (c) synchro / IQ / stat-threshold conditions
{ const t = cs({ magId: 'Varaha', def: 120, pow: 0, dex: 0, mind: 0 }); // level 120, sync 20, iq 0
  check('Heart of Pian without 120% synchro / 180 IQ → rejected',
    feedOnce(DATA, t, 'Heart of Pian').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 120, pow: 0, dex: 0, mind: 0, synchro: 120, iq: 179 });
  check('Heart of Pian with IQ 179 → rejected (needs 180+)',
    feedOnce(DATA, t, 'Heart of Pian').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 120, pow: 0, dex: 0, mind: 0, synchro: 120, iq: 180 });
  feedOnce(DATA, t, 'Heart of Pian');
  check('Heart of Pian at Lv120 / 120% synchro / 180 IQ → Pian', t.magId === 'Pian'); }
{ const t = cs({ magId: 'Varaha', def: 140, pow: 0, dex: 0, mind: 0 }); // level 140
  check('Heart of Chao without 35+ in all stats → rejected',
    feedOnce(DATA, t, 'Heart of Chao').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 35, pow: 35, dex: 35, mind: 35 }); // level 140
  feedOnce(DATA, t, 'Heart of Chao');
  check('Heart of Chao with 35+ in all stats → Chao', t.magId === 'Chao'); }
{ const t = cs({ magId: 'Varaha', def: 145, pow: 0, dex: 0, mind: 0 }); // level 145
  check('Parts of RoboChao with only one 70+ stat → rejected',
    feedOnce(DATA, t, 'Parts of RoboChao').some(e => e.type === 'magCellRejected')); }
{ const t = cs({ magId: 'Varaha', def: 75, pow: 70, dex: 0, mind: 0 }); // level 145
  feedOnce(DATA, t, 'Parts of RoboChao');
  check('Parts of RoboChao with two 70+ stats → Robochao', t.magId === 'Robochao'); }
// species multi-target: Heart of Devil on a Devil's Wing (stage4, whitelisted)
// takes the FIRST target whose gates pass -> Devil's Tail.
{ const t = cs({ magId: "Devil's Wing", def: 100, pow: 0, dex: 0, mind: 0 });
  feedOnce(DATA, t, 'Heart of Devil');
  check("Heart of Devil on a Devil's Wing → Devil's Tail", t.magId === "Devil's Tail"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 }); // stage3 Lv100
  feedOnce(DATA, t, 'Heart of Devil');
  check("Heart of Devil on a stage-3 mag → Devil's Wing", t.magId === "Devil's Wing"); }
// (d) a cell evolution is logged like any other evolution, so it survives export
{ const t = cs({ magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0 }); // level 100, stage3
  const ev = feedOnce(DATA, t, 'D-Photon Core');
  check('cell evolution emits an evolve event', ev.some(e => e.type === 'evolve'));
  const logged = t.log.filter((e) => e.kind === 'evolve');
  check('cell evolution pushes an evolve log entry',
    logged.length === 1 && logged[0].to === 'Gael Giel' && logged[0].viaCell === 'D-Photon Core');
  check('feedCell log entry precedes its evolve entry and is marked ok',
    t.log[0].kind === 'feedCell' && t.log[0].ok === true && t.log[1].kind === 'evolve');
  const session = exportSession(t);
  check('exportSession records the cell feed + resulting mag',
    session.feeds.length === 1 && session.feeds[0].item === 'D-Photon Core'
    && session.final.magId === 'Gael Giel');
  check('replaying the cell session reproduces the mag',
    replaySession(DATA, session).magId === 'Gael Giel'); }
// re-evo whitelist: stage4 rare + non-whitelisted cell rejected
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Deva', def: 50, pow: 50, dex: 50, mind: 50, synchro: 20, iq: 0 } }); // stage4
  check('stage4 + non-whitelist cell rejected',
        feedOnce(DATA, t, 'Heart of Chu Chu').some(e => e.type === 'magCellRejected')); }
// cell feed applies NO stat delta
{ const t = createState(DATA, { start: { mode: 'custom', magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0, synchro: 20, iq: 0 } });
  const p = { ...t.progress }; feedOnce(DATA, t, 'D-Photon Core');
  check('cell feed applied no stat progress', JSON.stringify(t.progress) === JSON.stringify(p)); }

// --- racial restriction (mag cells) -----------------------------------------
// EPHINEA DOES NOT ENFORCE THESE. The wiki's own mag pages:
//   Elenor: "Originally, this Mag could only be equipped by android characters.
//     This was changed in an Ephinea update on January 9, 2017."
//   Angel's Wing / Devil's Wing: "Originally, this Mag […] could not be equipped
//     by Androids. This was changed on an Ephinea update on January 9, 2017."
// Note it was a restriction on EQUIPPING the mag, never on using the cell. The
// rules survive as an OPT-IN classic/vanilla-PSO toggle (they were copied from
// Magatama, which models vanilla PSO) — hence default OFF.
check('createState 默认 feeder.race=Human', s.feeder.race === 'Human');
check('createState 默认关闭种族限制（Ephinea 2017-01-09 取消了这条规则）',
  s.racialRestriction === false);

// DEFAULT (Ephinea) behaviour: no cell is ever race-gated.
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 }); // Lv100 stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Android', sectionId: 'Viridia' }; // HUcast
  feedOnce(DATA, t, 'Heart of Angel');
  check("默认（Ephinea）：机器人可用 Heart of Angel → Angel's Wing",
    t.magId === "Angel's Wing"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'RA', gender: 'F', race: 'Android', sectionId: 'Viridia' }; // RAcaseal
  feedOnce(DATA, t, 'Heart of Devil');
  check('默认（Ephinea）：机器人可用 Heart of Devil',
    DATA.mags[t.magId].stage === 4 && t.magId !== 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 }); // Lv50 stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // HUmar
  feedOnce(DATA, t, 'Heart of YN-0117');
  check('默认（Ephinea）：人类可用 Heart of YN-0117 → Elenor', t.magId === 'Elenor'); }

// OPT-IN classic PSO rule: racialRestriction = true re-applies the pre-2017 gates.
// deny: Android — Heart of Angel / Heart of Devil
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 }); // Lv100 stage3
  t.racialRestriction = true;
  t.feeder = { class: 'HU', gender: 'M', race: 'Android', sectionId: 'Viridia' }; // HUcast
  const ev = feedOnce(DATA, t, 'Heart of Angel');
  check('经典规则开启：Heart of Angel + 机器人 → 拒绝',
    ev.some((e) => e.type === 'magCellRejected' && /机器人/.test(e.reason))
    && t.magId === 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.racialRestriction = true;
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' }; // HUmar
  feedOnce(DATA, t, 'Heart of Angel');
  check("经典规则开启：Heart of Angel + 人类 → Angel's Wing", t.magId === "Angel's Wing"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.racialRestriction = true;
  t.feeder = { class: 'HU', gender: 'F', race: 'Newman', sectionId: 'Viridia' }; // HUnewearl
  feedOnce(DATA, t, 'Heart of Angel');
  check("经典规则开启：Heart of Angel + 新人类 → Angel's Wing", t.magId === "Angel's Wing"); }
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.racialRestriction = true;
  t.feeder = { class: 'RA', gender: 'F', race: 'Android', sectionId: 'Viridia' }; // RAcaseal
  check('经典规则开启：Heart of Devil + 机器人 → 拒绝',
    feedOnce(DATA, t, 'Heart of Devil').some((e) => e.type === 'magCellRejected')
    && t.magId === 'Varaha'); }

// only: Android — Heart of YN-0117
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 }); // Lv50 stage3
  t.racialRestriction = true;
  t.feeder = { class: 'HU', gender: 'M', race: 'Human', sectionId: 'Viridia' };
  const ev = feedOnce(DATA, t, 'Heart of YN-0117');
  check('经典规则开启：Heart of YN-0117 + 人类 → 拒绝',
    ev.some((e) => e.type === 'magCellRejected' && /仅机器人/.test(e.reason))
    && t.magId === 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 });
  t.racialRestriction = true;
  t.feeder = { class: 'FO', gender: 'F', race: 'Newman', sectionId: 'Viridia' }; // FOnewearl
  check('经典规则开启：Heart of YN-0117 + 新人类 → 拒绝',
    feedOnce(DATA, t, 'Heart of YN-0117').some((e) => e.type === 'magCellRejected')
    && t.magId === 'Varaha'); }
{ const t = cs({ magId: 'Varaha', def: 50, pow: 0, dex: 0, mind: 0 });
  t.racialRestriction = true;
  t.feeder = { class: 'RA', gender: 'M', race: 'Android', sectionId: 'Viridia' }; // RAcast
  feedOnce(DATA, t, 'Heart of YN-0117');
  check('经典规则开启：Heart of YN-0117 + 机器人 → Elenor', t.magId === 'Elenor'); }

// a cell WITHOUT a raceRule is never race-gated
{ const t = cs({ magId: 'Kama', def: 50, pow: 0, dex: 0, mind: 0 }); // Lv50 stage3
  t.feeder = { class: 'HU', gender: 'M', race: 'Android', sectionId: 'Viridia' };
  feedOnce(DATA, t, 'Heart of Chu Chu');
  check('无 raceRule 的 cell 不受种族影响（机器人 → Chu Chu）', t.magId === 'Chu Chu'); }

// legacy feeder objects (no `race` key — every pre-existing test and any old
// share link) must not be blocked by a deny rule.
{ const t = cs({ magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0 });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' }; // no race
  feedOnce(DATA, t, 'Heart of Angel');
  check("无 race 字段的 feeder 不被 deny 规则拦截", t.magId === "Angel's Wing"); }

// --- session export / replay
{
  const t = createState(DATA, { start:{mode:'fresh'} });
  t.feeder = { class:'RA', gender:'F', sectionId:'Skyly' };
  const seq = ['Trimate','Trimate','Antidote','Monomate','Trimate'];
  seq.forEach((it) => feedOnce(DATA, t, it));
  const session = exportSession(t);
  const replayed = replaySession(DATA, session);
  check('回放后 magId 一致', replayed.magId === t.magId);
  check('回放后四维一致',
    replayed.def===t.def && replayed.pow===t.pow
    && replayed.dex===t.dex && replayed.mind===t.mind);
  check('回放后 progress 一致',
    JSON.stringify(replayed.progress) === JSON.stringify(t.progress));
}

// The 种族限制 toggle must survive export/replay. An Android feeder with the
// toggle OFF can use Heart of Angel; if the toggle didn't round-trip, the replay
// would re-apply the deny rule and reproduce a DIFFERENT mag from the same link.
{
  const t = createState(DATA, { start:{mode:'custom', magId:'Varaha',
    def:40, pow:30, dex:10, mind:20, synchro:20, iq:0} });
  t.feeder = { class:'HU', gender:'M', sectionId:'Viridia', race:'Android' };
  feedOnce(DATA, t, 'Heart of Angel');
  check('默认（关闭种族限制）:机器人喂 Heart of Angel 成功', t.magId === "Angel's Wing");
  const replayed = replaySession(DATA, exportSession(t));
  check('回放保留 racialRestriction=false', replayed.racialRestriction === false);
  check('回放后仍是 Angel\'s Wing（deny 规则未被重新套用）',
    replayed.magId === t.magId);
}

// …and it must round-trip when it is toggled MID-SESSION. exportSession used to
// write it as a single scalar snapshot taken at export time, while the UI mutates
// it live — so a shared link replayed a DIFFERENT mag (a cell that was rejected
// live got accepted on replay, and vice versa). Toggles are actions: they belong
// in the ordered action log, exactly like a bank.
{
  const t = createState(DATA, { start:{mode:'custom', magId:'Varaha',
    def:100, pow:0, dex:0, mind:0, synchro:20, iq:0} });   // Lv100 stage-3
  t.feeder = { class:'HU', gender:'M', sectionId:'Viridia', race:'Android' }; // HUcast
  setRacialRestriction(t, true);                     // pre-session default: classic rules
  feedOnce(DATA, t, 'Heart of Angel');               // -> rejected (classic deny)
  check('中途切换:开着经典限制时机器人被拒', t.magId === 'Varaha');
  setRacialRestriction(t, false);                    // MID-SESSION: back to Ephinea rules
  feedOnce(DATA, t, 'Heart of Angel');               // -> accepted
  check('中途切换:关掉经典限制后同一个 cell 成功', t.magId === "Angel's Wing");

  const session = exportSession(t);
  check('中途切换:顶层标量记录的是「会话开始前」的值（true），不是导出时的值',
    session.racialRestriction === true);
  check('中途切换:切换本身作为一条有序 action 被导出',
    session.feeds.some((f) => f.action === 'racial' && f.on === false));

  const replayed = replaySession(DATA, session);
  check('中途切换:回放得到同一只 mag', replayed.magId === t.magId);
  check('中途切换:回放逐字节一致（第一次喂 cell 仍然是被拒绝的）',
    JSON.stringify(replayed.log) === JSON.stringify(t.log));
  check('中途切换:回放后 racialRestriction 停在 false', replayed.racialRestriction === false);
  check('中途切换:回放后再导出仍然等价（幂等）',
    JSON.stringify(exportSession(replayed)) === JSON.stringify(session));
}

// Old share links carry only the top-level scalar and no `racial` actions: they
// must still replay under that constant rule.
{
  const legacy = {
    start: { mode: 'custom', magId: 'Varaha', def: 100, pow: 0, dex: 0, mind: 0,
             synchro: 20, iq: 0 },
    racialRestriction: true,
    feeds: [{ item: 'Heart of Angel',
              feeder: { class: 'HU', gender: 'M', sectionId: 'Viridia', race: 'Android' } }],
  };
  const replayed = replaySession(DATA, legacy);
  check('旧分享链接（只有标量、没有 racial action）仍按该常量规则回放',
    replayed.racialRestriction === true && replayed.magId === 'Varaha'
    && replayed.log[0].kind === 'feedCell' && replayed.log[0].ok === false);
}

// mid-session feeder swap: export/replay must survive the feeder object being
// reassigned in place mid-session (the UI idiom), proving exportSession /
// replaySession don't alias the live `state.feeder` .
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', sectionId: 'Viridia' };
  ['Monomate', 'Trimate'].forEach((it) => feedOnce(DATA, t, it));
  t.feeder = { class: 'RA', gender: 'F', sectionId: 'Skyly' };
  ['Antidote', 'Trimate', 'Monomate'].forEach((it) => feedOnce(DATA, t, it));

  const session = exportSession(t);
  const replayed = replaySession(DATA, session);
  check('中途换 feeder 后回放 magId 一致', replayed.magId === t.magId);
  check('中途换 feeder 后回放四维一致',
    replayed.def === t.def && replayed.pow === t.pow
    && replayed.dex === t.dex && replayed.mind === t.mind);
  check('中途换 feeder 后回放 progress 一致',
    JSON.stringify(replayed.progress) === JSON.stringify(t.progress));
  check('中途换 feeder 后回放 synchro 一致', replayed.synchro === t.synchro);
  check('中途换 feeder 后回放 iq 一致', replayed.iq === t.iq);

  // Anti-aliasing: mutating the replayed state's feeder in place (the Phase 3
  // UI idiom, e.g. `state.feeder.sectionId = ...`) must NOT reach back into
  // the exported session snapshot or the original run's log — they must be
  // independent objects, not shared references.
  replayed.feeder.sectionId = 'MUTATED';
  check('回放态 feeder 被原地修改不会污染 exportSession 快照',
    session.feeds[session.feeds.length - 1].feeder.sectionId !== 'MUTATED');
  check('回放态 feeder 被原地修改不会污染原始 run 的 log',
    t.log.filter((e) => e.kind === 'feed' || e.kind === 'feedCell')
         .slice(-1)[0].feeder.sectionId !== 'MUTATED');
}

// --- exhaustive sweeps: a CONSISTENCY CHECK, *not* an independent oracle -----
// mag-sim-data.js is a RESTRUCTURING of window.MAG_EVOLUTION. These two sweeps
// re-derive every Lv.50 and Lv.100 outcome straight from MAG_EVOLUTION and
// compare it with what the engine actually does, over every reachable stat split.
//
// READ THIS BEFORE TRUSTING THEM: mag-evolution.js and mag-sim-data.js are
// emitted by the SAME generator (scripts/build_mag_data.py) from the same wiki
// scrape. MAG_EVOLUTION is therefore NOT an independent source of truth — if the
// generator misreads the wiki, both files are wrong together and these sweeps
// stay green. What they DO catch is drift between the two representations and
// between the data and the engine's rule evaluator (the ordered `≥`/`>`/`=`
// chains, the FO DEF≥45 special, the per-Type stage-4 formula). The genuinely
// external oracles in this file are the GOLDEN PATHS below, taken from Ephinea's
// player guide (prose, never used as a data source).
//
// Neither sweep says anything about WHEN an evolution may happen: they pin the
// mag at exactly Lv50 / Lv100 and call checkEvolution once. The evolution-LEVEL
// rules are covered by the discrete-level block near the top of this file.
{
  const evoSrc = readFileSync('assets/js/mag-evolution.js', 'utf8');
  const w2 = {};
  new Function('window', evoSrc)(w2);
  const EVO = w2.MAG_EVOLUTION;
  const CLASSES = ['HU', 'RA', 'FO'];
  const OPS = { '>': (a, b) => a > b, '≥': (a, b) => a >= b, '=': (a, b) => a === b };

  // an independent evaluator of one wiki rule chain (not the engine's)
  const holds = (cond, st) => {
    const v = { POW: st.pow, DEX: st.dex, MIND: st.mind };
    const tok = cond.split(' ');
    for (let i = 0; i + 2 < tok.length; i += 2) {
      if (!OPS[tok[i + 1]](v[tok[i]], v[tok[i + 2]])) return false;
    }
    return true;
  };
  // what the WIKI says a Lv.50 mag becomes, from MAG_EVOLUTION alone
  const wikiStage3 = (cls, grp, st) => {
    const s3 = EVO.classes[cls].stage3;
    if (cls === 'FO' && st.def >= 45) {                    // the all-IDs special
      const max = Math.max(st.pow, st.dex, st.mind);
      return (st.pow === max && st.dex < max && st.mind < max) ? 'Andhaka' : 'Bana';
    }
    for (const rule of s3.rules) {                          // first row that holds
      if (!holds(rule, st)) continue;
      const hit = s3[grp].find((m) => m.cond.includes(rule));
      return hit ? hit.name : null;
    }
    return null;
  };

  const A_ID = 'Viridia', B_ID = 'Greenill';
  let n3 = 0, bad3 = 0, firstBad3 = null;
  for (const cls of CLASSES) {
    for (const [grp, sectionId] of [['A', A_ID], ['B', B_ID]]) {
      for (let pow = 0; pow <= 50; pow++) {
        for (let dex = 0; dex + pow <= 50; dex++) {
          for (let mind = 0; mind + dex + pow <= 50; mind++) {
            const def = 50 - pow - dex - mind;
            const t = cs({ magId: 'Rudra', def, pow, dex, mind });   // stage2, Lv50
            t.feeder = { class: cls, gender: 'M', race: 'Human', sectionId };
            checkEvolution(DATA, t);
            const want = wikiStage3(cls, grp, { def, pow, dex, mind });
            n3++;
            if (t.magId !== (want || 'Rudra')) {
              bad3++;
              firstBad3 = firstBad3 || `${cls}/${grp} ${def}/${pow}/${dex}/${mind}: `
                + `engine ${t.magId}, wiki ${want}`;
            }
          }
        }
      }
    }
  }
  check(`Lv50 三段全量遍历：${n3} 个状态全部与 wiki 规则一致（${bad3} 个不一致）`
    + (firstBad3 ? ` — 首个：${firstBad3}` : ''), bad3 === 0);

  // Lv.100: MAG_EVOLUTION's stage4 rows give (formula, Section-ID group, male,
  // female) per class — the Type's own formula is the only one that decides.
  const F = {
    'DEF + POW = DEX + MIND': (s) => s.def + s.pow === s.dex + s.mind,
    'DEF + DEX = POW + MIND': (s) => s.def + s.dex === s.pow + s.mind,
    'DEF + MIND = POW + DEX': (s) => s.def + s.mind === s.pow + s.dex,
  };
  const TYPE_ID = { 1: 'Viridia', 2: 'Greenill', 3: 'Skyly' };
  let n4 = 0, bad4 = 0, firstBad4 = null;
  for (const cls of CLASSES) {
    for (const row of EVO.classes[cls].stage4) {
      const sectionId = TYPE_ID[row.group];
      for (const [gender, key] of [['M', 'male'], ['F', 'female']]) {
        for (let pow = 0; pow <= 100; pow++) {
          for (let dex = 0; dex + pow <= 100; dex++) {
            for (let mind = 0; mind + dex + pow <= 100; mind++) {
              const def = 100 - pow - dex - mind;
              const st = { def, pow, dex, mind };
              const t = cs({ magId: 'Varaha', ...st });               // stage3, Lv100
              t.feeder = { class: cls, gender, race: 'Human', sectionId };
              checkEvolution(DATA, t);
              // Lv100 is BOTH a third- and a fourth-evolution level, so when the
              // Type's formula does not hold the mag may still re-evolve along
              // the stage-3 path (Varaha -> some other third-evo mag). That is
              // correct behaviour and none of this sweep's business: collapse any
              // non-fourth outcome back to "no fourth evolution" so the stage-4
              // decision is isolated without touching the engine's state.
              const got = DATA.mags[t.magId].stage === 4 ? t.magId : 'Varaha';
              const want = F[row.formula](st) ? row[key].name : 'Varaha';
              n4++;
              if (got !== want) {
                bad4++;
                firstBad4 = firstBad4 || `${cls}/${gender}/Type${row.group} `
                  + `${def}/${pow}/${dex}/${mind}: engine ${got}, wiki ${want}`;
              }
            }
          }
        }
      }
    }
  }
  check(`Lv100 四段全量遍历：${n4} 个状态全部与 wiki 规则一致（${bad4} 个不一致）`
    + (firstBad4 ? ` — 首个：${firstBad4}` : ''), bad4 === 0);
}

// ===========================================================================
// GOLDEN PATHS — Ephinea's own player guide (wiki.pioneer2.net/w/Mags/Guide)
//
// An EXTERNAL oracle: the guide is written for players, was never used as a
// data source for this simulator, and states its outcomes (mag, exact stats,
// Photon Blasts) in prose. Reproducing it end-to-end exercises the whole
// chain at once — feed tables, carry, evolution windows, stage-3-by-feeder-
// class, the wiki's ordered `>=` rules, and PB inheritance.
// ===========================================================================
const GRP_A = 'Viridia';        // section-ID group A  (also Type1)
const GRP_B = 'Greenill';       // section-ID group B  (also Type2)
const TYPE3 = 'Skyly';
const stats = (t) => `${t.def}/${t.pow}/${t.dex}/${t.mind}`;
const feedUntil = (t, item, stop, cap = 5000) => {
  for (let i = 0; i < cap && !stop(t); i++) feedOnce(DATA, t, item);
};

// --- Guide: "Advanced MIND Mag" (the most precise recipe — it quotes stats)
//     HU + Monofluid -> Lv10 Varuna (PB Farlla) -> Lv35 Vayu (PB Mylla & Youlla)
//     at exactly 15/0/0/20 -> transfer to a TypeB Hunter, feed Moon Atomizer +
//     Monofluid -> Lv50 Bana (PB Estlla).
{
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: 'HU', gender: 'M', sectionId: GRP_A, race: 'Human' };
  let atTen = null;
  feedUntil(t, 'Monofluid', (s) => {
    if (!atTen && DATA.mags[s.magId].stage === 1) atTen = { id: s.magId, pbs: [...s.pbs] };
    return magLevel(s) >= 35;
  });
  check('指南/进阶MIND: Lv10 -> Varuna, PB Farlla',
    atTen && atTen.id === 'Varuna' && atTen.pbs.join() === 'Farlla');
  check('指南/进阶MIND: Lv35 -> Vayu', t.magId === 'Vayu');
  check('指南/进阶MIND: Lv35 时四维恰为 15/0/0/20', stats(t) === '15/0/0/20');
  check('指南/进阶MIND: Lv35 时 PB = [Farlla, Mylla & Youlla]',
    t.pbs.join() === 'Farlla,Mylla & Youlla');

  t.feeder = { class: 'HU', gender: 'M', sectionId: GRP_B, race: 'Human' }; // TypeB Hunter
  let i = 0;
  feedUntil(t, 'Monofluid', (s) => DATA.mags[s.magId].stage >= 3 || i++ > 900);
  check('指南/进阶MIND: TypeB 的 HU 喂到 Lv50 -> Bana', t.magId === 'Bana');
  check('指南/进阶MIND: Lv50 时 PB 三槽含 Estlla',
    t.pbs.length === 3 && t.pbs.includes('Estlla'));
}

// --- Guide: "Simple MIND Mag" — the sharpest proof that stage 3 keys on the
//     FEEDER's class: same mag, same stats, same TypeB section ID, only the
//     class differs. The guide: "It will turn into Yaksa (on HU) or Varaha (on RA)".
for (const [cls, expected] of [['HU', 'Yaksa'], ['RA', 'Varaha']]) {
  const t = createState(DATA, { start: { mode: 'fresh' } });
  t.feeder = { class: cls, gender: 'M', sectionId: GRP_A, race: 'Human' };
  feedUntil(t, 'Antiparalysis', (s) => magLevel(s) >= 49, 3000);
  t.feeder = { class: cls, gender: 'M', sectionId: GRP_B, race: 'Human' }; // transfer: TypeB
  feedUntil(t, 'Antiparalysis', (s) => DATA.mags[s.magId].stage >= 3, 800);
  check(`指南/简易MIND: TypeB + ${cls} -> ${expected}（同 mag 同 ID，只换职业）`,
    t.magId === expected);
}

// --- Guide: the nine fourth-evolution rare Mags -----------------------------
// The guide walks a player to a Lv100 third-evolution mag with one of exactly
// FOUR stat lines, quoted verbatim:
//   Simple POW Mag:  "Your Mag's stats will now be either 5/50/45/0, or
//                     5/45/50/0, depending on which of the above Mags you chose."
//   Simple MIND Mag: "Your Mag's stats will now be either 5/0/45/50, or
//                     5/0/50/45, depending on which of the above Mags you chose."
// …then names, per rare Mag, the character to transfer it to. Each line sums to
// exactly 100, i.e. it IS the level-100 evolution state.
//
// This test used to read the formula out of DATA.evolution.stage4[cls][gender]
// [type] — THE VERY TABLE IT IS TESTING — and then search for stats satisfying
// it, which made it tautological: a formula<->Type mis-mapping was invisible to
// it. Now every stat line is HARD-CODED from the guide, and the only thing the
// engine is asked for is the mag's name. Which of the four lines belongs to
// which recipe is decided by the guide too (the POW gallery lists Rati/Diwari
// under {{Type3}} and Bhima under {{Type3}}; the MIND gallery lists Rati/Bhima
// under {{Type2}} and says Diwari "cannot be made with these stats"), so the
// POW lines drive the Type1/Type3 recipes and the MIND line drives Bhima.
{
  const POW_A = { def: 5, pow: 50, dex: 45, mind: 0 };   // guide, Simple POW Mag
  const POW_B = { def: 5, pow: 45, dex: 50, mind: 0 };   // guide, Simple POW Mag
  const MIND_B = { def: 5, pow: 0, dex: 50, mind: 45 };  // guide, Simple MIND Mag
  // [expected mag, class, gender, section ID, the guide's stat line]
  const RECIPES = [
    ['Deva',    'HU', 'M', GRP_A, POW_A],   // Type1 male Hunter
    ['Savitri', 'HU', 'F', GRP_A, POW_A],   // Type1 female Hunter
    ['Rati',    'HU', 'M', TYPE3, POW_B],   // Type3 male Hunter
    ['Pushan',  'RA', 'M', GRP_A, POW_A],   // Type1 male Ranger
    ['Rukmin',  'RA', 'F', GRP_A, POW_A],   // Type1 female Ranger
    ['Diwari',  'RA', 'F', TYPE3, POW_B],   // Type3 female Ranger
    ['Nidra',   'FO', 'M', GRP_A, POW_A],   // Type1 male Force
    ['Sato',    'FO', 'F', GRP_A, POW_A],   // Type1 female Force
    ['Bhima',   'FO', 'F', GRP_B, MIND_B],  // Type2 female Force (MIND guide)
  ];
  const TYPE_OF = { [GRP_A]: 'Type1', [GRP_B]: 'Type2', [TYPE3]: 'Type3' };
  for (const [expected, cls, gender, id, st] of RECIPES) {
    check(`指南/四阶: ${expected} 的指南四维 ${st.def}/${st.pow}/${st.dex}/${st.mind} 恰为 Lv100`,
      st.def + st.pow + st.dex + st.mind === 100);
    const t = createState(DATA, {
      start: { mode: 'custom', magId: 'Varaha', ...st, synchro: 20, iq: 0 },
    });
    t.feeder = { class: cls, gender, sectionId: id, race: 'Human' };
    feedOnce(DATA, t, 'Star Atomizer');
    check(`指南/四阶: ${cls} ${gender === 'M' ? '男' : '女'} + ${TYPE_OF[id]}`
      + ` + 指南四维 ${st.def}/${st.pow}/${st.dex}/${st.mind} -> ${expected}`,
      t.magId === expected && DATA.mags[t.magId].stage === 4);
  }
  // ...and the guide's own negative: with the MIND Mag's stats, Diwari
  // "cannot be made" — a Type3 female Ranger fed 5/0/50/45 must NOT get one.
  {
    const t = createState(DATA, {
      start: { mode: 'custom', magId: 'Varaha', ...MIND_B, synchro: 20, iq: 0 },
    });
    t.feeder = { class: 'RA', gender: 'F', sectionId: TYPE3, race: 'Human' };
    feedOnce(DATA, t, 'Star Atomizer');
    check('指南/四阶: MIND 四维 5/0/50/45 做不出 Diwari（指南原话）',
      t.magId !== 'Diwari' && DATA.mags[t.magId].stage !== 4);
  }
}

// --- bankMag: the bank / leave-game trick -----------------------------------
// Unit level first: banking is NOT a feed. It rounds each stat's hundredths
// DOWN to the nearest even value and touches nothing else — no integer stat, no
// level, no synchro/IQ, no PB, and (critically) no evolution check.
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Vayu',
    def: 15, pow: 0, dex: 0, mind: 20, synchro: 40, iq: 30 } });
  t.pbs = ['Farlla', 'Mylla & Youlla'];
  t.progress = { def: 55, pow: 0, dex: 3, mind: 98 };
  const before = JSON.parse(JSON.stringify({ magId: t.magId, def: t.def, pow: t.pow,
    dex: t.dex, mind: t.mind, synchro: t.synchro, iq: t.iq, pbs: t.pbs,
    level: magLevel(t) }));
  const events = bankMag(DATA, t);

  check('存银行: 奇数百分位向下取偶（55->54, 3->2）',
    t.progress.def === 54 && t.progress.dex === 2);
  check('存银行: 偶数百分位不变（0->0, 98->98）',
    t.progress.pow === 0 && t.progress.mind === 98);
  check('存银行: 只减不增（每项 progress 不增加，且落点为偶数）',
    [54, 0, 2, 98].every((v, i) => v <= [55, 0, 3, 98][i] && v % 2 === 0));
  check('存银行: 四维/等级/同步率/IQ/PB/mag 种类全部不变',
    t.magId === before.magId && t.def === before.def && t.pow === before.pow
    && t.dex === before.dex && t.mind === before.mind && magLevel(t) === before.level
    && t.synchro === before.synchro && t.iq === before.iq
    && t.pbs.join() === before.pbs.join());
  check('存银行: 返回 banked 事件', events.length === 1 && events[0].type === 'banked');
  check('存银行: 写入一条 kind=bank 的日志',
    t.log.length === 1 && t.log[0].kind === 'bank');
}
// A bank must never trigger an evolution: a Lv50 stage-2 mag that is banked
// (not fed) stays a stage-2 mag.
{
  const t = createState(DATA, { start: { mode: 'custom', magId: 'Rudra',
    def: 20, pow: 10, dex: 10, mind: 10, synchro: 40, iq: 30 } });
  t.feeder = { class: 'HU', gender: 'M', sectionId: GRP_B, race: 'Human' };
  check('存银行前: Lv50 的二阶 Rudra', magLevel(t) === 50 && DATA.mags[t.magId].stage === 2);
  bankMag(DATA, t);
  check('存银行不触发进化：Lv50 存银行后仍是 Rudra（存银行不是喂食）',
    t.magId === 'Rudra' && !t.log.some((e) => e.kind === 'evolve'));
}

// --- Guide: the bank/leave-game trick's two documented routes ----------------
// Ephinea's guide, verbatim: "The Mag's stats end up being either 15/0/0/185 or
// 13/0/0/187 with a time-consuming trick. […] If you bank after every Monofluid,
// you should be able to just barely reach 13/0/0/22 by Level 35."
// Same mag, same feeder (a TypeB Hunter), same single item (Monofluid) — the
// ONLY difference is the bank between feeds, and it is worth exactly 2 DEF.
{
  const run = (bankEveryFeed) => {
    const t = createState(DATA, { start: { mode: 'fresh' } });
    t.feeder = { class: 'HU', gender: 'M', sectionId: GRP_B, race: 'Human' }; // TypeB Hunter
    let at35 = null, at50 = null;
    for (let i = 0; i < 20000 && magLevel(t) < 200; i++) {
      feedOnce(DATA, t, 'Monofluid');
      if (bankEveryFeed) bankMag(DATA, t);
      if (!at35 && magLevel(t) >= 35) at35 = { stats: stats(t), level: magLevel(t) };
      if (!at50 && magLevel(t) >= 50) at50 = { magId: t.magId };
    }
    return { t, at35, at50 };
  };

  const plain = run(false);
  check('指南/存银行: 不存银行时 Lv35 恰为 15/0/0/20',
    plain.at35.level === 35 && plain.at35.stats === '15/0/0/20');
  check('指南/存银行: 不存银行时 Lv50 -> Bana', plain.at50.magId === 'Bana');
  check('指南/存银行: 不存银行时 Lv200 终态恰为 15/0/0/185（指南原话）',
    magLevel(plain.t) === 200 && stats(plain.t) === '15/0/0/185' && plain.t.magId === 'Bana');

  const banked = run(true);
  check('指南/存银行: 每次喂食后存银行时 Lv35 恰为 13/0/0/22（指南原话）',
    banked.at35.level === 35 && banked.at35.stats === '13/0/0/22');
  check('指南/存银行: 每次喂食后存银行时 Lv50 -> Bana', banked.at50.magId === 'Bana');
  check('指南/存银行: 每次喂食后存银行时 Lv200 终态恰为 13/0/0/187（指南原话）',
    magLevel(banked.t) === 200 && stats(banked.t) === '13/0/0/187' && banked.t.magId === 'Bana');
  check('指南/存银行: 存银行整整省下 2 点 DEF（185 vs 187 MIND）',
    plain.t.def - banked.t.def === 2 && banked.t.mind - plain.t.mind === 2);

  // export -> replay must reproduce 13/0/0/187: banking is serialised IN ORDER
  // relative to the feeds. If the banks were dropped (or hoisted), the very same
  // link would replay as the un-banked 15/0/0/185 mag.
  const session = exportSession(banked.t);
  const replayed = replaySession(DATA, session);
  check('指南/存银行: 导出的 feeds 里 bank 与 feed 交替（按顺序序列化）',
    session.feeds.length === banked.t.log.filter((e) => e.kind === 'feed' || e.kind === 'bank').length
    && session.feeds[0].item === 'Monofluid' && session.feeds[1].action === 'bank');
  check('指南/存银行: 导出→回放仍是 13/0/0/187 的 Bana（存银行被按序回放）',
    stats(replayed) === '13/0/0/187' && replayed.magId === 'Bana'
    && magLevel(replayed) === 200);
  check('指南/存银行: 回放后 progress 一致',
    JSON.stringify(replayed.progress) === JSON.stringify(banked.t.progress));

  // …AND IT COSTS TIME. Miku: "quitting the game or depositing and withdrawing
  // the mag […] will round down all fractional levels to the nearest 0.02.
  // However, it'll start the timer for feeding the mag all over again so it may
  // be time-consuming." A mag takes 3 feeds per ~210s feeding cycle — but a bank
  // ENDS the current cycle, so "bank after every Monofluid" is 1 feed per cycle,
  // not 3. The UI used to price both routes at ceil(feeds / 3), telling the
  // player 13/0/0/187 was free. It costs ~3x the real time; that is precisely why
  // the guide calls the trick "time-consuming".
  const plainFeeds = plain.t.log.filter((e) => e.kind === 'feed').length;
  const bankedFeeds = banked.t.log.filter((e) => e.kind === 'feed').length;
  const plainCycles = feedCycles(plain.t.log);
  const bankedCycles = feedCycles(banked.t.log);
  check('指南/存银行: 不存银行 → 每 3 次喂食一个周期', plainCycles === Math.ceil(plainFeeds / 3));
  check('指南/存银行: 每喂一次就存银行 → 每 1 次喂食一个周期（存银行重置喂食计时器）',
    bankedCycles === bankedFeeds);
  // Slightly MORE than 3x: banking costs a whole cycle per feed (3x) *and* needs
  // more feeds overall, because the shaved-off hundredths have to be re-fed.
  // 2015 feeds / 672 cycles unbanked vs 2248 feeds / 2248 cycles banked ≈ 3.35x
  // (~39 h vs ~131 h). The old ceil(items/3) called both routes 672 cycles.
  check('指南/存银行: 存银行路线要多喂几口（被抹掉的百分位得重新喂回来）',
    bankedFeeds > plainFeeds);
  check('指南/存银行: 存银行路线的周期数是不存银行的 3 倍以上（指南所谓 time-consuming）',
    bankedCycles / plainCycles > 3 && bankedCycles / plainCycles < 3.6);
  check('指南/存银行: 旧算法 ceil(道具数/3) 会把两条路线报成几乎一样的时间（这正是 bug）',
    Math.abs(Math.ceil(bankedFeeds / 3) - plainCycles) / plainCycles < 0.2
    && bankedCycles > 2.9 * Math.ceil(bankedFeeds / 3));
}

// --- feedCycles: how long the plan really takes -------------------------------
// 3 feeds per feeding cycle; a bank (or leaving the game) restarts the timer, so
// it ends the current cycle wherever it stands.
{
  const log = (...kinds) => kinds.map((k) => ({ kind: k }));
  check('周期: 空日志 → 0 个周期', feedCycles([]) === 0);
  check('周期: 1 次喂食 → 1 个周期', feedCycles(log('feed')) === 1);
  check('周期: 3 次喂食 → 1 个周期', feedCycles(log('feed', 'feed', 'feed')) === 1);
  check('周期: 4 次喂食 → 2 个周期', feedCycles(log('feed', 'feed', 'feed', 'feed')) === 2);
  check('周期: 喂食+存银行+喂食 → 2 个周期（存银行打断了周期）',
    feedCycles(log('feed', 'bank', 'feed')) === 2);
  check('周期: 喂,喂,存银行,喂 → 2 个周期（第一个周期只用掉 2 次喂食就被打断）',
    feedCycles(log('feed', 'feed', 'bank', 'feed')) === 2);
  check('周期: 喂,喂,喂,存银行,喂 → 2 个周期（周期正好满了再存银行，不额外花时间）',
    feedCycles(log('feed', 'feed', 'feed', 'bank', 'feed')) === 2);
  check('周期: 开头就存银行不算一个周期', feedCycles(log('bank', 'feed')) === 1);
  check('周期: 连续存银行不额外计费', feedCycles(log('feed', 'bank', 'bank', 'feed')) === 2);
  check('周期: 进化/规则切换等非喂食条目不计入',
    feedCycles(log('feed', 'evolve', 'racial', 'feed', 'feed')) === 1);
  // An ACCEPTED cell occupies a feed slot; a REJECTED one consumes nothing.
  const cell = (ok) => ({ kind: 'feedCell', ok });
  check('周期: 被接受的 cell 也占一次喂食',
    feedCycles([...log('feed'), cell(true), ...log('feed', 'feed')]) === 2);
  check('周期: 被拒绝的 cell 不占喂食位（不消耗任何东西）',
    feedCycles([...log('feed'), cell(false), ...log('feed', 'feed')]) === 1);
  check('周期: 一串被拒绝的 cell 完全不计入周期',
    feedCycles([cell(false), cell(false), cell(false)]) === 0);
}

// --- BUG 2: a REJECTED mag cell is not a consumed feed ------------------------
// feedOnce logs the feedCell entry BEFORE running the cell (so a resulting
// `evolve` line lands after it) and leaves it `ok:false` on rejection. The entry
// must stay in the log — the player wants to see WHY it failed — but it must not
// be billed: a refused cell consumes no item, no feed slot and no meseta, so
// feedCycles / the UI's countOf / the meseta total all filter on `consumesFeed`.
{
  const t = cs({ magId: 'Kama', def: 10, pow: 5, dex: 0, mind: 0 }); // Lv15, too low
  const ev = feedOnce(DATA, t, 'D-Photon Core');
  check('被拒绝的 cell：确实被拒绝', ev.some((e) => e.type === 'magCellRejected'));
  check('被拒绝的 cell：仍然写进日志（要让玩家看到失败原因）',
    t.log.length === 1 && t.log[0].kind === 'feedCell' && t.log[0].ok === false
    && typeof t.log[0].reason === 'string' && t.log[0].reason.length > 0);
  check('被拒绝的 cell：consumesFeed 为 false（不消耗道具/喂食位/meseta）',
    consumesFeed(t.log[0]) === false);
  check('被拒绝的 cell：不占用任何喂食周期', feedCycles(t.log) === 0);

  // ...while the accepted one does consume a feed.
  const u = cs({ magId: 'Kama', def: 70, pow: 30, dex: 0, mind: 0 }); // Lv100, passes
  feedOnce(DATA, u, 'D-Photon Core');
  const cellEntry = u.log.find((e) => e.kind === 'feedCell');
  check('被接受的 cell：consumesFeed 为 true', consumesFeed(cellEntry) === true);
  check('被接受的 cell：占用一个喂食周期', feedCycles(u.log) === 1);
}
{
  // 15 rejected cells in a row are still 0 cycles and 0 consumed items — the UI
  // prices the log with exactly this predicate, so this is the meseta bug too.
  const t = cs({ magId: 'Kama', def: 10, pow: 5, dex: 0, mind: 0 });
  for (let i = 0; i < 15; i += 1) feedOnce(DATA, t, 'D-Photon Core');
  const consumed = t.log.filter(consumesFeed);
  check('被拒绝的 cell 反复喂：0 次消耗、0 个周期，日志里 15 条失败记录',
    consumed.length === 0 && feedCycles(t.log) === 0
    && t.log.filter((e) => e.kind === 'feedCell' && e.ok === false).length === 15);
  // a normal food item is always consumed
  const u = cs({ magId: 'Rudra', def: 10, pow: 0, dex: 0, mind: 5 });
  feedOnce(DATA, u, 'Monomate');
  check('普通道具喂食始终计入消耗', consumesFeed(u.log[0]) === true);
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
