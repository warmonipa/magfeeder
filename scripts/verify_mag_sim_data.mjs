/* Asserts assets/js/mag-sim-data.js. Run: node scripts/verify_mag_sim_data.mjs */
import { readFileSync } from 'node:fs';
const src = readFileSync('assets/js/mag-sim-data.js', 'utf8');
const win = {};
new Function('window', src)(win);
const D = win.MAG_SIM;

let failed = 0;
const check = (name, cond) => {
    if (cond) console.log(`  ok   ${name}`);
    else { console.error(`  FAIL ${name}`); failed++; }
};

check('8 张喂食表', Object.keys(D.feedTables).length === 8);
check('Table0 Monomate = 5/40/5/0/3/3',
    JSON.stringify(D.feedTables['0'].Monomate) === JSON.stringify([5,40,5,0,3,3]));
check('每表 11 个道具',
    Object.values(D.feedTables).every((t) => Object.keys(t).length === 11));

check('mags 收录 Mag→Table0 stage0',
    D.mags.Mag && D.mags.Mag.feedTableId === '0' && D.mags.Mag.stage === 0);
check('Varuna→Table1 stage1',
    D.mags.Varuna && D.mags.Varuna.feedTableId === '1' && D.mags.Varuna.stage === 1);
check('Vayu 在 Table4（stage2 与 stage3 混表）',
    D.mags.Vayu && D.mags.Vayu.feedTableId === '4' && D.mags.Vayu.stage === 2);
check('cell mag Deva→Table7 stage4',
    D.mags.Deva && D.mags.Deva.feedTableId === '5' && D.mags.Deva.stage === 4);

// ---- evolution predicates --------------------------------------------------
check('stage1 by class', D.evolution.stage1.HU === 'Varuna'
    && D.evolution.stage1.RA === 'Kalki' && D.evolution.stage1.FO === 'Vritra');
check('stage2 Varuna+POW→Rudra', D.evolution.stage2.Varuna.POW === 'Rudra');
check('stage2 Kalki+DEX→Mitra', D.evolution.stage2.Kalki.DEX === 'Mitra');
check('tieBreak HU=POW', D.evolution.tieBreak.HU === 'POW');

// ---- stage3Rules: the wiki's ORDERED Lv.50 rows, keyed by CLASS -------------
// The old `stage3` map keyed 6 strict permutations by LINEAGE, plus one
// hard-coded tie row. The wiki states SEVEN ordered `≥`/`>`/`=` rows per CLASS
// and the first that holds wins — a partition the permutations cannot express.
check('evolution.stage3（6 排列表）已删除', D.evolution.stage3 === undefined);
check('evolution.stage3Ties 已删除', D.evolution.stage3Ties === undefined);
check('stage3Rules 覆盖 HU/RA/FO 三职业',
    ['HU', 'RA', 'FO'].every((c) => Array.isArray(D.evolution.stage3Rules[c])));
for (const [cls, rows] of Object.entries(D.evolution.stage3Rules)) {
    check(`stage3Rules ${cls} 为 7 行有序规则，每行 A/B 齐全`,
        rows.length === 7
        && rows.every((r) => typeof r.cond === 'string'
            && typeof r.A === 'string' && typeof r.B === 'string'));
    // every rule must be a STAT op STAT (op STAT)* chain the engine can evaluate
    check(`stage3Rules ${cls} 每条规则语法合法`,
        rows.every((r) => {
            const tok = r.cond.split(' ');
            return tok.length >= 3 && tok.length % 2 === 1
                && tok.every((t, i) => (i % 2 === 0
                    ? ['POW', 'DEX', 'MIND'].includes(t)
                    : ['>', '≥', '='].includes(t)));
        }));
}
// the rows are in WIKI ORDER — HU's first two rows, verbatim
check('stage3Rules HU 首行 = "POW ≥ DEX ≥ MIND" → A=Varaha,B=Kama',
    D.evolution.stage3Rules.HU[0].cond === 'POW ≥ DEX ≥ MIND'
    && D.evolution.stage3Rules.HU[0].A === 'Varaha'
    && D.evolution.stage3Rules.HU[0].B === 'Kama');
check('stage3Rules HU 次行 = "DEX = MIND > POW"（等号行排在严格行之前）',
    D.evolution.stage3Rules.HU[1].cond === 'DEX = MIND > POW');
