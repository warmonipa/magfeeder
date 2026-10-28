import { PublicUrlSerializer } from './public-url-serializer';
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, UrlSerializer } from '@angular/router';
import { routes } from './app.routes';
export const appConfig: ApplicationConfig = { providers: [{ provide: UrlSerializer, useClass: PublicUrlSerializer }, provideZonelessChangeDetection(), provideClientHydration(), provideRouter(routes)] };
