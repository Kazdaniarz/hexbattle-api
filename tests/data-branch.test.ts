/*
 * Data branches may change only the data: data/, the image manifest, the changelog and package.json's version.
 */
import { describe, expect, it } from 'vitest';
import { dataBranchProblems } from '../tools/lib/data-branch.ts';

const pkg = (version: string, extra = '') => `{\n\t"name": "x",\n\t"version": "${version}"${extra}\n}\n`;

describe('data branch check', () => {
	it('accepts data, manifest, changelog and a new version', () => {
		expect(
			dataBranchProblems(['data/armies/moloch.json', 'assets.manifest.json', 'CHANGELOG.md', 'package.json'], {
				base: pkg('0.1.0'),
				head: pkg('0.1.1'),
			}),
		).toEqual([]);
	});

	it('refuses code, workflows, the lockfile and other package.json changes', () => {
		expect(
			dataBranchProblems(['tools/build.ts', '.github/workflows/ci.yml', 'pnpm-lock.yaml', 'data/../tools/x.ts']),
		).toEqual([
			'tools/build.ts: not a data file',
			'.github/workflows/ci.yml: not a data file',
			'pnpm-lock.yaml: not a data file',
			'data/../tools/x.ts: not a data file',
		]);
		expect(
			dataBranchProblems(['package.json'], { base: pkg('0.1.0'), head: pkg('0.1.1', ',\n\t"scripts": {}') }),
		).toEqual(['package.json: only the version may change on a data branch']);
	});
});
