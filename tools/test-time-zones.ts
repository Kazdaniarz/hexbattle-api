/*
 * Runs the test suite under several time zones; every run must pass.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VITEST_BIN = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

/* * Zones */
const TIME_ZONES = ['UTC', 'Europe/Warsaw', 'America/New_York', 'Asia/Tokyo'];

/* * Run */
for (const timeZone of TIME_ZONES) {
	console.log(`\n▶ TZ=${timeZone}`);
	const result = spawnSync(process.execPath, [VITEST_BIN, 'run'], {
		stdio: 'inherit',
		env: { ...process.env, TZ: timeZone },
	});
	if (result.status !== 0) {
		console.error(`✖ tests failed under TZ=${timeZone}`);
		process.exit(result.status ?? 1);
	}
}
console.log(`\n✔ tests passed under ${TIME_ZONES.join(', ')}`);
