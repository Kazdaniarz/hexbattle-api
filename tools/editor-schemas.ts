/*
 * Writes the generated JSON Schemas to .generated/schema/ (git-ignored) for editor validation of data/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FILE_SCHEMAS, toJsonSchema, type FileKind } from './lib/json-schema.ts';

const OUT_DIR = fileURLToPath(new URL('../.generated/schema/', import.meta.url));

/* * Write */
await mkdir(OUT_DIR, { recursive: true });
for (const kind of Object.keys(FILE_SCHEMAS) as FileKind[]) {
	await writeFile(
		`${OUT_DIR}${kind}.schema.json`,
		`${JSON.stringify(toJsonSchema(FILE_SCHEMAS[kind]), null, '\t')}\n`,
	);
}
console.log(`✔ editor schemas written to .generated/schema/`);
