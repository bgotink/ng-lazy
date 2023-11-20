import {type LazyFactoryFn, type LazyFactory, lazyFactory} from './index.js';

/**
 * Factory function that lazily creates a service with different implementations, to be used in `useFactory`
 */
export interface DifferentialLazyFactory<DeterminantT, ServiceT>
	extends LazyFactory<ServiceT> {
	/**
	 * Register the given factory to create the lazy implementation if the given determinant is returned by `determine()`
	 *
	 * @param determinant Determinant for which to register implementation
	 * @param factory The factory to create this implementation
	 * @returns `this` for chaining
	 */
	setImplementation(
		determinant: DeterminantT,
		factory: LazyFactoryFn<ServiceT>,
	): this;
}

/**
 * Error thrown when the `determine()` function passed into `differentialLazyFactory` returns a determinant for which no implementation has been registered
 */
export class UnexpectedDeterminantError extends Error {
	override name = 'UnexpectedDeterminantError';
}

function unexpectedDeterminant(determinant: unknown): never {
	throw new UnexpectedDeterminantError(
		`Got determinant "${String(determinant)}" which has not been registered`,
	);
}

/**
 * Create a builder for a factory for a lazy service
 *
 * This builder differs from the one created by {@link lazyFactory} as it
 * allows for using different lazy loaded implementations depending on circumstance.
 *
 * Which implementation is loaded, is determined by the `determine` parameter.
 *
 * @param determine Function that determines which implementation to load. This function has access to `inject()`.
 * @param fallbackServiceFactory (Lazy) service factory used when the `determine` function returns a determinant for which no implementation has been registered. The default fallback will throw an error.
 */
export function differentialLazyFactory<DeterminantT, ServiceT extends object>(
	determine: () => DeterminantT,
	fallbackServiceFactory?: LazyFactoryFn<ServiceT>,
): DifferentialLazyFactory<DeterminantT, ServiceT> {
	const serviceFactories = new Map<DeterminantT, LazyFactoryFn<ServiceT>>();

	const factory = lazyFactory<ServiceT>(() => {
		const determinant = determine();
		return (
			serviceFactories.get(determinant) ??
			fallbackServiceFactory ??
			unexpectedDeterminant(determinant)
		)();
	}) as DifferentialLazyFactory<DeterminantT, ServiceT>;

	factory.setImplementation = (determinant, fn) => {
		serviceFactories.set(determinant, fn);
		return factory;
	};

	return factory;
}
