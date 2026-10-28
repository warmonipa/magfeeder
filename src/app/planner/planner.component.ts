import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DATA, SPECIES, STATS, itemLabel } from '../domain/data';
import { planMag } from '../domain/mag-sim-planner.js';
import { Outcome, Plan, Target } from '../domain/model';
import { SessionService } from '../simulator/session.service';
@Component({ selector: 'mag-planner', imports: [FormsModule], templateUrl: './planner.component.html', host: { style: 'display:block;flex:1;min-height:0;overflow:auto', 'data-planner': '' } })
export class PlannerComponent {
    readonly species = SPECIES;
    readonly stats = STATS;
    readonly label = itemLabel;
    readonly busy = signal(false);
    readonly outcome = signal<Outcome | null>(null);
    target: Target = { magId: DATA.freshMag.magId, def: DATA.freshMag.def, pow: DATA.freshMag.pow, dex: DATA.freshMag.dex, mind: DATA.freshMag.mind };
    private readonly session = inject(SessionService);
    private readonly router = inject(Router);
    private timer: ReturnType<typeof setTimeout> | undefined;
    constructor() { inject(DestroyRef).onDestroy(() => clearTimeout(this.timer)); }
    solve() { const target = { ...this.target }; this.busy.set(true); this.outcome.set(null); clearTimeout(this.timer); this.timer = setTimeout(() => { try {
        this.outcome.set(planMag(DATA, target));
    }
    catch (e) {
        this.outcome.set({ plan: null, nearest: null, reason: String(e) });
    }
    finally {
        this.busy.set(false);
    } }, 0); }
    import(plan: Plan) { this.session.importPlan(plan); void this.router.navigate(['/']); }
}
