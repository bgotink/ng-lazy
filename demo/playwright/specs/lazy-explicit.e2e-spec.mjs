import {expect, createTest} from '@ngx-playwright/test';

import {MainScreen} from '../harnesses/app.mjs';

const test = createTest(MainScreen);

test.describe('lazy service created on explicit load', () => {
	test('should not load immediately', async ({$: {lazy, lazyExplicit}}) => {
		await expect.poll(() => lazy.isReady()).toBe(true);
		await expect(lazyExplicit.isReady()).resolves.toBe(false);

		await (await lazyExplicit.refreshUnsafeProperty()).click();
		await expect
			.poll(async () => (await lazyExplicit.unsafeProperty()).isError())
			.toBe(true);

		await (await lazyExplicit.refreshUnsafeMethod()).click();
		await expect
			.poll(async () => (await lazyExplicit.unsafeMethod()).isError())
			.toBe(true);
	});

	test('should load on load()', async ({$: {lazyExplicit}}) => {
		await (await lazyExplicit.load()).click();
		await expect.poll(() => lazyExplicit.isReady()).toBe(true);
	});

	for (const [refresh, status] of /** @type {const} */ ([
		['refreshSafePromise', 'safePromise'],
		['refreshSafeObservable', 'safeObservable'],

		['refreshSafePromiseMethod', 'safePromiseMethod'],
		['refreshSafeObservableMethod', 'safeObservableMethod'],
		['refreshSafeVoidMethod', 'safeVoidMethod'],
	])) {
		test(`should not load on access of ${status}`, async ({
			$: {lazyExplicit},
		}) => {
			// We expect this test to timeout
			test.fail();

			await (await lazyExplicit[refresh]()).click();

			await expect.poll(() => lazyExplicit.isReady()).toBe(true);
		});
	}
});
