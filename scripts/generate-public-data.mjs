import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createValidator, findDuplicateIds, hasInvalidRegistrationWindow, publicEvents } from './data-quality.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schools = JSON.parse(await readFile(resolve(root, 'data/schools.json'), 'utf8'));
const events = JSON.parse(await readFile(resolve(root, 'data/events.json'), 'utf8'));
const changeHistory = JSON.parse(await readFile(resolve(root, 'data/change-history.json'), 'utf8'));
const mockExamOrganizers = JSON.parse(await readFile(resolve(root, 'data/mock-exam-organizers.json'), 'utf8'));
const mockExamEvents = JSON.parse(await readFile(resolve(root, 'data/mock-exam-events.json'), 'utf8'));
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

if (!Array.isArray(mockExamOrganizers) || mockExamOrganizers.length < 1) {
  throw new Error('At least one mock-exam organizer is required.');
}
const organizerIds = new Set(mockExamOrganizers.map((organizer) => organizer.id));
const mockDuplicates = findDuplicateIds(mockExamEvents);
if (mockDuplicates.length) throw new Error(`Duplicate mock-exam event IDs: ${mockDuplicates.join(', ')}`);
for (const event of mockExamEvents) {
  if (!organizerIds.has(event.organizer_id)) throw new Error(`Unknown mock-exam organizer for ${event.id}.`);
  if (!event.admission_year || !event.source_url || !event.verified_at || event.status !== 'verified') {
    throw new Error(`Unverified or incomplete mock-exam event: ${event.id}.`);
  }
}

const outputDir = resolve(root, 'public/data');
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'schools.json'), `${JSON.stringify(schools, null, 2)}\n`);
await writeFile(resolve(outputDir, 'events.json'), `${JSON.stringify(publicEvents(events), null, 2)}\n`);
await writeFile(resolve(outputDir, 'change-history.json'), `${JSON.stringify(changeHistory, null, 2)}\n`);
await writeFile(resolve(outputDir, 'mock-exam-organizers.json'), `${JSON.stringify(mockExamOrganizers, null, 2)}\n`);
await writeFile(resolve(outputDir, 'mock-exam-events.json'), `${JSON.stringify(mockExamEvents.filter((event) => event.status === 'verified' && event.verified_at), null, 2)}\n`);

console.log(`Generated public data: ${schools.length} schools, ${publicEvents(events).length} school events, ${mockExamEvents.length} mock-exam events.`);
