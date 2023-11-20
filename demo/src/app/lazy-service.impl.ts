import {Injectable} from '@angular/core';
import {of} from 'rxjs';

import type {LazyService} from './lazy-service.js';

@Injectable()
export class LazyServiceImpl implements LazyService {
	readonly safePromise = Promise.resolve(42);

	readonly safeObservable = of(42);

	readonly unsafeProperty = 42;

	safePromiseMethod() {
		return Promise.resolve(42);
	}

	safeObservableMethod() {
		return of(42);
	}

	safeVoidMethod() {
		// do nothing
	}

	unsafeMethod() {
		// do nothing
	}
}
