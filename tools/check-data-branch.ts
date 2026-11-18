/*
 * Checks that a data branch (data/…, opened by the dashboard) changes only the data compared with its base: the
 * CI runs it on such pull requests, so a branch that touches code, workflows or dependencies never merges.
 * Usage: node tools/check-data-branch.ts <base-commit>
 */
import { execFileSync } from 'node:child_process';
import { dataBranchProblems } from './lib/data-branch.ts';

const base = process.argv[2];
if (base === undefined || !/^[\w./~^-]+$/.test(base)) {
	console.error('usage: node tools/check-data-branch.ts <base-commit>');
	process.exit(2);
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' });
const files = git('diff', '--name-only', `${base}...HEAD`)
	.split('\n')
	.filter((file) => file !== '');
const packageJson = files.includes('package.json')
	? { base: git('show', `${base}:package.json`), head: git('show', 'HEAD:package.json') }
	: undefined;
const problems = dataBranchProblems(files, packageJson);
if (problems.length > 0) {
	for (const problem of problems) console.error(`✖ ${problem}`);
	process.exit(1);
}
console.log(`✔ data branch: ${String(files.length)} changed files, all data`);
