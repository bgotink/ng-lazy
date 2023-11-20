export {
	createFromEnvironment,
	createFromInjectable,
	createFromModule,
	LazilyCreated,
} from './creator.js';
export {
	LazyCreationTrigger,
	lazyFactory,
	LazyFactory,
	LazyFactoryFn,
	LazyServiceLoader,
	OperationNotSupportedError,
	ServiceNotReadyError,
} from './lazy.js';
