import type { AdmissionEvent, School } from '../types';

const CRLF = '\r\n';

function escapeText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll(/\r?\n/g, '\\n');
}

function dateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compactDate(value: string): string {
  return value.slice(0, 10).replaceAll('-', '');
}

function nextDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function localDateTime(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) throw new Error(`Unsupported date-time: ${value}`);
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6] ?? '00'}`;
}

function fold(line: string): string {
  const chunks: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 73) {
    let take = Math.min(73, rest.length);
    while (new TextEncoder().encode(rest.slice(0, take)).length > 73) take -= 1;
    chunks.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  chunks.push(rest);
  return chunks.join(`${CRLF} `);
}

function eventLines(event: AdmissionEvent, school: School): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(event.id)}@juken-calendar`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `SUMMARY:${escapeText(`${school.name}｜${event.title}`)}`,
    `DESCRIPTION:${escapeText(`学校公式情報: ${event.source_url}\n最終確認: ${event.verified_at ?? '未確認'}`)}`,
    `URL:${event.source_url}`,
  ];

  if (dateOnly(event.starts_at)) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.starts_at)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDate(event.ends_at ?? event.starts_at)}`);
  } else {
    lines.push(`DTSTART;TZID=Asia/Tokyo:${localDateTime(event.starts_at)}`);
    lines.push(`DTEND;TZID=Asia/Tokyo:${localDateTime(event.ends_at ?? event.starts_at)}`);
  }

  if (event.change_type === 'cancelled' || event.status === 'cancelled') lines.push('STATUS:CANCELLED');
  lines.push('END:VEVENT');
  return lines;
}

export function generateIcs(events: AdmissionEvent[], schools: School[]): string {
  const schoolMap = new Map(schools.map((school) => [school.id, school]));
  const verified = events.filter((event) => event.status === 'verified' && event.verified_at);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Juken Calendar//Official School Schedule//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:中学受験日程',
    'X-WR-TIMEZONE:Asia/Tokyo',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Tokyo',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:JST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const event of verified) {
    const school = schoolMap.get(event.school_id);
    if (school) lines.push(...eventLines(event, school));
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join(CRLF)}${CRLF}`;
}
