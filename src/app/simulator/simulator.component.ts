import { Component, afterNextRender, afterEveryRender, inject, signal, viewChild, ElementRef, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SetupComponent } from './setup.component';
import { CardComponent } from './card.component';
import { FeedComponent } from './feed.component';
import { SessionService } from './session.service';
import { logText, sessionText } from './log-text';
@Component({ selector: 'mag-simulator', imports: [SetupComponent, CardComponent, FeedComponent], templateUrl: './simulator.component.html', host: { style: 'display:block;flex:1;min-height:0' } })
export class SimulatorComponent {
    readonly session = inject(SessionService);
    readonly logText = logText;
    readonly status = signal('');
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly destroy = inject(DestroyRef);
    private readonly logList = viewChild<ElementRef<HTMLElement>>('logList');
    private timer: ReturnType<typeof setTimeout> | undefined;
    private sharedFragment = '';
    private lastLog: unknown;
    constructor() {
        afterNextRender(() => this.route.fragment.pipe(takeUntilDestroyed(this.destroy)).subscribe(fragment => {
            if (!fragment?.startsWith('r=') || fragment === this.sharedFragment)
                return;
            this.sharedFragment = fragment;
            try {
                const bytes = Uint8Array.from(atob(fragment.slice(2)), c => c.charCodeAt(0));
                this.session.replay(JSON.parse(new TextDecoder().decode(bytes)));
            }
            catch {
                this.status.set('分享链接无效，无法回放。');
            }
        }));
        afterEveryRender(() => { const log = this.session.state().log; if (log === this.lastLog)
            return; this.lastLog = log; const el = this.logList()?.nativeElement; if (el)
            el.scrollTop = el.scrollHeight; });
        this.destroy.onDestroy(() => clearTimeout(this.timer));
    }
    download(json: boolean) { const text = json ? JSON.stringify(this.session.export(), null, 2) : sessionText(this.session.state()); const url = URL.createObjectURL(new Blob([text], { type: json ? 'application/json' : 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = json ? 'mag-session.json' : 'mag-session.txt'; a.click(); URL.revokeObjectURL(url); }
    async share() {
        const bytes = new TextEncoder().encode(JSON.stringify(this.session.export()));
        this.sharedFragment = 'r=' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
        await this.router.navigate(['/'], { fragment: this.sharedFragment });
        try {
            if (!navigator.clipboard)
                throw new Error('clipboard unavailable');
            await navigator.clipboard.writeText(location.href);
            this.status.set('链接已复制到剪贴板');
        }
        catch {
            this.status.set('链接已生成，请手动复制地址栏');
        }
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.status.set(''), 4000);
    }
}
