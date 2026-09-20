// assets/js/mag-sim-ui.js
// The whole simulator page: setup panel, live Mag card, feed bar, history log
// and the undo/reset/export/share controls. All rules live in the (DOM-free)
// engine; this file only renders `state` and feeds events back into it.
import * as E from './mag-sim-engine.js';
import { planMag } from './mag-sim-planner.js';
import { ITEM_NAMES } from './items_i18n.js';

const DATA = window.MAG_SIM;

function itemLabel(name) {
    const zh = ITEM_NAMES[name];
    if (!zh) throw new Error(`Missing authoritative item name: ${name}`);
    return zh === name ? name : `${zh}（${name}）`;
}

let state = E.createState(DATA, { start: { mode: 'fresh' } });
const history = []; // undo snapshot stack (Tasks 12-15)

// The custom start's Photon Blasts. Lives outside `state` for the same reason
// feedQty does: it is a control the user dials in, read only when a custom start
// is applied (renderSetup rebuilds its own innerHTML, so it cannot live in DOM).
let customPBs = [];

const SECTION_IDS = ['Viridia', 'Skyly', 'Purplenum', 'Redria', 'Yellowboze',
    'Greenill', 'Bluefull', 'Pinkal', 'Oran', 'Whitill'];
const STAGE_LABEL = { 0: '初始 (Lv.0)', 1: '一段 (Lv.10)', 2: '二段 (Lv.35)', 3: '三段 (Lv.50)', 4: '四段 (Lv.100)' };
const LINE_LABEL = { HU: '战士', RA: '枪手', FO: '法师' };
const GENDER_LABEL = { M: '男', F: '女' };
const RACE_LABEL = { Human: '人类', Newman: '新人类', Android: '机器人' };

// The 12 PSO classes. Each one uniquely fixes the class LINE (which drives the
// stage1/stage4 evolution branches), the GENDER (stage4) and the RACE (the mag
// cell racial restrictions) — so one picker replaces the old 职业 + 性别 pair
// and is the only way the sim can know the feeder's race at all.
const CLASSES = [
    { name: 'HUmar',     line: 'HU', gender: 'M', race: 'Human' },
    { name: 'HUnewearl', line: 'HU', gender: 'F', race: 'Newman' },
    { name: 'HUcast',    line: 'HU', gender: 'M', race: 'Android' },
    { name: 'HUcaseal',  line: 'HU', gender: 'F', race: 'Android' },
    { name: 'RAmar',     line: 'RA', gender: 'M', race: 'Human' },
    { name: 'RAmarl',    line: 'RA', gender: 'F', race: 'Human' },
    { name: 'RAcast',    line: 'RA', gender: 'M', race: 'Android' },
    { name: 'RAcaseal',  line: 'RA', gender: 'F', race: 'Android' },
    { name: 'FOmar',     line: 'FO', gender: 'M', race: 'Human' },
    { name: 'FOmarl',    line: 'FO', gender: 'F', race: 'Human' },
    { name: 'FOnewm',    line: 'FO', gender: 'M', race: 'Newman' },
    { name: 'FOnewearl', line: 'FO', gender: 'F', race: 'Newman' },
];

// (line, gender, race) -> class: the mapping is a bijection, so the picker's
// selection can always be recovered from state.feeder alone (e.g. after a
// shared session is replayed) — feeder carries no redundant class name.
function classOf(feeder) {
    return CLASSES.find((c) => c.line === feeder.class && c.gender === feeder.gender
        && c.race === feeder.race) || CLASSES[0];
}

function feederSummary(feeder) {
    const c = classOf(feeder);
    return `${c.line}（${LINE_LABEL[c.line]}）· ${GENDER_LABEL[c.gender]} · ${RACE_LABEL[c.race]}`;
}

// Rebuilds `state` from scratch (start mode / custom stats changed) and
// discards any feed history, since the mag itself is a different object now.
// The feeder and the 种族限制 toggle are properties of the *player*, not of the
// mag, so they survive a restart — otherwise they would silently snap back to
// the engine defaults while the setup panel still showed the old picks.
function applyStart(start) {
    const { feeder, racialRestriction } = state;
    state = E.createState(DATA, { start });
    state.feeder = { ...feeder };
    // Through the engine, not by assignment: on a fresh state (empty log) this
    // records the toggle as the session's STARTING value, which is what
    // exportSession serialises. A bare assignment would leave `_racial0` stale.
    E.setRacialRestriction(state, racialRestriction);
    history.length = 0;
    render();
}

// The feeder only decides which evolution branch a future feed takes; it
// never invalidates past progress, so this mutates state.feeder in place.
function setFeeder(patch) {
    Object.assign(state.feeder, patch);
    render();
}

// The six Photon Blasts, in the game's own order. Taken from the mag data itself
// (every mag that teaches a PB names it), so this list cannot drift from the
// engine's; `window.MAG_EVOLUTION.meta.pbNames` only supplies the Chinese names
// and the canonical order when that (deferred) script has run.
function allPBs() {
    const known = Object.values(DATA.mags).map((m) => m.pb).filter(Boolean);
    const ordered = Object.keys(window.MAG_EVOLUTION?.meta?.pbNames || {});
    const rest = [...new Set(known)].filter((pb) => !ordered.includes(pb)).sort();
    return [...ordered.filter((pb) => known.includes(pb)), ...rest];
}

// A real third-evolution mag has already learned its Photon Blasts (at levels
// 10 / 35 / 50), so a custom start has to be able to say which — otherwise the
// sim starts it with an empty rack and then promises PBs the player's mag can
// never get. Up to three, exactly as the mag can hold.
const MAX_PBS = 3;
function customPBsHtml(selected) {
    return allPBs().map((pb) => {
        const zh = window.MAG_EVOLUTION?.meta?.pbNames?.[pb] || '';
        const on = selected.includes(pb);
        return `<label class="mag-sim-setup__pb${on ? ' is-on' : ''}">
            <input type="checkbox" data-custom-pb="${esc(pb)}"${on ? ' checked' : ''}>
            <span>${esc(zh || pb)}<em>${esc(pb)}</em></span>
        </label>`;
    }).join('');
}

function speciesOptionsHtml() {
    const byStage = {};
    Object.entries(DATA.mags).forEach(([id, m]) => {
        (byStage[m.stage] || (byStage[m.stage] = [])).push(id);
    });
    return Object.keys(byStage)
        .sort((a, b) => Number(a) - Number(b))
        .map((stage) => {
            const opts = byStage[stage].sort()
                .map((id) => `<option value="${esc(id)}">${esc(itemLabel(id))}</option>`).join('');
            return `<optgroup label="${STAGE_LABEL[stage] || `阶段 ${stage}`}">${opts}</optgroup>`;
        }).join('');
}

