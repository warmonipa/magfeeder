import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { appConfig } from './app.config';
export const serverConfig = mergeApplicationConfig(appConfig, { providers: [provideServerRendering(withRoutes([{ path: '', renderMode: RenderMode.Prerender }, { path: 'planner', renderMode: RenderMode.Prerender }, { path: '404.html', renderMode: RenderMode.Prerender }, { path: '**', renderMode: RenderMode.Client }]))] });
