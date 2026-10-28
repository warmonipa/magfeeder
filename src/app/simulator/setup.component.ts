import { Component, effect, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionService } from './session.service';
import { CLASSES, DATA, EVOLUTION, PBS, SECTIONS, SPECIES, STATS, itemLabel } from '../domain/data';

@Component({
    selector: 'mag-setup',
    imports: [FormsModule],
    templateUrl: './setup.component.html',
    host: {
        class: 'mag-sim__setup',
        'data-sim-setup': '',
        '(document:click)': 'closeOutside($event)',
        '(window:resize)': "open.set('')",
    },
})
export class SetupComponent {
    readonly session = inject(SessionService);
    private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
    readonly classes = CLASSES;
    readonly sections = SECTIONS;
    readonly species = SPECIES;
    readonly stats = STATS;
    readonly pbs = PBS;
    readonly pbNames = EVOLUTION.meta.pbNames;
    readonly label = itemLabel;
    readonly open = signal('');
    readonly menuPosition = signal({top: 0, left: 0});
    mode = 'fresh';
    custom = {...DATA.freshMag, pbs: [] as string[]};
    private startKey = '';

    constructor() {
        effect(() => {
            const start = this.session.state()._start;
            const key = JSON.stringify(start);
            if (key === this.startKey) return;
            this.startKey = key;
            this.mode = start.mode;
            this.custom = {...DATA.freshMag, ...start, pbs: [...(start.pbs || [])]};
        });
    }

    get feederClass() {
        const feeder = this.session.state().feeder;
        return CLASSES.find(c => c.line === feeder.class && c.gender === feeder.gender && c.race === feeder.race)!;
    }

    toggleMenu(name: string, event: Event) {
        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
        this.menuPosition.set({top: bounds.bottom + 4, left: Math.max(8, Math.min(bounds.left, innerWidth - 184))});
        this.open.set(this.open() === name ? '' : name);
    }

    closeOutside(event: Event) {
        if (!this.element.nativeElement.contains(event.target as Node)) this.open.set('');
    }

    selectClass(name: string) {
        const c = CLASSES.find(c => c.name === name)!;
        this.session.feeder({class: c.line, gender: c.gender, race: c.race});
        this.open.set('');
    }

    setMode(mode: string) {
        this.mode = mode;
        this.apply();
    }

    apply() {
        this.session.start(this.mode === 'fresh' ? {mode: 'fresh'} : {...this.custom, mode: 'custom'});
    }

    togglePB(pb: string, on: boolean) {
        if (on && this.custom.pbs.length < 3) this.custom.pbs = [...this.custom.pbs, pb];
        else if (!on) this.custom.pbs = this.custom.pbs.filter(p => p !== pb);
    }
}

