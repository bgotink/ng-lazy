# `@bgotink/ng-lazy`

Small (under 1.9kB minified + gzip) Angular library to lazy load services

## Usage

Import the `lazyFactory` function and use it to build a factory function to pass into `useFactory` on an `@Injectable()` or in a provider in `@NgModule()` or `makeEnvironmentProviders`.

```ts
import {Injectable} from '@angular/core';
import {lazyFactory, createFromInjectable} from '@bgotink/ng-lazy';

@Injectable({
	provideIn: 'root',
	useFactory: lazyFactory(() =>
		import('./big-implementation-file.js').then(mod =>
			createFromInjectable(mod.SomeServiceImplementation),
		),
	).markSafeMethod('doSomething', 'promise'),
})
export abstract class SomeService {
	abstract doSomething(): Promise<void>;
}
```

### Creation

The lazy factory function passed into `lazyFactory` must use one of the creator functions to create the service instance before the returned promise resolves.
The function runs in an injection context, so it can make use of [`inject()`](https://angular.dev/api/core/inject) to access other services.

The following creator functions are provided:

- `createFromInjectable(type)` accepts a class with [`@Injectable()`](https://angular.dev/api/core/Injectable) on it.
  A new instance of that service will be created, and used as the lazy instance.
- `createFromModule(type, token)` accepts a class with [`@NgModule()`](https://angular.dev/api/core/NgModule) on it and an injection token that is present in that module.
  The module will be loaded, and the `token` will be extracted from its providers.
- `createFromEnvironment(providers, token)` accepts providers and/or environment providers and an injection token that's present in these providers.
  A new [`EnvironmentInjector`](https://angular.dev/api/core/EnvironmentInjector) will be created, and the `token` will be extracted from it.

### Destruction

Lazily created services implement the `OnDestroy` interface.
Their `ngOnDestroy()` method destroys the underlying service, module, or injector, depending on how which creator method was used.

### Timings

The factory function returned by `lazyFactory` returns a [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) that forwards all operations onto the lazy loaded service instance.
This proxy service can be injected without waiting for the service to be lazy loaded, but all interactions have to wait for the actual service to load.

You can protect against issues using the `LazyServiceLoader` service.
It exposes methods to check whether a service is ready, or to wait for a service to be ready:

```ts
const lazyServiceLoader = inject(LazyServiceLoader);
const someService = inject(SomeService); // defined in the usage example

async function doSomething() {
	await lazyServiceLoader.whenReady(someService);
	await someService.doSomething();
}
```

The lazy factory can do this for you if you mark properties and methods as "safe" to use before the service finished loading.
This can be applied on properties of type `Promise<?>` or `Observable<?>` and on methods that return `Promise<?>`, `Observable<?>`, or `void`.
The Proxy will automatically wait for the service to load and then access the actual property or method.

Some things to take care of with these safe properties and methods:

- The exact moment on which the real property is accessed or the real method is called is different from the moment at which the proxied version is accessed.
  This timing difference is also present if the service has already finished loading.
  As such, time-sensitive properties or methods should not be marked as safe.

  ```ts
  // the safe method is called before the unsafe one on the proxy
  proxy.safeVoidMethod();
  proxy.unsafeMethod();

  // --> what happens on the real underlying service:

  realService.unsafeMethod();
  // some time later
  realService.safeVoidMethod();

  // The order is reversed!
  ```

- Safe methods are always bound to the service instance.
- Safe properties and methods cannot be edited from outside the service, though the lazy loaded service itself is free to edit these.

The proxy limits which actions are supported on the injected servide.
In "regular" usage of Angular services this shouldn't pose a problem, but special actions are not supported.
This includes reading or changing the service prototype, freezing or preventing extensions on the service, listing all keys of the service, and any operation that accesses or modifies property descriptors.

### Triggers

The moment at which the service implementation is loaded can be chosen via a trigger.
There are three triggers:

- `LazyCreationTrigger.OnInjection` loads the implementation as soon as the proxy is injected for the first time.
  This is the default trigger.
- `LazyCreationTrigger.OnAccess` loads the implementation when the first "safe"
  property or method is accessed.
  This trigger delays loading the service until it's actually used.
- `LazyCreationTrigger.Explicit` doesn't automatically load the implementation.

Next to these triggers the service can also be loaded manually using the `LazyServiceLoader`'s `load` method:

```ts
const lazyServiceLoader = inject(LazyServiceLoader);
const someService = inject(SomeService); // defined in the usage example

await lazyServiceLoader.load(someService);
```

The `load` method expects as argument the proxied service, so if the `.OnInjection` trigger is used the `load` method won't have any effect.

## Loading different implementations

The `lazyFactory` function allows for dynamically deciding which service to load.

- You want to use different implementations of a service depending on which features are available in the browser, without punishing users using modern browsers by loading extra code they'll never need.

  ```ts
  import {Injectable} from '@angular/core';
  import {lazyFactory, createFromInjectable} from '@bgotink/ng-lazy';

  @Injectable({
  	provideIn: 'root',
  	useFactory: lazyFactory(creator => {
  		if ('popover' in HTMLElement.prototype)) {
  			return createFromInjectable(mod.NativePopOverOpener);
  		} else {
  			return import('./legacy-popover-opener.service.js').then(mod =>
  				createFromInjectable(mod.LegacyPopOverOpener)
  			);
  		}
  	}).markSafeMethod('open', 'promise'),
  })
  export abstract class PopOverOpener {
  	abstract open<T>(component: Type<T>, anchor: ElementRef<Element>): Promise<ComponentRef<T>>;
  }

  @Injectable()
  class NativePopOverOpener implements PopOverOpener {
    // implementation here
  }
  ```

- Your code runs in the web browser and in hybrid apps, but you don't want to load any cordova code in the web version.

  ```ts
  import {Injectable} from '@angular/core';
  import {lazyFactory, createFromInjectable} from '@bgotink/ng-lazy';

  @Injectable({
  	provideIn: 'root',
  	useFactory: lazyFactory(creator => {
  		if (window.cordova != null) {
  			return import('./cordova-camera.service.js').then(mod =>
  				createFromInjectable(mod.CordovaCamera),
  			);
  		}

  		return createFromInjectable(Camera);
  	}).markSafeMethod('takePicture', 'promise'),
  })
  export class Camera {
  	takePicture(): Promise<Blob> {
  		// implementation for web here
  	}
  }
  ```

- &hellip;
