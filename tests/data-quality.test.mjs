import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createValidator, findDuplicateIds, hasInvalidRegistrationWindow, publicEvents } from '../scripts/data-quality.mjs';

const schools = JSON.parse(await readFile(new URL('../data/schools.json', import.meta.url), 'utf8'));
const events = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../data/event.schema.json', import.meta.url), 'utf8'));
const mockExamOrganizers = JSON.parse(await readFile(new URL('../data/mock-exam-organizers.json', import.meta.url), 'utf8'));
const mockExamEvents = JSON.parse(await readFile(new URL('../data/mock-exam-events.json', import.meta.url), 'utf8'));
const validate = createValidator(schema);
const pilotSchoolIds = [
  'tohkatsu-jh',
  'shibaura-kashiwa-jh',
  'reitaku-jh',
  'meikei-jh',
  'ichikawa-jh',
  'toho-jh',
  'shiba-jh',
];

describe('official data quality gate', () => {
  it('preserves the seven pilot schools while allowing catalog growth', () => {
    const schoolIds = schools.map((school) => school.id);
    expect(schools.length).toBeGreaterThanOrEqual(7);
    expect(new Set(schoolIds).size).toBe(schools.length);
    for (const pilotSchoolId of pilotSchoolIds) expect(schoolIds).toContain(pilotSchoolId);
    expect(schools.length).toBeGreaterThanOrEqual(31);
    for (const school of schools) {
      expect(school.monitoring_status, school.id).toBe('verified');
      expect(school.verified_event_count, school.id).toBeGreaterThanOrEqual(0);
      expect(school.official_sources.length, school.id).toBeGreaterThan(0);
      expect(JSON.stringify(school), school.id).not.toMatch(/candidate|quarantined|incident|event_map|registration_map/);
      if (pilotSchoolIds.includes(school.id)) {
        expect(school.prefecture, school.id).toBeTruthy();
        expect(school.municipality, school.id).toBeTruthy();
      }
    }
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
    expect(events.length).toBeGreaterThanOrEqual(107);
    expect(events.every((event) => event.status === 'verified' && event.verified_at)).toBe(true);
  });

  it('publishes only verified mock exams from a known organizer', () => {
    const organizerIds = new Set(mockExamOrganizers.map((organizer) => organizer.id));
    expect(mockExamOrganizers).toHaveLength(4);
    expect(mockExamEvents).toHaveLength(28);
    expect(findDuplicateIds(mockExamEvents)).toEqual([]);
    for (const event of mockExamEvents) {
      expect(organizerIds.has(event.organizer_id), event.id).toBe(true);
      expect(event.admission_year, event.id).toBe(2027);
      expect(event.status, event.id).toBe('verified');
      expect(event.verified_at, event.id).toBeTruthy();
      expect(event.source_url, event.id).toMatch(/^https:\/\//);
    }
  });
});