// the row BUG 3 was getting wrong: HU `DEX > MIND ≥ POW` → Nandin / Yaksa
check('stage3Rules HU "DEX > MIND ≥ POW" → A=Nandin,B=Yaksa',
    D.evolution.stage3Rules.HU.some((r) => r.cond === 'DEX > MIND ≥ POW'
        && r.A === 'Nandin' && r.B === 'Yaksa'));
check('stage3Rules RA 首行 = "POW > DEX ≥ MIND" → A=Kama,B=Madhu',
    D.evolution.stage3Rules.RA[0].cond === 'POW > DEX ≥ MIND'
    && D.evolution.stage3Rules.RA[0].A === 'Kama'
    && D.evolution.stage3Rules.RA[0].B === 'Madhu');

// ---- per-mag Photon Blast ---------------------------------------------------
// Stages 1-3 each teach a PB; the mag inherits up to three. Fourth evolutions
// teach none, so their `pb` is absent.
check('mags.Varuna.pb = Farlla', D.mags.Varuna.pb === 'Farlla');
check('mags.Rudra.pb = Golla', D.mags.Rudra.pb === 'Golla');
check('mags.Varaha.pb = Golla（与 Rudra 同 PB，用于去重测试）',
    D.mags.Varaha.pb === 'Golla');
check('mags.Bhirava.pb = Pilla', D.mags.Bhirava.pb === 'Pilla');
check('四段 mag 无 PB（Deva / Gael Giel）',
    D.mags.Deva.pb === undefined && D.mags['Gael Giel'].pb === undefined);
check('基础 Mag 无 PB', D.mags.Mag.pb === undefined);
{
    const PB_NAMES = ['Golla', 'Pilla', 'Estlla', 'Farlla', 'Leilla', 'Mylla & Youlla'];
    const withPb = Object.entries(D.mags).filter(([, m]) => m.pb);
    check('每个带 PB 的 mag 都是 1-3 段，且 PB 是 6 种之一',
        withPb.length > 0
        && withPb.every(([, m]) => m.stage >= 1 && m.stage <= 3 && PB_NAMES.includes(m.pb)));
    // every stage 1-3 mag reachable by evolution learns a PB
    const noPb = Object.entries(D.mags)
        .filter(([, m]) => m.stage >= 1 && m.stage <= 3 && !m.pb).map(([n]) => n);
    check(`所有 1-3 段 mag 均有 PB（缺失：${noPb.join(', ') || '无'}）`, noPb.length === 0);
}

// ---- stage4 reference chart + mag cells ------------------------------------
// Type→formula mapping is fixed by both the wikitable and build()'s stage4:
//   Type1 → DEF+DEX=POW+MIND,  Type2 → DEF+MIND=POW+DEX,  Type3 → DEF+POW=DEX+MIND
// (Each group's single mag sits in exactly the column matching its Type.)
check('stage4 HU/M/Type1 DEF+DEX=POW+MIND → Deva',
    D.evolution.stage4.HU.M.Type1['DEF+DEX=POW+MIND'] === 'Deva');
check('stage4 HU/M/Type1 其余等式为 null',
    D.evolution.stage4.HU.M.Type1['DEF+POW=DEX+MIND'] === null
    && D.evolution.stage4.HU.M.Type1['DEF+MIND=POW+DEX'] === null);
// Brief Step-1 wrote FO/F/Type2 under 'DEF+DEX=POW+MIND' (Type1's key) by
// copy-paste; the wiki puts Bhima under Type2's column DEF+MIND=POW+DEX.
check('stage4 FO/F/Type2 DEF+MIND=POW+DEX → Bhima',
    D.evolution.stage4.FO.F.Type2['DEF+MIND=POW+DEX'] === 'Bhima');
check('stage4 FO/F/Type2 DEF+DEX=POW+MIND 为 null',
    D.evolution.stage4.FO.F.Type2['DEF+DEX=POW+MIND'] === null);
// table walk generalizes beyond HU: one RA mag and one FO mag
check('stage4 RA/M/Type1 → Pushan',
    D.evolution.stage4.RA.M.Type1['DEF+DEX=POW+MIND'] === 'Pushan');
check('stage4 FO/M/Type3 → Nidra',
    D.evolution.stage4.FO.M.Type3['DEF+POW=DEX+MIND'] === 'Nidra');
// a colspan '-' null cell (Type3's mag is in col0, so col1/col2 are null)
check('stage4 RA/F/Type3 DEF+DEX=POW+MIND 为 null (colspan -)',
    D.evolution.stage4.RA.F.Type3['DEF+DEX=POW+MIND'] === null);

check('magCells 收录 Heart of Devil',
    !!D.magCells['Heart of Devil']);
