import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createValidator, findDuplicateIds, hasInvalidRegistrationWindow, publicEvents } from '../scripts/data-quality.mjs';

const schools = JSON.parse(await readFile(new URL('../data/schools.json', import.meta.url), 'utf8'));
const events = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../data/event.schema.json', import.meta.url), 'utf8'));
const validate = createValidator(schema);

describe('official data quality gate', () => {
  it('contains exactly the seven pilot schools and unique IDs', () => {
    expect(schools).toHaveLength(7);
    expect(new Set(schools.map((school) => school.id)).size).toBe(7);
  });

  it('validates every seeded event', () => {
    for (const event of events) expect(validate(event), event.id).toBe(true);
  });

  it('rejects an event without admission_year', () => {
    const event = structuredClone(events[0]);
    delete event.admission_year;
    expect(validate(event)).toBe(false);
  });

  it('detects a registration window that closes before it opens', () => {
    const event = { registration_opens_at: '2026-09-10T10:00:00+09:00', registration_closes_at: '2026-09-09T10:00:00+09:00' };
    expect(hasInvalidRegistrationWindow(event)).toBe(true);
  });

  it('detects duplicate IDs', () => {
    expect(findDuplicateIds([{ id: 'same' }, { id: 'same' }, { id: 'other' }])).toEqual(['same']);
  });

  it('never publishes candidate, quarantined, or unverified records', () => {
    const result = publicEvents([
      { status: 'candidate', verified_at: null },
      { status: 'quarantined', verified_at: null },
      { status: 'verified', verified_at: null },
      { status: 'verified', verified_at: '2026-08-20T06:00:00+09:00' },
    ]);
    expect(result).toHaveLength(1);
  });
});