function renderSetup() {
    const root = document.querySelector('[data-sim-setup]');
    if (!root) return;

    // renderSetup() can run again after importing/replaying a plan. Retire the
    // previous document-level outside-click listener before replacing its DOM.
    root._setupPickerAbort?.abort();
    root._setupPickerAbort = new AbortController();

    const fresh = DATA.freshMag;
    const sectionId = state.feeder.sectionId;
    const feederClass = classOf(state.feeder);
    root.innerHTML = `
        <h2>起始设置</h2>
        <fieldset class="mag-sim-setup__block">
            <legend>起始 Mag</legend>
            <div class="mag-tabs" role="tablist" data-start-tabs>
                <button type="button" class="mag-tab" role="tab" data-mode="fresh" aria-selected="true">全新 Mag</button>
                <button type="button" class="mag-tab" role="tab" data-mode="custom" aria-selected="false">自定义</button>
            </div>
            <div class="mag-sim-setup__custom" data-custom-fields hidden>
                <label class="mag-sim-setup__field">
                    <span>种类</span>
                    <select data-custom="magId">${speciesOptionsHtml()}</select>
                </label>
                <div class="mag-sim-setup__stats">
                    <label>DEF<input type="number" data-custom="def" value="${fresh.def}" min="0" max="200" step="1"></label>
                    <label>POW<input type="number" data-custom="pow" value="${fresh.pow}" min="0" max="200" step="1"></label>
                    <label>DEX<input type="number" data-custom="dex" value="${fresh.dex}" min="0" max="200" step="1"></label>
                    <label>MIND<input type="number" data-custom="mind" value="${fresh.mind}" min="0" max="200" step="1"></label>
                    <label>同步率<input type="number" data-custom="synchro" value="${fresh.synchro}" min="0" max="120" step="1"></label>
                    <label>IQ<input type="number" data-custom="iq" value="${fresh.iq}" min="0" max="200" step="1"></label>
                </div>
                <div class="mag-sim-setup__label">已学会的 Photon Blast（最多 3 个）</div>
                <div class="mag-sim-setup__pbs" data-custom-pbs>${customPBsHtml(customPBs)}</div>
                <button type="button" class="mag-sim-setup__apply" data-apply-custom>应用自定义设置</button>
            </div>
        </fieldset>

        <fieldset class="mag-sim-setup__block">
            <legend>喂食者</legend>
            <div class="mag-sim-setup__row">
                <div class="mag-sim-setup__field">
                    <span>职业</span>
                    <div class="mag-choice-picker mag-class-picker" data-feeder-class-picker>
                        <button type="button" class="mag-class-chip mag-choice-picker__trigger"
                            data-picker-trigger aria-haspopup="listbox" aria-expanded="false"
                            aria-controls="feeder-class-list">
                            <img data-picker-icon src="./assets/img/class/${feederClass.name}.png" alt="" width="24" height="28">
                            <span data-picker-label>${feederClass.name}</span>
                            <span class="mag-choice-picker__chevron" aria-hidden="true">⌄</span>
                        </button>
                        <div class="mag-choice-picker__menu mag-class-picker__menu" id="feeder-class-list"
                            role="listbox" aria-label="职业" hidden>
                            ${['HU', 'RA', 'FO'].map((line) => `
                                <div class="mag-class-picker__group" role="group" aria-label="${line}（${LINE_LABEL[line]}）">
                                    <div class="mag-class-picker__group-label" aria-hidden="true">${line} · ${LINE_LABEL[line]}</div>
                                    ${CLASSES.filter((c) => c.line === line).map((c) => `
                                        <button type="button" class="mag-class-chip mag-choice-picker__option"
                                            role="option" data-class="${c.name}" aria-selected="${c.name === feederClass.name}">
                                            <img src="./assets/img/class/${c.name}.png" alt="" width="24" height="28" loading="lazy">
                                            <span>${c.name}</span>
                                        </button>`).join('')}
                                </div>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="mag-sim-setup__field">
                    <span>Section ID</span>
                    <div class="mag-choice-picker mag-section-picker" data-feeder-section>
                        <button type="button" class="mag-id-chip mag-choice-picker__trigger mag-section-picker__trigger"
                            data-picker-trigger aria-haspopup="listbox" aria-expanded="false"
                            aria-controls="feeder-section-list">
                            <img data-picker-icon src="./assets/img/section/icon/${sectionId}.png" alt="" width="16" height="16">
                            <span data-picker-label>${sectionId}</span>
                            <span class="mag-choice-picker__chevron" aria-hidden="true">⌄</span>
                        </button>
                        <div class="mag-choice-picker__menu mag-section-picker__menu" id="feeder-section-list" role="listbox"
                            aria-label="Section ID" hidden>
                            ${SECTION_IDS.map((id) => `
                                <button type="button" class="mag-id-chip mag-choice-picker__option"
                                    role="option" data-id="${id}" aria-selected="${id === sectionId}">
                                    <img src="./assets/img/section/icon/${id}.png" alt="" width="16" height="16" loading="lazy">${id}
                                </button>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="mag-sim-setup__field">
                    <span>Mag Cell 种族限制</span>
                    <label class="mag-rule-toggle"
                        title="Ephinea 已于 2017-01-09 取消此限制。开启后按经典 PSO 规则模拟。">
                        <input type="checkbox" data-racial-restriction${state.racialRestriction ? ' checked' : ''}>
                        <span class="mag-rule-toggle__switch" aria-hidden="true"></span>
                        <span class="mag-rule-toggle__name">经典规则</span>
                        <span class="mag-rule-toggle__state" aria-hidden="true"></span>
                    </label>
                </div>
            </div>
            <div class="mag-sim-setup__derived" data-feeder-summary>${esc(feederSummary(state.feeder))}</div>
        </fieldset>
    `;

    // ---- start mode ----
    const startTabs = root.querySelector('[data-start-tabs]');
    const customFields = root.querySelector('[data-custom-fields]');
    const magSelect = root.querySelector('[data-custom="magId"]');

    function currentCustomStart() {
        const val = (name) => Number(root.querySelector(`[data-custom="${name}"]`).value) || 0;
        return {
            mode: 'custom',
            magId: magSelect.value,
            def: val('def'), pow: val('pow'), dex: val('dex'), mind: val('mind'),
            synchro: val('synchro'), iq: val('iq'),
            pbs: [...customPBs],
        };
    }

    startTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mode]');
        if (!btn) return;
        startTabs.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
        customFields.hidden = btn.dataset.mode !== 'custom';
        applyStart(btn.dataset.mode === 'custom' ? currentCustomStart() : { mode: 'fresh' });
    });

    // The PB picker is capped at three (a mag holds three): a fourth tick is
    // refused rather than silently dropped by the engine's slice().
    const pbBox = root.querySelector('[data-custom-pbs]');
    pbBox.addEventListener('change', (e) => {
        const box = e.target.closest('[data-custom-pb]');
        if (!box) return;
        const pb = box.dataset.customPb;
        if (box.checked && customPBs.length >= MAX_PBS) {
            box.checked = false;                       // full rack — refuse the 4th
            return;
        }
        customPBs = box.checked
            ? [...customPBs, pb]
            : customPBs.filter((x) => x !== pb);
        box.closest('.mag-sim-setup__pb').classList.toggle('is-on', box.checked);
    });

    customFields.addEventListener('change', () => {
        if (customFields.hidden) return;
        applyStart(currentCustomStart());
    });

    root.querySelector('[data-apply-custom]').addEventListener('click', () => {
        applyStart(currentCustomStart());
    });

    // ---- feeder ----
    const summary = root.querySelector('[data-feeder-summary]');

    // Flipping the toggle mid-session is an ACTION: it decides which cell feeds
    // were accepted, so it goes into the ordered log (like a bank) and rides
    // along in the shared link. An undo snapshot is pushed first, so the flip is
    // undoable like every other action.
    root.querySelector('[data-racial-restriction]').addEventListener('change', (e) => {
        const snapshot = structuredClone(state);
        const before = state.log.length;
        E.setRacialRestriction(state, e.target.checked);
        // A flip made before the first feed is just the session's starting value
        // and writes no log entry — nothing to undo, so no snapshot is pushed.
        if (state.log.length > before) history.push(snapshot);
        render();
    });

    // A shared, accessible listbox controller for the class and Section ID
    // pickers. The menu uses fixed positioning because the desktop workbench's
    // setup panel is a scroll container; an absolute child would be clipped to
    // a single visible row at the bottom of that panel.
    function bindChoicePicker(picker, optionSelector, onChoose) {
        const trigger = picker.querySelector('[data-picker-trigger]');
        const menu = picker.querySelector('[role="listbox"]');
        const options = [...menu.querySelectorAll(optionSelector)];

        function positionMenu() {
            const rect = trigger.getBoundingClientRect();
            menu.style.visibility = 'hidden';
            menu.hidden = false;
            const menuHeight = menu.offsetHeight;
            const menuWidth = menu.offsetWidth;
            const below = rect.bottom + 4;
            const top = below + menuHeight <= window.innerHeight - 8
                ? below
                : Math.max(8, rect.top - menuHeight - 4);
            menu.style.top = `${top}px`;
            menu.style.left = `${Math.min(rect.left, window.innerWidth - menuWidth - 8)}px`;
            menu.style.visibility = '';
        }

        function setOpen(open, { focusSelected = false } = {}) {
            if (open) positionMenu();
            else menu.hidden = true;
            trigger.setAttribute('aria-expanded', String(open));
            if (open && focusSelected) {
                (options.find((option) => option.getAttribute('aria-selected') === 'true') || options[0])?.focus();
            }
        }

        function choose(option) {
            options.forEach((item) => item.setAttribute('aria-selected', String(item === option)));
            onChoose(option, trigger);
            setOpen(false);
            trigger.focus();
        }

        picker.addEventListener('click', (e) => {
            const option = e.target.closest(optionSelector);
            if (option) {
                choose(option);
                return;
            }
            if (e.target.closest('[data-picker-trigger]')) {
                setOpen(trigger.getAttribute('aria-expanded') !== 'true');
            }
        });

        picker.addEventListener('keydown', (e) => {
            const option = e.target.closest(optionSelector);
            if (e.target.closest('[data-picker-trigger]')) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    setOpen(true, { focusSelected: true });
                } else if (e.key === 'Escape') {
                    setOpen(false);
                }
                return;
            }
            if (!option) return;

            const index = options.indexOf(option);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                options[(index + step + options.length) % options.length].focus();
            } else if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                options[e.key === 'Home' ? 0 : options.length - 1].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                choose(option);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                trigger.focus();
            }
        });

        document.addEventListener('click', (e) => {
            if (!picker.contains(e.target)) setOpen(false);
        }, { signal: root._setupPickerAbort.signal });
        window.addEventListener('resize', () => setOpen(false), { signal: root._setupPickerAbort.signal });
        document.addEventListener('scroll', (e) => {
            if (!picker.contains(e.target)) setOpen(false);
        }, { capture: true, signal: root._setupPickerAbort.signal });
    }

    bindChoicePicker(root.querySelector('[data-feeder-class-picker]'), '[data-class]', (option, trigger) => {
        const c = CLASSES.find((item) => item.name === option.dataset.class) || CLASSES[0];
        trigger.querySelector('[data-picker-icon]').src = `./assets/img/class/${c.name}.png`;
        trigger.querySelector('[data-picker-label]').textContent = c.name;
        setFeeder({ class: c.line, gender: c.gender, race: c.race });
        summary.textContent = feederSummary(state.feeder);
    });

    bindChoicePicker(root.querySelector('[data-feeder-section]'), '[data-id]', (option, trigger) => {
        const id = option.dataset.id;
        trigger.querySelector('[data-picker-icon]').src = `./assets/img/section/icon/${id}.png`;
        trigger.querySelector('[data-picker-label]').textContent = id;
        setFeeder({ sectionId: id });
    });
}