check('Heart of Devil 目标含 Devil Tail + Devil Wing',
    Array.isArray(D.magCells['Heart of Devil'].target)
    && D.magCells['Heart of Devil'].target.includes("Devil's Tail")
    && D.magCells['Heart of Devil'].target.includes("Devil's Wing"));
check('Heart of Devil 可再进化（白名单）',
    D.magCells['Heart of Devil'].reEvoWhitelist === true);
check('普通 cell 非白名单 (Dragon Scale)',
    D.magCells['Dragon Scale'] && D.magCells['Dragon Scale'].reEvoWhitelist === false);
// carry-forward: every cell-target mag lands in mags on feeding table 7 / stage 4
check('cell mag Gael Giel → Table7 stage4',
    D.mags['Gael Giel'] && D.mags['Gael Giel'].feedTableId === '7'
    && D.mags['Gael Giel'].stage === 4);

// ---- structured mag-cell requirements (review I2) ---------------------------
// The character level and the MAG level are separate gates: the old parser
// grabbed the first "Level N+" in the text, so the System chain stored the
// character level and lost the mag level entirely.
{
    const r = D.magCells['Kit of Genesis'].requires.Genesis;
    check('Kit of Genesis 拆分 minCharLevel 80 / minMagLevel 70',
        r.minCharLevel === 80 && r.minMagLevel === 70 && r.requiresMag === 'Master System');
    check('minLevel 键已废弃', r.minLevel === undefined);
}
check('Panther\'s Spirit minMagLevel 50 + requiresMag Naga',
    D.magCells["Panther's Spirit"].requires["Panzer's Tail"].minMagLevel === 50
    && D.magCells["Panther's Spirit"].requires["Panzer's Tail"].requiresMag === 'Naga');
// "third evolution Mag" → requiredStage 3；"any basic Mag" → requiredStage 0
check('Heart of Chu Chu requiredStage 3',
    D.magCells['Heart of Chu Chu'].requires['Chu Chu'].requiredStage === 3);
check('Kit of Mark III requiredStage 0（基础 Mag）',
    D.magCells['Kit of Mark III'].requires['Mark III'].requiredStage === 0);
check('Any-<species> cell 无 requiredStage（Heart of Devil → Devil\'s Tail）',
    D.magCells['Heart of Devil'].requires["Devil's Tail"].requiredStage === undefined
    && D.magCells['Heart of Devil'].requires["Devil's Tail"].requiresMag === "Devil's Wing");
check('Heart of Pian minSynchro 120 / minIQ 180 / minMagLevel 120',
    D.magCells['Heart of Pian'].requires.Pian.minSynchro === 120
    && D.magCells['Heart of Pian'].requires.Pian.minIQ === 180
    && D.magCells['Heart of Pian'].requires.Pian.minMagLevel === 120);
check('Heart of Chao statThreshold 35/all',
    D.magCells['Heart of Chao'].requires.Chao.statThreshold.value === 35
    && D.magCells['Heart of Chao'].requires.Chao.statThreshold.count === 'all');
check('Parts of RoboChao statThreshold 70/2',
    D.magCells['Parts of RoboChao'].requires.Robochao.statThreshold.value === 70
    && D.magCells['Parts of RoboChao'].requires.Robochao.statThreshold.count === 2);
check('Cell of Mag 213 Churel = A 组 + 三段 + Lv100',
    D.magCells['Cell of Mag 213'].requires.Churel.race === 'A'
    && D.magCells['Cell of Mag 213'].requires.Churel.requiredStage === 3
    && D.magCells['Cell of Mag 213'].requires.Churel.minMagLevel === 100);
// every requirement keeps its raw wiki text and gates on something checkable
{
    const reqs = Object.values(D.magCells).flatMap((c) => Object.values(c.requires));
    check('36 个 cell 的每条 requires 都带 raw 原文',
        Object.keys(D.magCells).length === 36
        && reqs.length > 0 && reqs.every((r) => typeof r.raw === 'string' && r.raw));
    check('每条 requires 至少有 requiresMag 或 requiredStage',
        reqs.every((r) => r.requiresMag !== undefined || r.requiredStage !== undefined));
}

// ---- racial restrictions (hand-maintained CELL_RACE_RULES) ------------------
// The wiki carries no race data for cells; the generator mirrors Magatama's
// MagCellsError.xml. Exactly three cells carry a raceRule, and no others.
check("Heart of Angel raceRule deny=[Android]",
    JSON.stringify(D.magCells['Heart of Angel'].raceRule) === '{"deny":["Android"]}');
