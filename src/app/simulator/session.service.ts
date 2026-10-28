import { Injectable, computed, signal } from '@angular/core';
import * as E from '../domain/mag-sim-engine.js';
import { DATA, CLASSES } from '../domain/data';
import { Feeder, Plan, Start, State } from '../domain/model';
@Injectable({ providedIn: 'root' })
export class SessionService {
    readonly state = signal<State>(E.createState(DATA, { start: { mode: 'fresh' } }));
    private history: State[] = [];
    readonly canUndo = signal(false);
    readonly quantities = signal<Record<string, number>>(Object.fromEntries(DATA.itemOrder.map(it => [it, 1])));
    readonly autoBank = signal(false);
    readonly counts = computed(() => { const counts: Record<string, number> = {}; for (const e of this.state().log)
        if (E.consumesFeed(e))
            counts[e.item] = (counts[e.item] || 0) + 1; return counts; });
    readonly totals = computed(() => { const counts = this.counts(); const items = Object.values(counts).reduce((a, b) => a + b, 0); return { items, cost: Object.entries(counts).reduce((n, [it, c]) => n + c * (DATA.costs[it] || 0), 0), cycles: E.feedCycles(this.state().log), banks: this.state().log.filter(e => e.kind === 'bank').length, unbanked: Math.ceil(items / 3) }; });
    private commit(state: State) { this.state.set({ ...state }); this.canUndo.set(this.history.length > 0); }
    start(start: Start) { const old = this.state(); const s = E.createState(DATA, { start: structuredClone(start) }); s.feeder = { ...old.feeder }; E.setRacialRestriction(s, old.racialRestriction); this.history = []; this.commit(s); }
    feeder(patch: Partial<Feeder>) { this.commit({ ...this.state(), feeder: { ...this.state().feeder, ...patch } }); }
    racial(on: boolean) { const s = structuredClone(this.state()); this.history.push(structuredClone(s)); E.setRacialRestriction(s, on); this.commit(s); }
    feed(item: string, qty: number) { if (!Number.isFinite(qty))
        return; const s = structuredClone(this.state()); for (let i = 0; i < Math.max(0, Math.floor(qty)); i++) {
        this.history.push(structuredClone(s));
        const idx = s.log.length;
        E.feedOnce(DATA, s, item);
        if (this.autoBank() && E.consumesFeed(s.log[idx]))
            E.bankMag(DATA, s);
    } this.commit(s); }
    feedAll() { for (const it of DATA.itemOrder)
        this.feed(it, this.quantities()[it]); }
    bank() { const s = structuredClone(this.state()); this.history.push(structuredClone(s)); E.bankMag(DATA, s); this.commit(s); }
    undo() { const s = this.history.pop(); if (s)
        this.commit(s); }
    replay(session: unknown) { const s = E.replaySession(DATA, session); this.history = []; this.commit(s); }
    importPlan(plan: Plan) { const feeds = []; for (const seg of plan.segments) {
        const cls = CLASSES.find(c => c.line === seg.feeder.class && c.gender === seg.feeder.gender)!;
        const feeder = { ...seg.feeder, race: seg.feeder.race || cls.race };
        for (const step of seg.order)
            feeds.push(step.bank ? { action: 'bank' } : { item: step.item, feeder });
    } this.replay({ start: { mode: 'fresh' }, feeds }); }
    export() { return E.exportSession(this.state()); }
}