// ---------- planner tab ----------

function currentPlannerTarget(root) {
    const val = (name) => Number(root.querySelector(`[data-planner="${name}"]`).value) || 0;
    return {
        magId: root.querySelector('[data-planner="magId"]').value,
        def: val('def'), pow: val('pow'), dex: val('dex'), mind: val('mind'),
    };
}

// A plan segment's feeder is `{class, gender, sectionId}` only — no `race`
// (buildPlanForFeeder in mag-sim-planner.js never records one: any feeder of
// that class+gender+Section-ID reproduces the same feed table, so the plan
// never needed to pin a race down). classOf()/feederSummary() key off
// (line, gender, race) and would silently fall back to CLASSES[0] (HUmar) on
// a segment feeder, so this reuses their LINE_LABEL/GENDER_LABEL tables
// directly instead of the two lookup helpers themselves.
function planFeederLabel(feeder) {
    return `${feeder.class}（${LINE_LABEL[feeder.class] || feeder.class}）· ${GENDER_LABEL[feeder.gender] || feeder.gender}`;
}

// The same Section-ID chip markup mag-sim-ui already renders for the feeder
// picker (setFeederPanel) and mag-chart.js renders for reverse-search cards —
// reused verbatim (icon path + `.mag-id-chip` class) so a plan step reads as
// the same kind of object as the picker the player just used.
function sectionChipHtml(id) {
    return `<span class="mag-id-chip" aria-hidden="true">`
        + `<img src="./assets/img/section/icon/${encodeURIComponent(id)}.png" alt="" width="16" height="16" loading="lazy">${esc(id)}</span>`;
}

function planStepHtml(seg, i) {
    const feedsHtml = seg.feeds
        .map((f) => `<li>${esc(itemLabel(f.item))} ×${f.count}</li>`).join('');
    const bankHtml = seg.banks
        ? `<div class="mag-plan-step__bank">存银行 ×${seg.banks}</div>` : '';
    const evolutionHtml = seg.viaCell
        ? `${esc(itemLabel(seg.magFrom))} → 使用 Cell <b>${esc(itemLabel(seg.viaCell))}</b> → <b>${esc(itemLabel(seg.magTo))}</b>（Lv ${seg.evoLevel}）`
        : `${esc(itemLabel(seg.magFrom))} → 进化到 <b>${esc(itemLabel(seg.magTo))}</b>（Lv ${seg.evoLevel}）`;
    return `<div class="mag-plan-step">
        <div class="mag-plan-step__head">
            <span class="mag-plan-step__no">第 ${i + 1} 段</span>
            <span class="mag-plan-step__feeder">${esc(planFeederLabel(seg.feeder))}</span>
            ${sectionChipHtml(seg.feeder.sectionId)}
        </div>
        <ul class="mag-plan-step__feeds">${feedsHtml}</ul>
        ${bankHtml}
        <div class="mag-plan-step__evo">${evolutionHtml}</div>
    </div>`;
}

// Totals footer — same formula the feed bar's own totals use (feedCycles()
// walked cycle count × SECONDS_PER_CYCLE), just fed from plan.totals instead
// of the live state.log, so a plan cannot show a different "how long will
// this take" number than actually feeding it out would.
function planTotalsHtml(totals) {
    const minutes = (totals.cycles * SECONDS_PER_CYCLE) / 60;
    return `<div class="mag-plan-totals">
        <span>总道具：<b>${totals.items}</b></span>
        <span>花费：<b>${totals.meseta.toLocaleString()}</b> meseta</span>
        <span>周期：<b>${totals.cycles}</b>（≈ ${minutes.toFixed(1)} 分钟）</span>
        <span>存银行：<b>${totals.banks}</b> 次</span>
    </div>`;
}

// The step cards + totals footer both an exact plan and an approximate plan
// render identically — only the banner above them (renderPlannerResult)
// tells the two apart, since the approximate plan's cards genuinely are the
// steps to the nearest reachable point.
//
// `data-planner-actions` is an intentionally empty slot: the "导入模拟器"
// button hangs here without this code needing to know that button's shape.
function planCardsHtml(plan) {
    return `<div class="mag-plan-steps">${plan.segments.map(planStepHtml).join('')}</div>`
        + planTotalsHtml(plan.totals)
        + `<div class="mag-plan-actions" data-planner-actions></div>`;
}

