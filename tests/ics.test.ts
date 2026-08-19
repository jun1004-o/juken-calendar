import { describe, expect, it } from 'vitest';
import { generateIcs } from '../src/lib/ics';
import type { AdmissionEvent, School } from '../src/types';

const school: School = { id: 'school', name: 'テスト中学校', official_sources: ['https://example.edu/'] };
const base: AdmissionEvent = {
  id: 'school:2027:briefing', school_id: 'school', title: '入試説明会', category: 'briefing',
  starts_at: '2026-10-01T10:30:00+09:00', ends_at: '2026-10-01T12:00:00+09:00',
  registration_opens_at: null, registration_closes_at: null, target_grades: [6], admission_year: 2027,
  source_url: 'https://example.edu/briefing', source_type: 'official_web', retrieved_at: '2026-08-20T06:00:00+09:00',
  verified_at: '2026-08-20T07:00:00+09:00', status: 'verified', confidence: 'high', content_hash: null, change_note: 'Verified',
};

describe('RFC 5545 export', () => {
  it('exports verified events with Asia/Tokyo semantics and CRLF', () => {
    const ics = generateIcs([base], [school]);
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('TZID:Asia/Tokyo');
    expect(ics).toContain('DTSTART;TZID=Asia/Tokyo:20261001T103000');
    expect(ics).toContain('DTEND;TZID=Asia/Tokyo:20261001T120000');
    expect(ics).toContain('SUMMARY:テスト中学校｜入試説明会');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('does not export unverified events', () => {
    const candidate = { ...base, status: 'candidate', verified_at: null } as AdmissionEvent;
    expect(generateIcs([candidate], [school])).not.toContain('BEGIN:VEVENT');
  });

  it('uses exclusive DTEND for all-day events', () => {
    const allDay = { ...base, starts_at: '2026-10-01', ends_at: '2026-10-01' };
    const ics = generateIcs([allDay], [school]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261001');
    expect(ics).toContain('DTEND;VALUE=DATE:20261002');
  });
});
