/*
 * Data branches (data/…): the dashboard publishes through pull requests from such branches, and the server that
 * deploys main runs this repository's own tools. So a data branch may change only the data – data/, the image
 * manifest, the changelog and the version number in package.json – never code, workflows or dependencies.
 */

/** the files a data branch may change besides package.json's version */
const ALLOWED = [/^data\/[\w./-]+$/, /^assets\.manifest\.json$/, /^CHANGELOG\.md$/];

/** package.json with its version left out, for comparing everything else */
function withoutVersion(text: string): string {
	const parsed = JSON.parse(text) as Record<string, unknown>;
	delete parsed['version'];
	return JSON.stringify(parsed);
}

/**
 * The problems of a data branch: changed files outside the data, or a package.json change beyond its version.
 * `packageJson` holds the file at the base and at the branch (only needed when it changed).
 */
export function dataBranchProblems(files: readonly string[], packageJson?: { base: string; head: string }): string[] {
	const problems: string[] = [];
	for (const file of files) {
		if (file === 'package.json') {
			if (packageJson === undefined || withoutVersion(packageJson.base) !== withoutVersion(packageJson.head))
				problems.push('package.json: only the version may change on a data branch');
			continue;
		}
		if (file.includes('..') || !ALLOWED.some((pattern) => pattern.test(file)))
			problems.push(`${file}: not a data file`);
	}
	return problems;
}
