# Engineering and data rules

- Use school, municipality, or official admissions sources only. Third-party pages may help discovery but may not support a published fact.
- Never infer a missing date, time, target grade, or admission year.
- Every event requires `admission_year`, `source_url`, `retrieved_at`, `verified_at`, `status`, and `confidence`.
- Collection creates `candidate` records. An independent audit is required before changing them to `verified`.
- Candidate and quarantined records must never enter the public build or calendar export.
- Keep candidate records, incidents, audit queues, and calendar-integration metadata out of the public repository; publish only audited school/event data.
- Treat an admission-year mismatch as a critical data error.
- Add or update tests with every behavioral or data-quality change and run lint, typecheck, test, and build.
- Do not store personal information. School selection stays in browser `localStorage` only.
- Do not add paid services, authentication, personal-data collection, or irreversible migrations without Founder approval.
- Keep secrets in GitHub Actions encrypted secrets. Never print or commit credentials or LINE user IDs.
