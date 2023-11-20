import {
	ChangeDetectionStrategy,
	Component,
	Input,
	OnInit,
	inject,
	signal,
} from '@angular/core';
import {JsonPipe, NgIf} from '@angular/common';
import {LazyServiceLoader} from '@bgotink/ng-lazy';
import {defer} from 'rxjs';

import {LazyService} from './lazy-service.js';
import {LazyResultItem} from './lazy-result-item.component.js';

export type Result =
	| {status: 'not run'}
	| {
			status: 'pending';
	  }
	| {
			status: 'success';
			value: unknown;
	  }
	| {
			status: 'error';
			error: Error;
	  };

@Component({
	standalone: true,
	selector: 'lazy-result',
	templateUrl: './lazy-result.component.html',
	styles: `
		:host {
			display: flex;
			flex-flow: row nowrap;
			gap: 8px;
		}
	`,
	imports: [NgIf, JsonPipe, LazyResultItem],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LazyResult implements OnInit {
	readonly lazyServiceLoader = inject(LazyServiceLoader);

	@Input({required: true})
	name!: string;

	@Input({required: true})
	service!: LazyService;

	isReady = signal(false);

	safePromise = signal<Result>({status: 'not run'});
	safeObservable = signal<Result>({status: 'not run'});
	unsafeProperty = signal<Result>({status: 'not run'});

	safePromiseMethod = signal<Result>({status: 'not run'});
	safeObservableMethod = signal<Result>({status: 'not run'});
	safeVoidMethod = signal<Result>({status: 'not run'});
	unsafeMethod = signal<Result>({status: 'not run'});

	ngOnInit() {
		void this.lazyServiceLoader
			.whenReady(this.service)
			.finally(() => this.isReady.set(true));
	}

	load() {
		void this.lazyServiceLoader.load(this.service);
	}

	refreshSafePromise(): void {
		this.safePromise.set({status: 'pending'});

		Promise.resolve()
			.then(() => this.service.safePromise)
			.then(
				value => this.safePromise.set({status: 'success', value}),
				error => this.safePromise.set({status: 'error', error}),
			);
	}

	refreshSafeObservable(): void {
		this.safeObservable.set({status: 'pending'});

		defer(() => this.service.safeObservable).subscribe(
			value => this.safeObservable.set({status: 'success', value}),
			error => this.safeObservable.set({status: 'error', error}),
		);
	}

	refreshUnsafeProperty(): void {
		try {
			this.unsafeProperty.set({
				status: 'success',
				value: this.service.unsafeProperty,
			});
		} catch (error: any) {
			this.unsafeProperty.set({
				status: 'error',
				error,
			});
		}
	}

	refreshSafePromiseMethod(): void {
		this.safePromiseMethod.set({status: 'pending'});

		Promise.resolve()
			.then(() => this.service.safePromiseMethod())
			.then(
				value => this.safePromiseMethod.set({status: 'success', value}),
				error => this.safePromiseMethod.set({status: 'error', error}),
			);
	}

	refreshSafeObservableMethod(): void {
		this.safeObservableMethod.set({status: 'pending'});

		defer(() => this.service.safeObservableMethod()).subscribe(
			value => this.safeObservableMethod.set({status: 'success', value}),
			error => this.safeObservableMethod.set({status: 'error', error}),
		);
	}

	refreshSafeVoidMethod(): void {
		try {
			this.safeVoidMethod.set({
				status: 'success',
				value: this.service.safeVoidMethod(),
			});
		} catch (error: any) {
			this.safeVoidMethod.set({
				status: 'error',
				error,
			});
		}
	}

	refreshUnsafeMethod(): void {
		try {
			this.unsafeMethod.set({
				status: 'success',
				value: this.service.unsafeMethod(),
			});
		} catch (error: any) {
			this.unsafeMethod.set({
				status: 'error',
				error,
			});
		}
	}
}
