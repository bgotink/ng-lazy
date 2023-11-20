import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @type {import('@ngx-playwright/test').PlaywrightTestConfig}
 */
const config = {
	use: {
		channel: 'chrome',
		headless: true,
	},
	timeout: 1_000,

	testDir: join(__dirname, 'specs'),
	testMatch: '**/*.e2e-spec.mjs',

	outputDir: join(__dirname, 'results'),

	reporter: [
		[process.env.GITHUB_ACTION ? 'github' : 'list'],
		['junit', {outputFile: join(__dirname, 'results/junit.xml')}],
	],
};

export default config;
