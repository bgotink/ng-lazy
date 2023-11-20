import {expect, createTest} from '@ngx-playwright/test';

import {MainScreen} from '../harnesses/app.mjs';

const test = createTest(MainScreen);

test.describe('lazy service created on access', () => {
	test('should not load immediately', async ({$: {lazy, lazyOnAccess}}) => {
		await expect.poll(() => lazy.isReady()).toBe(true);
		await expect(lazyOnAccess.isReady()).resolves.toBe(false);

		await (await lazyOnAccess.refreshUnsafeProperty()).click();
		await expect
			.poll(async () => (await lazyOnAccess.unsafeProperty()).isError())
			.toBe(true);

		await (await lazyOnAccess.refreshUnsafeMethod()).click();
		await expect
			.poll(async () => (await lazyOnAccess.unsafeMethod()).isError())
			.toBe(true);
	});

	test('should load on load()', async ({$: {lazyOnAccess}}) => {
		await (await lazyOnAccess.load()).click();
		await expect.poll(() => lazyOnAccess.isReady()).toBe(true);
	});

	for (const [refresh, status] of /** @type {const} */ ([
		['refreshSafePromise', 'safePromise'],
		['refreshSafeObservable', 'safeObservable'],

		['refreshSafePromiseMethod', 'safePromiseMethod'],
		['refreshSafeObservableMethod', 'safeObservableMethod'],
		['refreshSafeVoidMethod', 'safeVoidMethod'],
	])) {
		test(`should load on access of ${status}`, async ({$: {lazyOnAccess}}) => {
			await (await lazyOnAccess[refresh]()).click();

			await expect.poll(() => lazyOnAccess.isReady()).toBe(true);
			await expect((await lazyOnAccess[status]()).isSuccess()).resolves.toBe(
				true,
			);

			await (await lazyOnAccess.refreshUnsafeProperty()).click();
			await expect
				.poll(async () => (await lazyOnAccess.unsafeProperty()).isSuccess())
				.toBe(true);

			await (await lazyOnAccess.refreshUnsafeMethod()).click();
			await expect
				.poll(async () => (await lazyOnAccess.unsafeMethod()).isSuccess())
				.toBe(true);
		});
	}
});
