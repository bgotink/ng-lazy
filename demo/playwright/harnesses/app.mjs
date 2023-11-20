import {ComponentHarness, HarnessPredicate} from '@angular/cdk/testing';

export class LazyResultItemHarness extends ComponentHarness {
	static hostSelector = 'lazy-result-item';

	#status = this.locatorFor('.status');

	async isPending() {
		return (await this.#status()).hasClass('pending');
	}

	async isSuccess() {
		return (await this.#status()).hasClass('success');
	}

	async isError() {
		return (await this.#status()).hasClass('error');
	}

	async hasNotRun() {
		return (await this.#status()).hasClass('not-run');
	}
}

export class LazyResultHarness extends ComponentHarness {
	static hostSelector = 'lazy-result';

	load = this.locatorFor('button.load');

	safePromise = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {
			ancestor: '.property-promise',
		}),
	);
	refreshSafePromise = this.locatorFor('.property-promise > button');

	safeObservable = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {
			ancestor: '.property-observable',
		}),
	);
	refreshSafeObservable = this.locatorFor('.property-observable > button');

	unsafeProperty = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {ancestor: '.property-unsafe'}),
	);
	refreshUnsafeProperty = this.locatorFor('.property-unsafe > button');

	safePromiseMethod = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {ancestor: '.method-promise'}),
	);
	refreshSafePromiseMethod = this.locatorFor('.method-promise > button');

	safeObservableMethod = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {
			ancestor: '.method-observable',
		}),
	);
	refreshSafeObservableMethod = this.locatorFor('.method-observable > button');

	safeVoidMethod = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {ancestor: '.method-void'}),
	);
	refreshSafeVoidMethod = this.locatorFor('.method-void > button');

	unsafeMethod = this.locatorFor(
		new HarnessPredicate(LazyResultItemHarness, {ancestor: '.method-unsafe'}),
	);
	refreshUnsafeMethod = this.locatorFor('.method-unsafe > button');

	#ready = this.locatorFor('.is-ready');

	async isReady() {
		return (await this.#ready()).hasClass('yes');
	}
}

export class MainScreen extends ComponentHarness {
	// Selector to the application's root element
	static hostSelector = 'app-root';

	// The path to this screen, relative to the base URL of the
	// application
	static path = '/';

	lazy = this.locatorFor(
		new HarnessPredicate(LazyResultHarness, {selector: '#lazy'}),
	);
	lazyOnAccess = this.locatorFor(
		new HarnessPredicate(LazyResultHarness, {selector: '#lazyOnAccess'}),
	);
	lazyExplicit = this.locatorFor(
		new HarnessPredicate(LazyResultHarness, {selector: '#lazyExplicit'}),
	);
}