// Switches to the 模拟器 page tab by dispatching a real click on its tab
// button — reuses initPageTabs()'s own delegated listener (aria-selected +
// panel[hidden] bookkeeping) instead of duplicating it here.
function switchToSimulatorTab() {
    document.getElementById('page-tab-sim')?.click();
}

// Walks a plan's segments/order into the exact `{start, feeds}` shape
// E.replaySession() consumes (the same shape exportSession() produces): a
// FEED `{item, feeder}` or a BANK `{action:'bank'}`. Every step in a segment
// shares that segment's feeder — buildPlanForFeeder() never records a race on
// it (any feeder of that class+gender+Section-ID reproduces the same feed
// table: race only gates mag-cell racial rules, which default off) — but the
// imported state IS shown in the setup panel, and classOf() keys off
// (line, gender, race) as a bijection into the 12-class picker. Hard-coding
// 'Human' the way replayPlan() does in mag-sim-planner.js (fine there — it
// never renders a picker) would desync a HU/F segment from every HU/F class
// (HUnewearl=Newman, HUcaseal=Android — there IS no HU/F/Human): classOf()
// would find no match, fall back to CLASSES[0] (HUmar) and the panel would
// show "HUmar / 男" for a feeder whose gender is actually 'F'. So look up the
// one CLASSES entry that actually has this (line, gender) and borrow ITS race
// — the canonical, and only correct, choice for the picker.
function planToSession(plan) {
    const feeds = [];
    for (const seg of plan.segments) {
        const cls = CLASSES.find((c) => c.line === seg.feeder.class && c.gender === seg.feeder.gender);
        const feeder = { ...seg.feeder, race: seg.feeder.race || (cls ? cls.race : 'Human') };
        for (const step of seg.order) {
            feeds.push(step.bank ? { action: 'bank' } : { item: step.item, feeder });
        }
    }
    return { start: { mode: 'fresh' }, feeds };
}

// The closed loop: replay the plan through the SAME engine planMag() itself
// validated it against (replaySession, not a re-simulation of our own), swap
// it in as the live `state`, wipe the undo stack (a different mag now), and
// jump to the 模拟器 tab so the user immediately sees the finished mag + the
// full history log — exact plans land exactly on the target; approximate
// plans land on the nearest reachable point the banner already named.
function importPlanIntoSimulator(plan) {
    state = E.replaySession(window.MAG_SIM, planToSession(plan));
    history.length = 0;
    switchToSimulatorTab();
    // Rebuild the setup panel too, not just the card/log: replaySession replaces
    // `state` wholesale (new feeder / start), and only renderSetup() re-syncs the
    // 职业 select, Section-ID chips, 种族限制 checkbox and start-mode tabs — same
    // reason the #r= shared-link replay calls it before the first render().
    renderSetup();
    render();
}

// Shown for both exact and approximate plans (an approximate plan is still a
// real, replayable sequence) — never for the unreachable case, which has no
// `plan` object to import. The approximate label says explicitly that the
// button lands on the nearest point, not the target, so it can't be mistaken
// for a successful exact import.
function planImportActionsHtml(plan) {
    const label = plan.approximate ? '导入模拟器（最近可达点）' : '导入模拟器';
    const note = plan.approximate
        ? `<p class="mag-plan-actions__note">将回放到上方最接近目标的可达方案，而非精确目标。</p>` : '';
    return `<button type="button" class="mag-sim-setup__apply" data-import-plan>${label}</button>${note}`;
}

// Binds the import button inside the `data-planner-actions` slot planCardsHtml
// just rendered. A plain closure over `plan` (not a data-attribute) — the
// plan object itself is what importPlanIntoSimulator() needs, not a
// re-parsed copy of it.
function bindPlanImportActions(box, plan) {
    const actions = box.querySelector('[data-planner-actions]');
    if (!actions) return;
    actions.innerHTML = planImportActionsHtml(plan);
    actions.querySelector('[data-import-plan]').addEventListener('click', () => importPlanIntoSimulator(plan));
}

// Reads `outcome` (planMag's `{plan, nearest, reason}`) straight from the
// closure solvePlanner passes in, and takes `magId` as the target that was
// ACTUALLY solved (captured by solvePlanner before its setTimeout(0) yield) —
// not re-read from the live form — so a stale async response can never be
// rendered under a newer target's label (see solvePlanner).
//
// Three modes:
//   - exact plan: "✅ 低喂食方案" — never "保证最少". The solver is a bounded
//     heuristic search (see mag-sim-planner.js), not an exhaustive one, so it
//     can find A low-feed plan but never PROVES it is the fewest possible;
//     claiming a guaranteed minimum would be a promise the code cannot back.
//   - approximate plan (plan.approximate && nearest): a visually distinct
//     amber banner naming the nearest reachable point, above the SAME step
//     cards — those steps really do end there, they just don't reach target.
//   - unreachable (plan === null): a fail line naming the target + the
//     solver's own human-readable reason underneath, esc()'d (it can contain
//     mag names / formulas straight from data, never trusted as safe HTML).
function renderPlannerResult(root, outcome, magId) {
    const box = root.querySelector('[data-planner-result]');
    if (!box) return;
    const { plan, nearest, reason } = outcome;
    if (plan && !plan.approximate) {
        box.innerHTML = `<p class="mag-sim-planner__ok">✅ 低喂食方案</p>${planCardsHtml(plan)}`;
        bindPlanImportActions(box, plan);
    } else if (plan && plan.approximate && nearest) {
        box.innerHTML = `<div class="mag-sim-planner__warn">`
            + `⚠️ 无精确解，最接近可达 ${nearest.def}/${nearest.pow}/${nearest.dex}/${nearest.mind}`
            + `（距目标 ${nearest.dist}）</div>${planCardsHtml(plan)}`;
        bindPlanImportActions(box, plan);
    } else {
        // nearestFallback's own formula-conflict reason already reads
        // "此四维无法进化成 <magId>：Lv100 需 …" — strip that exact prefix
        // back off before showing it as the detail line, or the header above
        // would repeat itself verbatim. Every OTHER fail reason (unknown mag,
        // stat below fresh mag, …) doesn't carry the prefix and is shown
        // in full underneath, unchanged.
        const prefix = `此四维无法进化成 ${magId}：`;
        const detail = reason && reason.startsWith(prefix) ? reason.slice(prefix.length) : (reason || '未知原因');
        box.innerHTML = `<p class="mag-sim-planner__fail">✗ 此四维无法进化成 ${esc(itemLabel(magId))}</p>`
            + `<p class="mag-sim-planner__reason">${esc(detail)}</p>`;
    }
}

// planMag is a synchronous search that a review flagged can run a couple of
// seconds on some targets, so it must never run on the click handler's own
// tick — that would freeze the page with no loading state ever painted. The
// setTimeout(0) yields to a paint first; `token` guards against a slower,
// STALE solve finishing after a newer click and clobbering its result.
let plannerToken = 0;
function solvePlanner(root) {
    const box = root.querySelector('[data-planner-result]');
    const btn = root.querySelector('[data-planner-solve]');
    const target = currentPlannerTarget(root);
    const token = (plannerToken += 1);

    btn.disabled = true;
    box.innerHTML = '<p class="mag-sim-planner__loading">求解中…</p>';

    setTimeout(() => {
        let outcome;
        try {
            outcome = planMag(window.MAG_SIM, target);
        } catch (err) {
            outcome = { plan: null, nearest: null, reason: String(err && err.message || err) };
        }
        if (token !== plannerToken) return; // superseded by a later click
        renderPlannerResult(root, outcome, target.magId);
        btn.disabled = false;
    }, 0);
}

