import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
@Component({ selector: 'mag-app', imports: [RouterLink, RouterOutlet], host: { class: 'mag-sim-page' }, template: `
<header><h1 id="project_title">Mag Feeder</h1></header>
<a class="back-link" href="https://www.psohaven.com/">← 返回 Haven PSOBB</a>
<div class="content-container"><div class="mag-sim__toolbar">
<p><a href="https://www.psohaven.com/mags/">查看玛古进化图谱 ↗</a></p>
<nav class="mag-tabs" aria-label="模拟器 / 规划器">
<a class="mag-tab" routerLink="/" [attr.aria-current]="router.url.split('#')[0] === '/' ? 'page':null">模拟器</a>
<a class="mag-tab" routerLink="/planner/" [attr.aria-current]="router.url.startsWith('/planner') ? 'page':null">规划器</a>
</nav></div><router-outlet /></div>` })
export class AppComponent {
    readonly router = inject(Router);
}