check("Heart of Devil raceRule deny=[Android]",
    JSON.stringify(D.magCells['Heart of Devil'].raceRule) === '{"deny":["Android"]}');
check("Heart of YN-0117 raceRule only=[Android]",
    JSON.stringify(D.magCells['Heart of YN-0117'].raceRule) === '{"only":["Android"]}');
{
    const withRule = Object.keys(D.magCells).filter((c) => D.magCells[c].raceRule);
    check('只有这 3 个 cell 带 raceRule，其余 33 个不带',
        withRule.length === 3 && Object.keys(D.magCells).length === 36
        && withRule.join() === ['Heart of Angel', 'Heart of Devil', 'Heart of YN-0117'].sort().join());
    const RACES = ['Human', 'Newman', 'Android'];
    check('raceRule 结构合法（deny/only 二选一，值为已知种族）',
        withRule.every((c) => {
            const r = D.magCells[c].raceRule;
            const keys = Object.keys(r);
            return keys.length === 1 && (keys[0] === 'deny' || keys[0] === 'only')
                && Array.isArray(r[keys[0]]) && r[keys[0]].length > 0
                && r[keys[0]].every((x) => RACES.includes(x));
        }));
}

// ---- constants -------------------------------------------------------------
check('itemOrder 11 项且以 Monomate 开头 Star Atomizer 结尾',
    D.itemOrder.length === 11 && D.itemOrder[0] === 'Monomate'
    && D.itemOrder[10] === 'Star Atomizer');
check('costs.Trimate = 2000', D.costs.Trimate === 2000);
check('freshMag = DEF5 Synchro20', D.freshMag.def === 5 && D.freshMag.synchro === 20);
check('idGroups.Type1 含 Viridia', D.idGroups.Type1.includes('Viridia'));

// ---- FO's Lv.50 DEF>=45 special (sits ahead of the rule rows) ---------------
check('stage3SpecialFO Andhaka/Bana minDef 45',
    D.evolution.stage3SpecialFO.powMax === 'Andhaka'
    && D.evolution.stage3SpecialFO.other === 'Bana'
    && D.evolution.stage3SpecialFO.minDef === 45);

// ---- the two cells the "List of Mag cells" table omits -----------------------
// That table lists 34 cells; the "List of cell Mags" table lists 36 mags. Mag
// Gift Wrap → Present* (an event item, currently obtainable) and Seed Exchange
// Kit → Saraswati ("Currently unavailable") appear ONLY in the latter, so
// scraping the former alone silently dropped both. Both are real cell mags with
// real requirements, so the generator now takes the cell list from the cell-Mags
// table too.
check('Mag Gift Wrap → Present*（wiki 的 List of cell Mags 里有，List of Mag cells 里没有）',
    D.magCells['Mag Gift Wrap']
    && D.magCells['Mag Gift Wrap'].target === 'Present*');
check('Mag Gift Wrap 的条件：Level 100+ third evolution Mag',
    D.magCells['Mag Gift Wrap'].requires['Present*'].minMagLevel === 100
    && D.magCells['Mag Gift Wrap'].requires['Present*'].requiredStage === 3);
check('Present* 已登记为四段 mag（可被喂食表引用）',
    D.mags['Present*'] && D.mags['Present*'].stage === 4);

check('Seed Exchange Kit → Saraswati',
    D.magCells['Seed Exchange Kit']
    && D.magCells['Seed Exchange Kit'].target === 'Saraswati');
check('Seed Exchange Kit 的条件：Level 100+ third evolution Mag',
    D.magCells['Seed Exchange Kit'].requires.Saraswati.minMagLevel === 100
    && D.magCells['Seed Exchange Kit'].requires.Saraswati.requiredStage === 3);
check('Saraswati 已登记为四段 mag', D.mags.Saraswati && D.mags.Saraswati.stage === 4);
// The wiki's Notes column says "Currently unavailable" for Saraswati and nothing
// of the sort for Present*, so exactly one of the two is flagged.
check('Seed Exchange Kit 标记为当前不可获得（wiki: "Currently unavailable"）',
    D.magCells['Seed Exchange Kit'].unobtainable === true);
check('Mag Gift Wrap 没有被标记为不可获得（活动道具，当前可获得）',
    D.magCells['Mag Gift Wrap'].unobtainable === undefined);
{
    const flagged = Object.keys(D.magCells).filter((c) => D.magCells[c].unobtainable);
    check('只有 Seed Exchange Kit 一个 cell 被标记为不可获得',
        flagged.join() === 'Seed Exchange Kit');
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
