import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createValidator, findDuplicateIds, hasInvalidRegistrationWindow, publicEvents } from './data-quality.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schools = JSON.parse(await readFile(resolve(root, 'data/schools.json'), 'utf8'));
const events = JSON.parse(await readFile(resolve(root, 'data/events.json'), 'utf8'));
const changeHistory = JSON.parse(await readFile(resolve(root, 'data/change-history.json'), 'utf8'));
const schema = JSON.parse(await readFile(resolve(root, 'data/event.schema.json'), 'utf8'));
const validate = createValidator(schema);

if (!Array.isArray(schools) || schools.length !== 7) {
  throw new Error(`Expected exactly seven pilot schools; found ${schools?.length ?? 0}.`);
}

for (const event of events) {
  if (!validate(event)) {
    throw new Error(`Invalid event ${event.id}: ${JSON.stringify(validate.errors)}`);
  }
  if (hasInvalidRegistrationWindow(event)) {
    throw new Error(`Registration closes before it opens for ${event.id}.`);
  }
}

const duplicates = findDuplicateIds(events);
if (duplicates.length) throw new Error(`Duplicate event IDs: ${duplicates.join(', ')}`);

const outputDir = resolve(root, 'public/data');
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'schools.json'), `${JSON.stringify(schools, null, 2)}\n`);
await writeFile(resolve(outputDir, 'events.json'), `${JSON.stringify(publicEvents(events), null, 2)}\n`);
await writeFile(resolve(outputDir, 'change-history.json'), `${JSON.stringify(changeHistory, null, 2)}\n`);

console.log(`Generated public data: ${schools.length} schools, ${publicEvents(events).length} verified events.`);