function renderPlanner() {
    const root = document.querySelector('[data-planner]');
    if (!root) return;

    const fresh = DATA.freshMag;
    root.innerHTML = `
        <h2>规划器</h2>
        <fieldset class="mag-sim-setup__block">
            <legend>目标 Mag</legend>
            <div class="mag-sim-setup__row">
                <label class="mag-sim-setup__field">
                    <span>种类</span>
                    <select data-planner="magId">${speciesOptionsHtml()}</select>
                </label>
            </div>
            <div class="mag-sim-setup__stats">
                <label>DEF<input type="number" data-planner="def" value="${fresh.def}" min="0" max="200" step="1"></label>
                <label>POW<input type="number" data-planner="pow" value="${fresh.pow}" min="0" max="200" step="1"></label>
                <label>DEX<input type="number" data-planner="dex" value="${fresh.dex}" min="0" max="200" step="1"></label>
                <label>MIND<input type="number" data-planner="mind" value="${fresh.mind}" min="0" max="200" step="1"></label>
            </div>
            <button type="button" class="mag-sim-setup__apply" data-planner-solve>求解</button>
        </fieldset>
        <div class="mag-sim-planner__result" data-planner-result></div>
    `;

    if (root._bound) return;
    root._bound = true;
    root.addEventListener('click', (e) => {
        if (e.target.closest('[data-planner-solve]')) solvePlanner(root);
    });
}

// Top-level 模拟器/规划器 tabs. mag-chart.js's initTabs() (the [data-mag-tabs]
// convention used on mag.html) also drives tab selection through location.hash
// — but this page already owns the hash for share links (`#r=<base64>`), so
// page-level switching here is plain click state, never touching the hash.
function initPageTabs() {
    const tabs = document.querySelector('[data-sim-page-tabs]');
    if (!tabs) return;
    const buttons = [...tabs.querySelectorAll('[role="tab"]')];
    tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[role="tab"]');
        if (!btn) return;
        buttons.forEach((b) => {
            const on = b === btn;
            b.setAttribute('aria-selected', String(on));
            const panel = document.getElementById(b.getAttribute('aria-controls'));
            if (panel) panel.hidden = !on;
        });
    });
}

// ---------- live Mag card ----------

const SPRITE_DIR = './assets/img/mag/default/';
function sprite(name) { return `${SPRITE_DIR}${encodeURIComponent(name)}.webp`; }

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

const STAT_DEFS = [
    { key: 'def', label: 'DEF', cls: 'def' },
    { key: 'pow', label: 'POW', cls: 'pow' },
    { key: 'dex', label: 'DEX', cls: 'dex' },
    { key: 'mind', label: 'MIND', cls: 'mind' },
];

// Evolution LEVELS are discrete, not ranges — the wiki: third evolutions at
// "level 50, and every five levels after that", fourth at "level 100, and every
// ten levels after that (110, 120, 130)". Overshoot one and you simply wait for
// the next, so the hint must name the exact level the player is feeding toward.
const nextEvoLevel = (level, first, step) =>
    (level <= first ? first : Math.ceil(level / step) * step);

const NEXT_EVO_HINT = {
    0: 'Lv 10+ → 一阶',
    1: 'Lv 35+ → 二阶',
    2: (s) => `Lv ${nextEvoLevel(E.magLevel(s), 50, 5)} → 三阶`,
    3: (s) => `Lv ${nextEvoLevel(E.magLevel(s), 100, 10)} → 四阶`
        + `（或 Lv ${nextEvoLevel(E.magLevel(s), 50, 5)} 换喂食者再进化）`,
    4: '已达四阶（可用 Mag Cell 转稀有）',
};

// Flat name -> {name, zh, pb, triggers} lookup over window.MAG_EVOLUTION's
// evolution tree, built once on first use (not at module load, since
// mag-evolution.js — a separate deferred script — may not have run yet).
// Absent from the lookup = a node the standard tree doesn't know about (cell
// mags like Gael Giel): renderCard degrades to the bare English name.
let magInfoCache = null;
function getMagInfo() {
    if (magInfoCache) return magInfoCache;
    magInfoCache = Object.create(null);
    const data = window.MAG_EVOLUTION;
    if (!data || !data.classes) return magInfoCache;
    const add = (node) => { if (node && node.name) magInfoCache[node.name] = node; };
    Object.values(data.classes).forEach((c) => {
        add(c.stage1);
        (c.stage2 || []).forEach(add);
        const s3 = c.stage3 || {};
        (s3.special || []).forEach(add);
        (s3.A || []).forEach(add);
        (s3.B || []).forEach(add);
        (c.stage4 || []).forEach((r) => { add(r.male); add(r.female); });
    });
    return magInfoCache;
}

function statBarHtml(stat) {
    const value = state[stat.key];
    const progress = state.progress[stat.key];
    // Like Magatama, the coloured track shows progress toward this stat's
    // next level. Using value / 200 here made the label change after feeding
    // while the track appeared frozen until a whole stat level was gained.
    const pct = Math.min(100, Math.max(0, progress));
    return `<div class="mag-sim-card__stat">
        <span class="mag-sim-card__stat-label stat--${stat.cls}">${stat.label}</span>
        <div class="mag-sim-card__stat-track" role="progressbar"
            aria-label="${stat.label} 升级进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
            <div class="mag-sim-card__stat-fill mag-sim-card__stat-fill--${stat.cls}" style="width:${pct}%"></div>
        </div>
        <span class="mag-sim-card__stat-value">${value}·${progress}%</span>
    </div>`;
}

// A mag carries up to THREE Photon Blasts, inherited across its first three
// evolutions (engine: state.pbs) — not just the PB of its current form. Feeding
// for a specific PB set is a real goal, so show every slot the mag holds.
// Falls back to the current form's own PB for a state with no `pbs` (an old
// share link replayed by an older engine build would have none).
function pbHtml(state, info, meta) {
    if (!meta) return '';
    const held = (state.pbs && state.pbs.length) ? state.pbs
        : (info && info.pb ? [info.pb] : []);
    if (!held.length) return '';
    const slot = (pb) => {
        const zh = meta.pbNames[pb] || '';
        // Slug the file name — "Mylla & Youlla" as a raw src (spaces + &) fails
        // to load in-page even though the encoded URL resolves directly.
        const icon = `./assets/img/mag/pb/${pb.replace(/[^A-Za-z0-9]+/g, '_')}.png`;
        return `<span class="mag-card__pb-slot">`
            + `<img class="mag-card__pb-icon" src="${icon}" alt="" loading="lazy" width="20" height="17">`
            + `<b>${esc(zh)}</b><span class="mag-card__pb-en">${esc(pb)}</span></span>`;
    };
    return `<div class="mag-card__pb">`
        + `<span class="mag-card__label">PB ${held.length}/3</span>`
        + held.map(slot).join('') + `</div>`;
}

function triggersHtml(info, meta) {
    if (!info || !info.triggers || !meta) return '';
    const rows = (meta.events || [])
        .filter((e) => e in info.triggers)
        .map((e) => {
            const t = info.triggers[e];
            return `<div class="mag-trig__row">
                <span class="mag-trig__event">${esc(e)}</span>
                <span>${esc(meta.effects[t.effect] || t.effect)}</span>
                <span class="mag-trig__rate">${esc(t.rate)}</span>
            </div>`;
        });
    return rows.length ? `<div class="mag-trig">${rows.join('')}</div>` : '';
}

