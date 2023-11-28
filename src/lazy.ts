import {
	DestroyRef,
	Injectable,
	Injector,
	type OnDestroy,
	inject,
	isDevMode,
	runInInjectionContext,
} from '@angular/core';
import {type Observable, from, switchMap} from 'rxjs';

import {Deferred} from './utils.js';
import {type LazilyCreated, lazilyCreatedMarker} from './creator.js';

/**
 * Error thrown when a service is accessed before it's ready
 */
export class ServiceNotReadyError extends Error {
	override name = 'ServiceNotReadyError';
}

/**
 * Error thrown when unsupported operations are performed on a lazy service
 *
 * Lazy services only support very limited access:
 *
 * - reading properties and accessing methods
 * - changing properties (but not methods)
 * - checking whether a property or method is present
 *
 * Doing anything else (e.g., deleting a property, freezing the service, reading all property names of the service) is not supported.
 */
export class OperationNotSupportedError extends Error {
	override name = 'OperationNotSupportedError';
}

const notSupported = (operation: string) => (): never => {
	throw new OperationNotSupportedError(
		`Operation ${operation} is not supported on lazy services`,
	);
};

/**
 * Type that extracts all keys of a type that don't have a function value
 *
 * TypeScript doesn't differentiate between a method and a function property, so we assume all properties that can be functions are methods.
 */
