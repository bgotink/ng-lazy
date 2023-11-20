import {JsonPipe} from '@angular/common';
import {Component, Input} from '@angular/core';

import type {Result} from './lazy-result.component.js';

@Component({
	standalone: true,
	selector: 'lazy-result-item',
	templateUrl: './lazy-result-item.component.html',
	styles: `
		:host {
			display: block;
		}
	`,
	imports: [JsonPipe],
})
export class LazyResultItem {
	@Input({required: true})
	result!: Result;
}
