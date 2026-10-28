import { Component, inject, signal } from '@angular/core';
import { SessionService } from './session.service';
import { DATA, EVOLUTION, MAG_INFO, STATS, itemLabel } from '../domain/data';
import { magLevel } from '../domain/mag-sim-engine.js';
@Component({ selector: 'mag-card', templateUrl: './card.component.html', host: { class: 'mag-sim__card', 'data-sim-card': '' } })
export class CardComponent {
    readonly failedPortrait = signal('');
    readonly session = inject(SessionService);
    readonly stats = STATS;
    readonly meta = EVOLUTION.meta;
    readonly label = itemLabel;
    readonly level = magLevel;
    get state() { return this.session.state(); }
    get info() { return MAG_INFO[this.state.magId]; }
    get stage() { return DATA.mags[this.state.magId].stage; }
    get portrait() { return '/assets/img/mag/default/' + encodeURIComponent(this.state.magId) + '.webp'; }
    pbIcon(pb: string) { return '/assets/img/mag/pb/' + pb.replace(/[^A-Za-z0-9]+/g, '_') + '.png'; }
    get events(): string[] { return (this.meta.events as string[]).filter(e => this.info?.triggers && e in this.info.triggers); }
    get next() {
        const lv = this.level(this.state);
        const at = (first: number, step: number) => lv <= first ? first : Math.ceil(lv / step) * step;
        return ['Lv 10+ → 一阶', 'Lv 35+ → 二阶', 'Lv ' + at(50, 5) + ' → 三阶', 'Lv ' + at(100, 10) + ' → 四阶（或 Lv ' + at(50, 5) + ' 换喂食者再进化）', '已达四阶（可用 Mag Cell 转稀有）'][this.stage];
    }
}