function nextEvoHint() {
    const stage = DATA.mags[state.magId]?.stage ?? 0;
    const hint = NEXT_EVO_HINT[stage];
    if (!hint) return '';
    return typeof hint === 'function' ? hint(state) : hint;
}

// The single most expensive endgame mistake in the game. A third-evolution mag
// PARKED on an evolution level (50, 55, … 195, 200) re-runs its evolution check
// on *every* feed — Miku's guide: "Any nonrare mag will still be able to
// transform every time it is fed if its level is any multiple of 5." So a
// finished Lv200 mag changes form the moment someone with a different
// class/Section ID feeds it. Only a character that reproduces its CURRENT form
// is safe. (There is no lock: per Sodaboy, "the only Mags with locked evolutions
// are celled Mags and fourth evolutions".)
function evoWarningHtml() {
    const stage = DATA.mags[state.magId]?.stage ?? 0;
    const level = E.magLevel(state);
    if (stage !== 3 || level < 50 || level % 5 !== 0) return '';
    const at200 = level === 200 ? '已满级的 ' : '';
    return `<div class="mag-sim-card__warn" data-evo-warn>
        ⚠️ ${at200}三阶 mag 停在进化级（Lv ${level}）上：<b>下一口喂食就会重新判定形态</b>。
        只用能喂出当前形态（${esc(itemLabel(state.magId))}）的角色喂它，否则它会当场变成别的 mag。
    </div>`;
}

function renderCard() {
    const root = document.querySelector('[data-sim-card]');
    if (!root) return;

    const info = getMagInfo()[state.magId];
    const meta = window.MAG_EVOLUTION?.meta;
    const nameHtml = `${esc(ITEM_NAMES[state.magId])}<span class="mag-card__en">${esc(state.magId)}</span>`;
    const level = E.magLevel(state);

    root.innerHTML = `
        <h2>当前 Mag</h2>
        <div class="mag-sim-card__head">
            <img class="mag-sim-card__sprite" src="${sprite(state.magId)}" alt="${esc(state.magId)}"
                loading="lazy" onerror="this.remove()">
            <div>
                <div class="mag-card__name">${nameHtml}</div>
                <div class="mag-sim-card__level">Lv ${level} / 200 · 同步率 ${state.synchro} / 120 · IQ ${state.iq} / 200</div>
            </div>
        </div>
        <div class="mag-sim-card__stats">
            ${STAT_DEFS.map(statBarHtml).join('')}
        </div>
        ${pbHtml(state, info, meta)}
        ${triggersHtml(info, meta)}
        <div class="mag-sim-card__next">下次进化：<b>${esc(nextEvoHint())}</b></div>
        ${evoWarningHtml()}
    `;
}

// ---------- feed bar + Feed-All + log ----------

// Per-item feed quantities the user has dialled in. UI-only — not part of
// `state`/`history`, so undo/redo and re-renders never touch these;
// they persist across feeds until the user changes them.
const feedQty = Object.fromEntries(DATA.itemOrder.map((it) => [it, 1]));

// "已喂计数" per item/cell, for the WHOLE session in one pass — every CONSUMED
// state.log entry (a feed, or a feedCell the mag actually accepted) carries
// `item`, filtered through the engine's own `consumesFeed`.
//
// A REJECTED cell is not a purchase: the mag refuses it, so the item is still in
// the player's inventory. Counting it here billed the player for a cell they
// never spent — both in the "已喂" badge and in the meseta total below.
//
// Built ONCE per renderFeed() call instead of a fresh state.log.reduce() per
// item (totalItems, totalCost, and one per feedRowHtml — ~2N scans of a
// possibly-long log for N items, and doFeed()/feedAll() render per feed, so
// this was quadratic on Feed-All). The map's keys are whatever was actually
// fed, so it naturally includes mag cells too (see feedCountMap's callers).
function feedCountMap() {
    const counts = Object.create(null);
    for (const e of state.log) {
        if (E.consumesFeed(e)) counts[e.item] = (counts[e.item] || 0) + 1;
    }
    return counts;
}

// 每次喂食后自动存银行 — the guide's own instruction for the 13/0/0/187 route
// ("If you bank after every Monofluid…"). OFF by default: it is a deliberate,
// time-consuming trick, not the normal way to raise a mag. UI-only, like
// feedQty — it is a habit of the player, not a property of the mag.
let autoBank = false;

// Feeds `item` `qty` times, pushing one undo snapshot per feed *before* it
// is applied (undo() pops these). feedOnce() itself appends to state.log,
// so renderLog() picks the new entries up for free on the render() below.
//
// The auto-bank runs INSIDE the loop, once per individual feed — banking once
// per click instead would shave the fractions off only the last feed of a batch
// and quietly produce a 15/0/0/185 mag from a 13/0/0/187 plan. The snapshot
// still goes in only before the feed, so one undo steps back over the
// feed+bank pair as the single action the user took.
//
// A REJECTED mag cell consumes nothing (see E.consumesFeed) — no item, no
// feed slot, no meseta — so auto-bank must not fire for it either: banking on
// a no-op feed still shaves every stat's fractional progress down to even,
// inserts a phantom 存银行 log line and restarts the feed-cycle timer, for a
// feed the mag never actually took. Gated on the log entry feedOnce() just
// pushed (the FIRST entry it appends this call — a resulting evolve, if any,
// is pushed after), so a normal item feed and an ACCEPTED cell (both really
// consumed) still auto-bank exactly as before.
//
// `render()` only fires when `shouldRender` — feedAll() feeds its whole batch
// through this with it off and renders once itself, so a Feed-All click does
// not repaint every panel once per item (up to 11×).
function doFeed(item, qty, { render: shouldRender = true } = {}) {
    for (let i = 0; i < qty; i += 1) {
        history.push(structuredClone(state));
        const idx = state.log.length;
        E.feedOnce(DATA, state, item);
        if (autoBank && E.consumesFeed(state.log[idx])) E.bankMag(DATA, state);
    }
    if (shouldRender) render();
}

// The 存银行 button: a bank on its own is one undoable action.
function doBank() {
    history.push(structuredClone(state));
    E.bankMag(DATA, state);
    render();
}

// Feeds every item with qty > 0, in DATA.itemOrder sequence, then renders
// once for the whole batch — undo still steps back one feed at a time (each
// doFeed() call still pushes its own per-feed snapshots).
function feedAll() {
    DATA.itemOrder.forEach((it) => {
        const q = Number(feedQty[it]) || 0;
        if (q > 0) doFeed(it, q, { render: false });
    });
    render();
}

function feedRowHtml(item, counts) {
    const qty = feedQty[item] ?? 1;
    return `<div class="mag-sim-feed__row">
        <button type="button" class="mag-sim-feed__btn" data-feed-item="${esc(item)}">喂 ${esc(itemLabel(item))}</button>
        <input type="number" class="mag-sim-feed__qty" data-qty="${esc(item)}" value="${qty}" min="0" step="1">
        <span class="mag-sim-feed__count">已喂 ${counts[item] || 0}</span>
        <span class="mag-sim-feed__cost">${DATA.costs[item].toLocaleString()} meseta</span>
    </div>`;
}

// 3 feeds per real-time cycle (server tick), ~210s/cycle. But a bank RESTARTS the
// feed timer — Miku: "quitting the game or depositing and withdrawing the mag …
// will round down all fractional levels … However, it'll start the timer for
// feeding the mag all over again so it may be time-consuming." — so the count is
// walked out of the ordered log by E.feedCycles(), not divided out of a feed
// total. The old ceil(totalItems / 3) priced the banked 13/0/0/187 route the same
// as the plain 15/0/0/185 one; it really costs about three times the time.
const SECONDS_PER_CYCLE = 210;

