/*
 * Builds the npm package @hexbattle/schema into a temporary folder and fails when its type declarations lost a
 * type on the way (TypeScript writes "elided" or falls back to `any` for types it can't spell out, e.g. an
 * inferred recursive schema). Part of `pnpm check`, so a broken package never gets published.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = fileURLToPath(new URL('../packages/schema/', import.meta.url));
const TSC = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));
const LOST = [/\/\*elided\*\//, /:\s*any\b/, /<any\b/, /\bany>/];

const out = await mkdtemp(path.join(tmpdir(), 'hexbattle-schema-'));
try {
	execFileSync(process.execPath, [TSC, '-p', path.join(PACKAGE_DIR, 'tsconfig.build.json'), '--outDir', out], {
		stdio: 'inherit',
	});
	const problems: string[] = [];
	for (const file of (await readdir(out)).filter((name) => name.endsWith('.d.ts'))) {
		const lines = (await readFile(path.join(out, file), 'utf8')).split('\n');
		lines.forEach((line, position) => {
			if (LOST.some((pattern) => pattern.test(line)))
				problems.push(`${file}:${String(position + 1)}: ${line.trim()}`);
		});
	}
	if (problems.length > 0) {
		console.error(`✖ @hexbattle/schema declarations lost types:\n${problems.join('\n')}`);
		process.exitCode = 1;
	} else {
		console.log('✔ @hexbattle/schema declarations complete');
	}
} finally {
	await rm(out, { recursive: true, force: true });
}
