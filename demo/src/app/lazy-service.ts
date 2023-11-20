import {Injectable} from '@angular/core';
import {
	LazyCreationTrigger,
	lazyFactory,
	createFromInjectable,
} from '@bgotink/ng-lazy';
import {Observable} from 'rxjs';

@Injectable({
	providedIn: 'root',
	useFactory: lazyFactory<LazyService>(() =>
		import('./lazy-service.impl.js').then(mod =>
			createFromInjectable(mod.LazyServiceImpl),
		),
	)
		.markSafeProperty('safePromise', 'promise')
		.markSafeProperty('safeObservable', 'observable')
		.markSafeMethod('safePromiseMethod', 'promise')
		.markSafeMethod('safeObservableMethod', 'observable')
		.markSafeMethod('safeVoidMethod', 'void'),
})
export abstract class LazyService {
	abstract readonly safePromise: Promise<number>;

	abstract readonly safeObservable: Observable<number>;

	abstract readonly unsafeProperty: number;

	abstract safePromiseMethod(): Promise<number>;

	abstract safeObservableMethod(): Observable<number>;

	abstract safeVoidMethod(): void;

	abstract unsafeMethod(): void;
}

@Injectable({
	providedIn: 'root',
	useFactory: lazyFactory<LazyServiceOnAccess>(() =>
		import('./lazy-service.impl.js').then(mod =>
			createFromInjectable(mod.LazyServiceImpl),
		),
	)
		.createOn(LazyCreationTrigger.OnAccess)
		.markSafeProperty('safePromise', 'promise')
		.markSafeProperty('safeObservable', 'observable')
		.markSafeMethod('safePromiseMethod', 'promise')
		.markSafeMethod('safeObservableMethod', 'observable')
		.markSafeMethod('safeVoidMethod', 'void'),
})
export abstract class LazyServiceOnAccess extends LazyService {}

@Injectable({
	providedIn: 'root',
	useFactory: lazyFactory<LazyServiceOnAccess>(() =>
		import('./lazy-service.impl.js').then(mod =>
			createFromInjectable(mod.LazyServiceImpl),
		),
	)
		.createOn(LazyCreationTrigger.Explicit)
		.markSafeProperty('safePromise', 'promise')
		.markSafeProperty('safeObservable', 'observable')
		.markSafeMethod('safePromiseMethod', 'promise')
		.markSafeMethod('safeObservableMethod', 'observable')
		.markSafeMethod('safeVoidMethod', 'void'),
})
export abstract class LazyServiceExplicit extends LazyService {}