// Which Mag Cell the dropdown is showing. Kept outside the render (renderFeed
// rebuilds its innerHTML on every feed) so the choice — and the requirement
// text under it — survive a re-render.
let selectedCell = Object.keys(DATA.magCells)[0];

// The cell's evolution conditions, straight from the wiki (`requires[t].raw`),
// one line per possible target. The engine enforces exactly these, so showing
// them is the only way a rejected cell reads as a rule rather than a bug.
// The cell's racial restriction, as a human sentence. This is the CLASSIC PSO
// rule, which Ephinea removed on 2017-01-09 (wiki, Elenor / Angel's Wing /
// Devil's Wing) — so it is only ever shown as an opt-in, never as the default.
function raceRuleText(cell) {
    const r = cell.raceRule;
    if (!r) return '';
    const names = (list) => list.map((x) => RACE_LABEL[x] || x).join('/');
    return r.only ? `仅${names(r.only)}可用` : `${names(r.deny)}不可用`;
}

function cellReqHtml(cellName) {
    const cell = DATA.magCells[cellName];
    if (!cell) return '';
    const targets = Array.isArray(cell.target) ? cell.target : [cell.target];
    const race = raceRuleText(cell);
    // The wiki's own Notes column ("Currently unavailable"). The cell is still
    // simulated — the mag is real and the rules are known — but the player should
    // not go hunting for an item the server does not currently hand out.
    const gone = cell.unobtainable
        ? `<div class="mag-sim-feed__cell-req mag-sim-feed__cell-req--race">
            <b>获取</b><span>wiki 标注「Currently unavailable」：当前无法获得该 cell</span>
        </div>` : '';
    const raceLine = race
        ? `<div class="mag-sim-feed__cell-req mag-sim-feed__cell-req--race">
            <b>种族</b><span>经典 PSO：${esc(race)}${state.racialRestriction
                ? '（已按经典规则启用）'
                : '　—　Ephinea 已于 2017-01-09 取消，当前不限制'}</span>
        </div>` : '';
    return gone + raceLine + targets.map((t) => {
        const raw = ((cell.requires || {})[t] || {}).raw || '—';
        return `<div class="mag-sim-feed__cell-req">
            <b>→ ${esc(itemLabel(t))}</b><span>${esc(raw)}</span>
        </div>`;
    }).join('');
}

function renderFeed() {
    const root = document.querySelector('[data-sim-feed]');
    if (!root) return;

    // One pass over state.log for the whole render — totalItems/totalCost/每行
    // 已喂 and 周期数 (E.feedCycles, below) all now agree on exactly the same
    // predicate (E.consumesFeed): an accepted mag cell IS a feed the player
    // performed (it just has no listed meseta cost, so it adds 0 to totalCost),
    // and a rejected one is neither counted nor billed. Previously totalItems
    // only walked DATA.itemOrder (which excludes cells entirely), so it read
    // one lower than the 周期数 an accepted cell's feed count already included.
    const counts = feedCountMap();
    const totalItems = Object.values(counts).reduce((n, c) => n + c, 0);
    const totalCost = Object.entries(counts)
        .reduce((n, [it, c]) => n + c * (DATA.costs[it] || 0), 0);
    const banks = state.log.reduce((n, e) => n + (e.kind === 'bank' ? 1 : 0), 0);
    const cycles = E.feedCycles(state.log);
    const minutes = (cycles * SECONDS_PER_CYCLE) / 60;
    // What the same feeds would have cost with no banking — the honest price tag
    // on the trick, and the number this panel used to show for both routes.
    // Same total as totalItems above (both sum every consumesFeed() entry).
    const unbanked = Math.ceil(totalItems / 3);
    const bankNote = banks && cycles > unbanked
        ? `<span class="mag-sim-feed__bank-cost">存银行重置喂食计时器，多花 ${cycles - unbanked} 个周期
             （不存银行只需 ${unbanked} 个）</span>`
        : '';

    root.innerHTML = `
        <h2>喂食</h2>
        <div class="mag-sim-feed__list">
            ${DATA.itemOrder.map((it) => feedRowHtml(it, counts)).join('')}
        </div>
        <div class="mag-sim-feed__actions">
            <button type="button" class="mag-sim-feed__all" data-feed-all>一键喂食（Feed All）</button>
            <button type="button" class="mag-sim-feed__bank" data-bank>存银行</button>
            <label class="mag-sim-feed__bank-auto">
                <input type="checkbox" data-auto-bank${autoBank ? ' checked' : ''}>
                <span>每次喂食后自动存银行</span>
            </label>
            <div class="mag-sim-feed__cells">
                <select data-cell-select>
                    ${Object.keys(DATA.magCells).map((c) =>
                        `<option value="${esc(c)}"${c === selectedCell ? ' selected' : ''}>${esc(itemLabel(c))}${
                            DATA.magCells[c].unobtainable ? '（当前不可获得）' : ''}</option>`).join('')}
                </select>
                <button type="button" class="mag-sim-feed__cell-btn" data-feed-cell>喂 Cell</button>
            </div>
        </div>
        <div class="mag-sim-feed__bank-hint">
            <b>存银行</b>：把 Mag 存入银行（或退出游戏）时，四维的小数进度（百分位）会<b>向下取整到偶数</b>——
            例如 +5% DEF 只会记作 +4%。每喂一次 Monofluid 就存一次，可以把 DEF 从 15 压到 13
            （指南的 13/0/0/187 路线）。不影响四维整数、等级、同步率、IQ 与 PB。
        </div>
        <div class="mag-sim-feed__cell-reqs" data-cell-req>${cellReqHtml(selectedCell)}</div>
        <div class="mag-sim-feed__totals">
            <span>总道具数：<b>${totalItems}</b></span>
            <span>总花费：<b>${totalCost.toLocaleString()}</b> meseta</span>
            <span>周期数：<b data-cycles>${cycles}</b></span>
            <span>预计时间：<b data-eta>${minutes.toFixed(1)}</b> 分钟</span>
            ${bankNote}
        </div>
    `;

    // Bind delegated listeners once — renderFeed() re-runs on every render(),
    // but `root` itself is stable, so re-adding listeners each time would
    // stack duplicate handlers (each click firing doFeed() N times).
    if (root._bound) return;
    root._bound = true;
    root.addEventListener('input', (e) => {
        const inp = e.target.closest('[data-qty]');
        if (!inp) return;
        feedQty[inp.dataset.qty] = Number(inp.value) || 0;
    });
    root.addEventListener('change', (e) => {
        const auto = e.target.closest('[data-auto-bank]');
        if (auto) { autoBank = auto.checked; return; }
        const sel = e.target.closest('[data-cell-select]');
        if (!sel) return;
        selectedCell = sel.value;
        const box = root.querySelector('[data-cell-req]');
        if (box) box.innerHTML = cellReqHtml(selectedCell);
    });
    root.addEventListener('click', (e) => {
        const feedBtn = e.target.closest('[data-feed-item]');
        if (feedBtn) {
            doFeed(feedBtn.dataset.feedItem, Number(feedQty[feedBtn.dataset.feedItem]) || 0);
            return;
        }
        if (e.target.closest('[data-bank]')) { doBank(); return; }
        if (e.target.closest('[data-feed-all]')) { feedAll(); return; }
        if (e.target.closest('[data-feed-cell]') && selectedCell) doFeed(selectedCell, 1);
    });
}

function feedItemLogLine(entry) {
    return `<div class="mag-sim-log__line mag-sim-log__line--feed">喂食：${esc(itemLabel(entry.item))}</div>`;
}

