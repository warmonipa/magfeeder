import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionService } from './session.service';
import { DATA, itemLabel } from '../domain/data';
@Component({ selector: 'mag-feed', imports: [FormsModule], templateUrl: './feed.component.html', host: { class: 'mag-sim__feed', 'data-sim-feed': '' } })
export class FeedComponent {
    readonly session = inject(SessionService);
    readonly data = DATA;
    readonly cells = Object.keys(DATA.magCells);
    readonly label = itemLabel;
    selectedCell = this.cells[0];
    get cell() { return DATA.magCells[this.selectedCell]; }
    get targets(): string[] { return Array.isArray(this.cell.target) ? this.cell.target : [this.cell.target]; }
    quantity(item: string, value: number) { this.session.quantities.update(q => ({ ...q, [item]: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 })); }
    get race() { const r = this.cell.raceRule; const names: Record<string, string> = { Human: '人类', Newman: '新人类', Android: '机器人' }; if (!r)
        return ''; return r.only ? '仅' + r.only.map((s: string) => names[s]).join('/') + '可用' : (r.deny || []).map((s: string) => names[s]).join('/') + '不可用'; }
}
