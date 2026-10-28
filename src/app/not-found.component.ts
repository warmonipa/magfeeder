import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ selector: 'mag-not-found', imports: [RouterLink], template: '<h2>页面不存在</h2><a routerLink="/">返回模拟器</a>' })
export class NotFoundComponent {
}
