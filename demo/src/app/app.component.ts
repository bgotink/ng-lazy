import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';

import {
	LazyService,
	LazyServiceExplicit,
	LazyServiceOnAccess,
} from './lazy-service.js';
import {LazyResult} from './lazy-result.component.js';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [CommonModule, LazyResult],
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css'],
})
export class AppComponent {
	lazy = inject(LazyService);
	lazyOnAccess = inject(LazyServiceOnAccess);
	lazyExplicit = inject(LazyServiceExplicit);
}