type PropertyOf<T> = {
	[K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/**
 * Type that extracts all keys of a type that can have a function value
 *
 * TypeScript doesn't differentiate between a method and a function property, so we assume all properties that can be functions are methods.
 */
type MethodOf<T> = {
	[K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

type SafePropertyType<T, K extends keyof T> = T[K] extends Promise<unknown>
	? 'promise'
	: T[K] extends Observable<unknown>
	  ? 'observable'
	  : never;
type SafeMethodType<T, K extends keyof T> = T[K] extends (
	...args: unknown[]
) => Promise<unknown>
	? 'promise'
	: T[K] extends (...args: unknown[]) => Observable<unknown>
	  ? 'observable'
	  : T[K] extends (...args: unknown[]) => void
	    ? 'void'
	    : never;

/**
 * Factory function that lazily creates a service, to be used in `useFactory`
 */
export interface LazyFactory<ServiceT> {
	/**
	 * Change the trigger upon which the lazy service will be created
	 *
	 * @see {@link LazyCreationTrigger}
	 */
	createOn(trigger: LazyCreationTrigger): this;

	/**
	 * Mark the given property as being safe to access before the lazy implementation finishes loading
	 *
	 * There are two possible kinds of safe properties:
	 *
	 * `'promise'`: A property that is `Promise<T>`.
	 * The lazy service will yield a promise that waits for the actual implementation to load and will then access the real property.
	 *
	 * `'observable'`: A property that is `Observable<T>`.
	 * The lazy service will yield an Observable that waits for the actual implementation to load and will then access the real property.
	 *
	 * These safe properties will be accessed with a delay, so properties that are timing-sensitive should not be marked as safe.
	 * This is especially true for the Observable properties, as Observables aren't necessarily asynchronous but these safe properties will always be async.
	 *
	 * @param propertyName The name of the safe property
	 * @param type The safe property type
	 * @returns `this` for chaining
	 */
	markSafeProperty<PropT extends PropertyOf<ServiceT>>(
		propertyName: PropT,
		type: SafePropertyType<ServiceT, PropT>,
	): this;

	/**
	 * Mark the given method as being safe to access before the lazy implementation finishes loading
	 *
	 * There are three possible kinds of safe properties:
	 *
	 * `'promise'`: A method that returns `Promise<T>`.
	 * The lazy service will yield a promise that waits for the actual implementation to load and will then access the real method.
	 *
	 * `'observable'`: A method that returns `Observable<T>`.
	 * The lazy service will yield an Observable that waits for the actual implementation to load and will then access the real method.
	 *
	 * `'void'`: A method that returns `void`.
	 * The lazy service will wait for the actual implementation to load and will then access the real method.
	 *
	 * These safe method will be called with a delay, so methods that are timing-sensitive should not be marked as safe.
	 * This is especially true for the Observable methods, as Observables aren't necessarily asynchronous but these safe methods will always be async.
	 *
	 * @param methodName The name of the safe method
	 * @param type The safe method type
	 * @returns `this` for chaining
	 */
	markSafeMethod<MethodT extends MethodOf<ServiceT>>(
		methodName: MethodT,
		type: SafeMethodType<ServiceT, MethodT>,
	): this;

	/**
	 * Build the service instance
	 *
	 * Further changes to the builder will not change the created service.
	 */
	(): ServiceT;
}

/**
 * The trigger decides when the lazy service is instantiated
 */
export const enum LazyCreationTrigger {
	/**
	 * Load the lazy service implementation as soon as the service is injected
	 *
	 * This is the default trigger.
	 */
	OnInjection = 'on injection',

	/**
	 * Load the lazy service implementation once a property or method is accessed on the lazy service
	 *
	 * Loading is only triggered when one of the "safe" methods or properties is accessed, or {@link LazyServiceLoader.load} is called.
	 *
	 * This trigger delays creation of the service until it's actually used.
	 */
	OnAccess = 'on access',

	/**
	 * Load the service only when {@link LazyServiceLoader.load} is called
	 *
	 * This trigger delays creation of the service until an explicit function call.
	 */
	Explicit = 'explicit',
}

/**
 * The actual function loading the lazy implementation
 *
 * @example
 *
 * ```ts
 * (creator) => import('./lazy-implementation.js')
 *   .then(module => creator.fromService(module.LazyImplementation))
 *
 * async (creator) => creator.fromService(
 *   (await import('./lazy-implementation.js')).LazyImplementation
 * )
 * ```
 */
export type LazyFactoryFn<ServiceT> = () =>
	| LazilyCreated<ServiceT>
	| PromiseLike<LazilyCreated<ServiceT>>;

/**
 * Create a factory for a lazy service
 *
 * @example With `@Injectable`:
 *
 * ```ts
 * @Injectable({
 *   providedIn: 'root',
 *   useFactory: lazyFactory(
 *       creator => import('./my-lazy-implementation.js')
 *         .then(module => creator.fromService(module.MyLazyImplementation))
 *     )
 *     .markSafeMethod('doStuff', 'promise'),
 * })
 * abstract class MyLazyService {
 *   abstract doStuff(): Promise<void>;
 * }
 * ```
 *
 * @example With a provider:
 *
 * ```ts
 * @NgModule({
 *   providers: [
 *     {
 *       provide: MyLazyService,
 *       useFactory:
 *         lazyFactory(
 *           creator => import('./my-lazy-implementation.js')
 *             .then(module => creator.fromService(module.MyLazyImplementation))
 *         )
 *         .markSafeMethod('doStuff', 'promise'),
 *     },
 *   ],
 * })
 * class MyModule {}
 * ```
 *
 * @param serviceFactory Function that loads and instantiates the actual implementation
 */
export let lazyFactory: <ServiceT extends object>(
	serviceFactory: LazyFactoryFn<ServiceT>,
) => LazyFactory<ServiceT>;

interface LazyServiceRegistration {
	readonly isReady: boolean;
	readonly whenReady: Promise<unknown>;
	destroy(): void;
	load(): Promise<void>;
}

const dummyRegistration: Omit<LazyServiceRegistration, 'destroy'> = {
	isReady: true,
	whenReady: Promise.resolve(),
	async load() {
		// no-op
	},
};

/**
 * Service responsible for lazy loading services
 *
 * This service can be used to interact with lazy services, e.g. to trigger their creation or to check whether they've been created yet.
 */
@Injectable({providedIn: 'root'})
export abstract class LazyServiceLoader implements OnDestroy {
	static {
		lazyFactory = <ServiceT extends object>(
			serviceFactory: LazyFactoryFn<ServiceT>,
		): LazyFactory<ServiceT> => {
			const safeProperties = new Map<
				keyof ServiceT,
				(instance: Promise<ServiceT>) => unknown
			>();

			let trigger = LazyCreationTrigger.OnInjection;

			const factory = (() =>
				inject(LazyServiceLoader).#create(
					trigger,
					serviceFactory,
					new Map(safeProperties),
				)) as LazyFactory<ServiceT>;

			factory.createOn = t => {
				trigger = t;
				return factory;
			};

			factory.markSafeProperty = (propertyName, type) => {
				switch (type) {
					case 'promise':
						safeProperties.set(propertyName, instance =>
							instance.then(i => Reflect.get(i, propertyName)),
						);
						break;
					case 'observable':
						safeProperties.set(propertyName, instance =>
							from(instance).pipe(
								switchMap(
									i => Reflect.get(i, propertyName) as Observable<unknown>,
								),
							),
						);
						break;
					default:
						throw new TypeError(`Unsupported safe property type: ${type}`);
				}

				return factory;
			};

			factory.markSafeMethod = (methodName, type) => {
				switch (type) {
					case 'promise':
						safeProperties.set(
							methodName,
							instance =>
								(...args: unknown[]) =>
									instance.then(i =>
										Reflect.apply(
											Reflect.get(i, methodName) as Function,
											i,
											args,
										),
									),
						);
						break;
					case 'void':
						safeProperties.set(
							methodName,
							instance =>
								(...args: unknown[]) =>
									void instance.then(i =>
										Reflect.apply(
											Reflect.get(i, methodName) as Function,
											i,
											args,
										),
									),
						);
						break;
					case 'observable':
						safeProperties.set(
							methodName,
							instance =>
								(...args: unknown[]) =>
									from(instance).pipe(
										switchMap(
											i =>
												Reflect.apply(
													Reflect.get(i, methodName) as Function,
													i,
													args,
												) as Observable<unknown>,
										),
									),
						);
						break;
					default:
						throw new TypeError(`Unsupported safe method type: ${type}`);
				}

				return factory;
			};

			return factory;
		};
	}

	readonly #services = new Map<unknown, LazyServiceRegistration>();

	#getServiceRegistration(service: unknown) {
		return this.#services.get(service) ?? dummyRegistration;
	}

	/**
	 * If the given service is a lazy service, trigger its creation if it hasn't been created yet
	 *
	 * If the given service is not a lazy service, this method does nothing.
	 *
	 * @param service Lazy service instance
	 * @returns a promise that resolves once the service has been loaded
	 */
	async load(service: unknown): Promise<void> {
		await this.#getServiceRegistration(service).load();
	}

	/**
	 * If the given service is a lazy service, return whether it is ready for use
	 *
	 * If the given service is not a lazy service, this method always returns true.
	 *
	 * This method can be used to protect usage of "unsafe" properties and methods to prevent errors from popping up.
	 *
	 * @see {@link whenReady}
	 * @param service Lazy service instance
	 */
	isReady(service: unknown): boolean {
		return this.#getServiceRegistration(service).isReady;
	}

	/**
	 * If the given service is a lazy service, return a promise that resolves when the service becomes ready.
	 *
	 * If the given service is not a lazy service, the returned promise resolves immediately.
	 *
	 * This method can be used to protect usage of "unsafe" properties and methods to prevent errors from popping up.
	 *
	 * @see {@link isReady}
	 * @param service Lazy service instance
	 */
	async whenReady(service: unknown): Promise<void> {
		await this.#getServiceRegistration(service).whenReady;
	}

	ngOnDestroy(): void {
		for (const registration of this.#services.values()) {
			registration.destroy();
		}
	}

	#create<ServiceT extends object>(
		trigger: LazyCreationTrigger,
		serviceFactory: LazyFactoryFn<ServiceT>,
		safeProperties: ReadonlyMap<
			PropertyKey,
			(instance: Promise<ServiceT>) => unknown
		>,
	): ServiceT {
		const injector = inject(Injector);

		const moduleAndValuePromise = new Deferred<{
			service: ServiceT;
			destroy: () => void;
		}>();
		// Browsers use a heuristic to detect whether there's something handling
		// rejected promises, but this leads to false positives if the service
		// is instantiated with trigger "on injection" and is only accessed later on.
		moduleAndValuePromise.catch(() => {});

		let getValue: (prop: string | symbol) => ServiceT = prop => {
			if (isDevMode()) {
				throw new ServiceNotReadyError(
					`Lazy service is not ready yet\nDid you forget to mark property ${String(
						prop,
					)} as safe?`,
				);
			}
			throw new ServiceNotReadyError(`Lazy service is not ready yet`);
		};

		let getOrCreateValueAsync: () => Promise<ServiceT> = () => {
			const valuePromise = create().catch(error => {
				moduleAndValuePromise.reject(error);
				getValue = () => {
					throw error;
				};
				throw error;
			});

			getOrCreateValueAsync = () => valuePromise;
			getValueAsync = () => valuePromise;
			return valuePromise;

			async function create(): Promise<ServiceT> {
				const creator = (
					await runInInjectionContext(injector, () => serviceFactory())
				)?.[lazilyCreatedMarker];

				if (!creator) {
					if (isDevMode()) {
						throw new Error(
							`The factory function passed into LazyServiceLoader didn't call createFromInjectable, createFromModule, or createFromEnvironment`,
						);
					} else {
						throw new Error(`Factory function didn't create service`);
					}
				}

				if (moduleAndValuePromise.isResolved) {
					// This can only happen if the proxy service is destroyed
					return moduleAndValuePromise as unknown as Promise<never>;
				}

				const result = creator(injector);
				moduleAndValuePromise.resolve(result);
				getValue = () => result.service;
				return result.service;
			}
		};

		let getValueAsync =
			trigger !== LazyCreationTrigger.Explicit
				? getOrCreateValueAsync
				: () => moduleAndValuePromise.then(v => v.service);

		const {proxy, revoke} = Proxy.revocable<ServiceT>({} as ServiceT, {
			get(_, prop) {
				if (prop === 'ngOnDestroy') {
					return destroy;
				}
				if (prop === 'constructor') {
					return fakeConstructor;
				}

				const safeGetter = safeProperties.get(prop);
				if (safeGetter) {
					return safeGetter(getValueAsync());
				}

				return Reflect.get(getValue(prop), prop);
			},
			set(_, prop, newValue) {
				if (prop === 'ngOnDestroy') {
					throw new OperationNotSupportedError(`${prop} cannot be edited`);
				}

				if (safeProperties.has(prop)) {
					throw new OperationNotSupportedError(
						`Properties marked as safe properties cannot be edited`,
					);
				}

				return Reflect.set(getValue(prop), prop, newValue);
			},
			has(_, prop) {
				if (prop === 'ngOnDestroy' || safeProperties.has(prop)) {
					return true;
				}

				return Reflect.has(getValue(prop), prop);
			},

			getOwnPropertyDescriptor: notSupported('getOwnPropertyDescriptor'),
			defineProperty: notSupported('defineProperty'),
			deleteProperty: notSupported('deleteProperty'),

			getPrototypeOf: notSupported('getPrototypeOf'),
			setPrototypeOf: notSupported('setPrototypeOf'),

			isExtensible: notSupported('isExtensible'),
			preventExtensions: notSupported('preventExtensions'),

			ownKeys: notSupported('ownKeys'),
		});

		function fakeConstructor() {}
		fakeConstructor.prototype = Object.create(proxy);

		const destroy = () => {
			if (!this.#services.delete(proxy)) {
				return;
			}

			revoke();

			if (moduleAndValuePromise.isResolved) {
				moduleAndValuePromise.value?.destroy();
			} else {
				moduleAndValuePromise.reject(
					new Error(
						`The service has been destroyed before it finished creating`,
					),
				);
			}
		};

		inject(DestroyRef, {optional: true})?.onDestroy(destroy);

		this.#services.set(proxy, {
			whenReady: moduleAndValuePromise,
			get isReady() {
				return moduleAndValuePromise.isResolved;
			},
			destroy,
			async load() {
				await getOrCreateValueAsync();
			},
		});

		if (trigger === LazyCreationTrigger.OnInjection) {
			getOrCreateValueAsync();
		}

		return proxy;
	}
}
