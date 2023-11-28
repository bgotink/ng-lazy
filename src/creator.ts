import {
	Injector,
	ProviderToken,
	createNgModule,
	type Type,
	EnvironmentProviders,
	EnvironmentInjector,
	createEnvironmentInjector,
	Provider,
	OnDestroy,
} from '@angular/core';

/**
 * The only reason we have this symbol is so we can use it in an interface
 *
 * We use the interface as a kind of "opaque type" to enforce usage of the `creator` to create service instances in the factory function
 */
export const lazilyCreatedMarker = /** @__PURE__ */ Symbol();

/**
 * Opaque type
 */
export interface LazilyCreated<T> {
	[lazilyCreatedMarker](injector: Injector): {
		service: T;
		destroy: () => void;
	};
}

function make<T>(
	factory: LazilyCreated<T>[typeof lazilyCreatedMarker],
): LazilyCreated<T> {
	const obj = {} as LazilyCreated<T>;

	Reflect.defineProperty(obj, lazilyCreatedMarker, {
		enumerable: false,
		value: factory,
	});

	return obj;
}

/**
 * Create an instance of the given class and use it as the lazy service instance
 *
 * @example
 *
 * ```ts
 * lazyFactory(() =>
 *   await('./impl.js')
 *     .then(mod => createFromInjectable(mod.MyService)),
 * )
 * ```
 *
 * @param type The service class to instantiate, annotated with `@Injectable`
 */
export const createFromInjectable = <T>(service: Type<T>): LazilyCreated<T> =>
	make(injector => {
		const childInjector = Injector.create({
			providers: [service],
			parent: injector,
		});

		const serviceInstance = childInjector.get(service);

		return {
			service: serviceInstance,
			destroy: () =>
				(serviceInstance as T & Partial<OnDestroy>).ngOnDestroy?.(),
		};
	});

/**
 * Load the given `@NgModule` decorated class as module and take the service instance from it
 *
 * @example
 *
 * ```ts
 * lazyFactory(() =>
 *   await('./impl.js')
 *     .then(mod => creatorFromModule(mod.MyModule, mod.MyToken)),
 * )
 * ```
 *
 * @param module The NgModule class
 * @param token The injection token to get from the NgModule and use as service instance
 */
export const createFromModule = <T>(
	module: Type<unknown>,
	token: ProviderToken<T>,
): LazilyCreated<T> =>
	make(injector => {
		const moduleRef = createNgModule(module, injector);
		const service = moduleRef.injector.get(token);
		return {service, destroy: () => moduleRef.destroy()};
	});

/**
 * Create a new environment with the given providers and extract the token
 *
 * @example
 *
 * ```ts
 * lazyFactory(() =>
 *   await('./impl.js')
 *     .then(mod => createFromEnvironment(mode.providers, mod.MyToken)),
 * )
 * ```
 *
 * @param providers The providers to load in a new EnvironmentInjector
 * @param token The injection token to get from the new injector and use as service instance
 */
export const createFromEnvironment = <T>(
	providers: (Provider | EnvironmentProviders)[],
	token: ProviderToken<T>,
): LazilyCreated<T> =>
	make(injector => {
		const childInjector = createEnvironmentInjector(
			providers,
			injector.get(EnvironmentInjector),
		);
		const service = childInjector.get(token);
		return {service, destroy: () => childInjector.destroy()};
	});