function feedCellLogLine(entry) {
    const why = entry.ok ? '' : `（未生效：${esc(entry.reason || '未满足条件')}）`;
    return `<div class="mag-sim-log__line ${entry.ok ? 'mag-sim-log__line--ok' : 'mag-sim-log__line--reject'}">
        <span class="mag-sim-log__mark">${entry.ok ? '✓' : '✗'}</span> 喂食 Cell：${esc(itemLabel(entry.item))}${why}
    </div>`;
}

function evolveLogLine(entry) {
    return `<div class="mag-sim-log__line mag-sim-log__line--evolve">→ 进化：${esc(itemLabel(entry.from))} → <b>${esc(itemLabel(entry.to))}</b>（Lv ${entry.level}）</div>`;
}

// A bank is not a feed — its own line, its own styling.
function bankLogLine() {
    return `<div class="mag-sim-log__line mag-sim-log__line--bank">存银行：小数进度向下取偶</div>`;
}

// A mid-session flip of the classic-rules toggle changes which cells are
// accepted from here on, so it is part of the history, not a hidden setting.
function racialLogLine(entry) {
    return `<div class="mag-sim-log__line mag-sim-log__line--bank">规则切换：经典 PSO 种族限制${entry.on ? '开启' : '关闭'}</div>`;
}

function logLineHtml(entry) {
    if (entry.kind === 'evolve') return evolveLogLine(entry);
    if (entry.kind === 'feedCell') return feedCellLogLine(entry);
    if (entry.kind === 'bank') return bankLogLine(entry);
    if (entry.kind === 'racial') return racialLogLine(entry);
    return feedItemLogLine(entry);
}

// Renders `state.log` verbatim — undo() restores an older `state`
// (via structuredClone, which deep-copies state.log too), so re-rendering
// after an undo shows the right history automatically with no extra work here.
function renderLog() {
    const root = document.querySelector('[data-sim-log]');
    if (!root) return;
    root.innerHTML = `
        <h2>历史记录</h2>
        <div class="mag-sim-log__list" data-log-list>
            ${state.log.length ? state.log.map(logLineHtml).join('') : '<div class="mag-sim-log__empty">尚未喂食</div>'}
        </div>
    `;
    const list = root.querySelector('[data-log-list]');
    if (list) list.scrollTop = list.scrollHeight; // newest entry at the bottom
}

// ---------- undo / reset / export / share ----------

// Pops the most recent pre-feed snapshot doFeed() pushed. No-op (not an
// error) on an empty stack, since the Undo button is also disabled then.
function undo() {
    if (!history.length) return;
    state = history.pop();
    render();
}

// Rebuilds from the *original* start config — applyStart() already clears
// `history`, so this both reverts stats and wipes the log/undo stack.
function reset() {
    applyStart(state._start);
}

// Minimal Blob + object-URL download helper — no server, so this is the
// only way to hand the user a file from a static page.
function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Plain-text rendering of one log entry — mirrors logLineHtml() but without
// markup, for the text export.
function logLineText(entry) {
    if (entry.kind === 'evolve') return `→ 进化：${itemLabel(entry.from)} → ${itemLabel(entry.to)}（Lv ${entry.level}）`;
    if (entry.kind === 'bank') return '存银行：小数进度向下取偶';
    if (entry.kind === 'racial') return `规则切换：经典 PSO 种族限制${entry.on ? '开启' : '关闭'}`;
    if (entry.kind === 'feedCell') {
        return `${entry.ok ? '✓' : '✗'} 喂食 Cell：${itemLabel(entry.item)}`
            + (entry.ok ? '' : `（未生效：${entry.reason || '未满足条件'}）`);
    }
    return `喂食：${itemLabel(entry.item)}`;
}

// Human-readable dump of the whole session: every log line, then a final
// mag + stats summary (mirrors what's visible on-screen across the card
// and log panels).
function logToPlainText(log) {
    const lines = log.length ? log.map(logLineText) : ['尚未喂食'];
    const level = E.magLevel(state);
    const summary = [
        '',
        '---- 最终 Mag ----',
        `种类：${itemLabel(state.magId)}`,
        `等级：Lv ${level} / 200`,
        `DEF ${state.def}｜POW ${state.pow}｜DEX ${state.dex}｜MIND ${state.mind}`,
        `同步率：${state.synchro} / 120`,
        `IQ：${state.iq} / 200`,
    ];
    return lines.concat(summary).join('\n');
}

function exportJSON() {
    download('mag-session.json', JSON.stringify(E.exportSession(state), null, 2));
}

function exportText() {
    download('mag-session.txt', logToPlainText(state.log));
}

// UTF-8-safe base64: escape()/unescape() route the string through a
// Latin-1-safe byte representation so btoa()/atob() (which only handle
// code points 0-255) can round-trip Chinese log text.
function encodeSession(session) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(session))));
}
function decodeSession(encoded) {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

let shareStatusTimer = null;
function flashShareStatus(msg) {
    const el = document.querySelector('[data-share-status]');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(shareStatusTimer);
    shareStatusTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

// The Clipboard API is absent on every non-secure origin, and `?.writeText()`
// would then short-circuit to a resolved `undefined` — reporting a copy that
// never happened. Branch on it explicitly instead.
async function shareURL() {
    location.hash = 'r=' + encodeSession(E.exportSession(state));
    if (!navigator.clipboard) {
        flashShareStatus('链接已生成，当前环境不支持自动复制，请手动复制地址栏');
        return;
    }
    try {
        await navigator.clipboard.writeText(location.href);
        flashShareStatus('链接已复制到剪贴板');
    } catch {
        flashShareStatus('链接已生成，但复制失败，请手动复制地址栏');
    }
}

function renderControls() {
    const root = document.querySelector('[data-sim-controls]');
    if (!root) return;
    root.innerHTML = `
        <div class="mag-sim-controls__row">
            <button type="button" class="mag-sim-controls__btn" data-undo${history.length ? '' : ' disabled'}>撤销</button>
            <button type="button" class="mag-sim-controls__btn" data-reset>重置</button>
            <button type="button" class="mag-sim-controls__btn" data-export-json>导出 JSON</button>
            <button type="button" class="mag-sim-controls__btn" data-export-text>导出文本</button>
            <button type="button" class="mag-sim-controls__btn mag-sim-controls__btn--accent" data-share>分享链接</button>
            <span class="mag-sim-controls__status" data-share-status></span>
        </div>
    `;

    if (root._bound) return;
    root._bound = true;
    root.addEventListener('click', (e) => {
        if (e.target.closest('[data-undo]')) { undo(); return; }
        if (e.target.closest('[data-reset]')) { reset(); return; }
        if (e.target.closest('[data-export-json]')) { exportJSON(); return; }
        if (e.target.closest('[data-export-text]')) { exportText(); return; }
        if (e.target.closest('[data-share]')) { shareURL(); return; }
    });
}

function render() {
    renderCard();
    renderFeed();
    renderLog();
    renderControls();
}

document.addEventListener('DOMContentLoaded', () => {
    // Replay a shared session (#r=<base64 JSON>) before the first render, so
    // the setup panel's initial selects (feeder class/gender/Section ID)
    // already reflect the replayed state. A malformed hash must never break
    // the page — fall back to a fresh state instead.
    if (location.hash.startsWith('#r=')) {
        try {
            state = E.replaySession(DATA, decodeSession(location.hash.slice(3)));
        } catch (err) {
            console.warn('mag-sim: malformed share link, starting fresh', err);
            state = E.createState(DATA, { start: { mode: 'fresh' } });
        }
    }
    initPageTabs();
    renderSetup();
    renderPlanner();
    render();
});
