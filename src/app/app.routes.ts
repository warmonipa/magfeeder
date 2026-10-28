import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
export const routes: Routes = [
    { matcher: segments => segments.at(-1)?.path === 'index.html' ? { consumed: segments } : null, redirectTo: ({ url, queryParams, fragment }) => inject(Router).createUrlTree(['/' + url.slice(0, -1).map(s => s.path).join('/')], { queryParams, fragment: fragment ?? undefined }) },
    { path: '', pathMatch: 'full', title: '玛古模拟器 | Ephinea PSOBB', loadComponent: () => import('./simulator/simulator.component').then(m => m.SimulatorComponent) },
    { path: 'planner', title: '玛古规划器 | Ephinea PSOBB', loadComponent: () => import('./planner/planner.component').then(m => m.PlannerComponent) },
    { path: '404.html', loadComponent: () => import('./not-found.component').then(m => m.NotFoundComponent) },
    { path: '**', loadComponent: () => import('./not-found.component').then(m => m.NotFoundComponent) },
];
