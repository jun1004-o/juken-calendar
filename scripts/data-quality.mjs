import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function createValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addFormat('date-or-datetime', {
    type: 'string',
    validate: (value) => /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value),
  });
  return ajv.compile(schema);
}

export function findDuplicateIds(events) {
  const seen = new Set();
  const duplicates = new Set();
  for (const event of events) {
    if (seen.has(event.id)) duplicates.add(event.id);
    seen.add(event.id);
  }
  return [...duplicates];
}

export function hasInvalidRegistrationWindow(event) {
  if (!event.registration_opens_at || !event.registration_closes_at) return false;
  return new Date(event.registration_closes_at) < new Date(event.registration_opens_at);
}

export function publicEvents(events) {
  return events.filter((event) => event.status === 'verified' && event.verified_at);
}
