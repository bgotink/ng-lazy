import {expect, createTest} from '@ngx-playwright/test';

import {MainScreen} from '../harnesses/app.mjs';

const test = createTest(MainScreen);

test.describe('lazy service created at instantiation', () => {
	test('should load immediately', async ({$: {lazy}}) => {
		await expect.poll(() => lazy.isReady()).toBe(true);

		await (await lazy.refreshUnsafeProperty()).click();
		await expect
			.poll(async () => (await lazy.unsafeProperty()).isSuccess())
			.toBe(true);

		await (await lazy.refreshUnsafeMethod()).click();
		await expect
			.poll(async () => (await lazy.unsafeMethod()).isSuccess())
			.toBe(true);
	});
});
