import './style.css';
import { generateCalendarIcs } from './lib/ics';
import { matchesSchoolSearch } from './lib/search';
import type {
  AdmissionEvent,
  CalendarExportEvent,
  EventCategory,
  MockExamEvent,
  MockExamOrganizer,
  School,
} from './types';

const app = document.querySelector<HTMLElement>('#app')!;
if (!app) throw new Error('Application root is missing.');

type TimelineCategory = EventCategory | 'mock_exam' | 'registration_open';
type SourceKind = 'school' | 'mock_exam';

interface SourceOption {
  key: string;
  id: string;
  name: string;
  name_reading?: string;
  aliases?: string[];
  prefecture?: string | null;
  municipality?: string | null;
  ownership?: string | null;
  gender?: string | null;
  secondary_education_type?: string | null;
  verified_event_count?: number;
  kind: SourceKind;
}

interface TimelineEvent extends CalendarExportEvent {
  source_key: string;
  category: TimelineCategory;
  admission_year: number;
  change_type?: 'new' | 'changed' | 'cancelled';
}

const categoryLabels: Record<TimelineCategory, string> = {
  briefing: '説明会',
  open_school: '公開・体験',
  festival: '文化祭',
  application: '出願',
  exam: '試験',
  result: '合格発表',
  enrollment: '入学手続',
  other: 'その他',
  mock_exam: '模試',
  registration_open: '申込',
};

const categoryOptions = Object.entries(categoryLabels) as [TimelineCategory, string][];
const sourceSelectionKey = 'juken-calendar:selected-sources:v2';
const eventSelectionKey = 'juken-calendar:selected-events:v2';
const accessGrantKey = 'juken-calendar:access-grant:v1';
const expectedAccessHash = 'b86b783205f4697270e4cc617d68ba9ddca08762b227d13a53353147475a51af';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function hasAccess(): Promise<boolean> {
  if (import.meta.env.VITE_E2E_BYPASS === 'true') return true;
  if (localStorage.getItem(accessGrantKey) === expectedAccessHash) return true;
  const token = new URLSearchParams(location.hash.slice(1)).get('access');
  if (!token || await hash(token) !== expectedAccessHash) return false;
  localStorage.setItem(accessGrantKey, expectedAccessHash);
  return true;
}

function showAccessGate(): void {
  app.innerHTML = `<section class="panel access-panel">
    <span class="access-icon" aria-hidden="true">🔗</span>
    <h2>共有URLからご利用ください</h2>
    <p>この試験版は、案内されたURLをお持ちの方だけが利用できます。</p>
    <p class="privacy-note">ログイン、氏名、メールアドレスの登録はありません。</p>
  </section>`;
}

function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
    ...(value.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function formatVerified(value: string | null): string {
  if (!value) return '未確認';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

function loadSet(key: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(stored)) return new Set(stored.filter((id): id is string => typeof id === 'string'));
  } catch {
    localStorage.removeItem(key);
  }
  return new Set();
}

function saveSet(key: string, values: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...values]));
}

function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function schoolTimelineEvents(events: AdmissionEvent[], schoolMap: Map<string, School>): TimelineEvent[] {
  return events.flatMap((event) => {
    const school = schoolMap.get(event.school_id);
    if (!school || event.status !== 'verified' || !event.verified_at) return [];
    const sourceKey = `school:${school.id}`;
    const base: TimelineEvent = {
      id: event.id,
      title: event.title,
      owner_name: school.name,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      source_url: event.source_url,
      verified_at: event.verified_at,
      status: event.status,
      source_key: sourceKey,
      category: event.category,
      admission_year: event.admission_year,
      change_type: event.change_type,
    };
    const result: TimelineEvent[] = [base];
    if (event.registration_opens_at) result.push({
      ...base, id: `${event.id}:registration-open`, title: `${event.title} 申込受付開始`,
      starts_at: event.registration_opens_at, ends_at: event.registration_opens_at,
      category: 'registration_open', change_type: undefined,
    });
    if (event.registration_closes_at) result.push({
      ...base, id: `${event.id}:registration-close`, title: `${event.title} 申込締切`,
      starts_at: event.registration_closes_at, ends_at: event.registration_closes_at,
      category: 'registration_open', change_type: undefined,
    });
    return result;
  });
}

function mockTimelineEvents(events: MockExamEvent[], organizerMap: Map<string, MockExamOrganizer>): TimelineEvent[] {
  return events.flatMap((event) => {
    const organizer = organizerMap.get(event.organizer_id);
    if (!organizer || event.status !== 'verified' || !event.verified_at) return [];
    return [{
      id: event.id,
      title: event.title,
      owner_name: organizer.name,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      source_url: event.source_url,
      verified_at: event.verified_at,
      status: event.status,
      source_key: `mock:${organizer.id}`,
      category: event.category,
      admission_year: event.admission_year,
    }];
  });
}

async function start(): Promise<void> {
  if (!await hasAccess()) {
    showAccessGate();
    return;
  }

  const [schoolsResponse, eventsResponse, organizersResponse, mockEventsResponse] = await Promise.all([
    fetch('./data/schools.json'),
    fetch('./data/events.json'),
    fetch('./data/mock-exam-organizers.json'),
    fetch('./data/mock-exam-events.json'),
  ]);
  if ([schoolsResponse, eventsResponse, organizersResponse, mockEventsResponse].some((response) => !response.ok)) {
    throw new Error('日程データを取得できませんでした。');
  }

  const schools = await schoolsResponse.json() as School[];
  const schoolEvents = await eventsResponse.json() as AdmissionEvent[];
  const organizers = await organizersResponse.json() as MockExamOrganizer[];
  const mockEvents = await mockEventsResponse.json() as MockExamEvent[];
  const schoolMap = new Map(schools.map((school) => [school.id, school]));
  const organizerMap = new Map(organizers.map((organizer) => [organizer.id, organizer]));
  const sources: SourceOption[] = [
    ...schools.map((school) => ({
      key: `school:${school.id}`,
      id: school.id,
      name: school.name,
      name_reading: school.name_reading,
      aliases: school.aliases,
      prefecture: school.prefecture,
      municipality: school.municipality,
      ownership: school.ownership,
      gender: school.gender,
      secondary_education_type: school.secondary_education_type,
      verified_event_count: school.verified_event_count,
      kind: 'school' as const,
    })),
    ...organizers.map((organizer) => ({ key: `mock:${organizer.id}`, id: organizer.id, name: organizer.name, kind: 'mock_exam' as const })),
  ];
  const allEvents = [
    ...schoolTimelineEvents(schoolEvents, schoolMap),
    ...mockTimelineEvents(mockEvents, organizerMap),
  ].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const selectedSources = loadSet(sourceSelectionKey);
  const selectedEvents = loadSet(eventSelectionKey);
  let selectedCategory: TimelineCategory | 'all' = 'all';
  let fromDate = '';
  let schoolQuery = '';
  let prefectureFilter = 'all';
  let municipalityFilter = 'all';
  let ownershipFilter = 'all';
  let genderFilter = 'all';
  let scheduleFilter = 'all';

  const schoolSources = sources.filter((source) => source.kind === 'school');
  const optionValues = (field: 'prefecture' | 'municipality' | 'ownership' | 'gender'): string[] =>
    [...new Set(schoolSources.map((source) => source[field]).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ja'));
  const options = (values: string[]): string => values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');

  app.innerHTML = `
    <section class="panel setup-panel" aria-labelledby="source-title">
      <div class="section-heading">
        <div><span class="step">1</span><h2 id="source-title">学校・模試を選ぶ</h2></div>
        <span id="source-count" class="result-count"></span>
      </div>
      <label class="school-search">学校名を検索<input id="school-search" type="search" inputmode="search" autocomplete="off" placeholder="例：東葛飾、芝、麗澤" /></label>
      <div class="school-filters" aria-label="学校の絞り込み">
        <label>都県<select id="prefecture-filter"><option value="all">すべて</option>${options(optionValues('prefecture'))}</select></label>
        <label>市区町村<select id="municipality-filter"><option value="all">すべて</option>${options(optionValues('municipality'))}</select></label>
        <label>設置区分<select id="ownership-filter"><option value="all">すべて</option>${options(optionValues('ownership'))}</select></label>
        <label>男女区分<select id="gender-filter"><option value="all">すべて</option>${options(optionValues('gender'))}</select></label>
        <label>日程<select id="schedule-filter"><option value="all">すべて</option><option value="has-events">確認済み日程あり</option><option value="awaiting">公式発表待ち</option></select></label>
      </div>
      <section class="selected-schools" aria-labelledby="selected-school-title">
        <div class="source-group__heading"><h3 id="selected-school-title">選択中の学校</h3><span id="selected-school-count" class="result-count"></span></div>
        <div id="selected-school-list" class="selected-school-list"></div>
      </section>
      <div class="source-group">
        <div class="source-group__heading"><h3>学校</h3><button class="text-button source-toggle" data-kind="school" type="button">すべて選択</button></div>
        <div id="school-list" class="choice-grid"></div>
      </div>
      <div class="source-group">
        <div class="source-group__heading"><h3>模試</h3><button class="text-button source-toggle" data-kind="mock_exam" type="button">すべて選択</button></div>
        <div id="mock-list" class="choice-grid choice-grid--compact"></div>
      </div>
      <p class="privacy-note">選択内容はこの端末だけに保存します。ログインや個人情報の登録はありません。</p>
      <button id="install-app" class="install-button" type="button" hidden>この端末にアプリとして追加</button>
    </section>
    <section class="panel" aria-labelledby="timeline-title">
      <div class="section-heading section-heading--stack">
        <div><span class="step">2</span><h2 id="timeline-title">追加・削除する予定を選ぶ</h2></div>
        <p id="result-count" class="result-count"></p>
      </div>
      <div class="filters">
        <label>種類<select id="category-filter"><option value="all">すべて</option>${categoryOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label>この日以降<input id="date-filter" type="date" /></label>
      </div>
      <div class="timeline-toolbar"><button id="toggle-visible" class="text-button" type="button">表示中をすべて選択</button></div>
      <div id="timeline" class="timeline"></div>
      <div class="calendar-bar">
        <div><strong><span id="action-count">0</span>件をカレンダー操作</strong><span>ファイルを開き、カレンダー側で確定します</span></div>
        <div class="calendar-actions">
          <button id="add-calendar" class="primary-button" type="button">Googleカレンダーへ追加</button>
          <button id="remove-calendar" class="secondary-button" type="button">Googleカレンダーから削除</button>
        </div>
      </div>
      <p class="calendar-note">削除は、以前このアプリから追加した同じ予定を「取消」として渡します。カレンダーアプリによっては削除確認が表示されます。</p>
    </section>
  `;

  const schoolList = document.querySelector<HTMLElement>('#school-list')!;
  const schoolSearch = document.querySelector<HTMLInputElement>('#school-search')!;
  const prefectureSelect = document.querySelector<HTMLSelectElement>('#prefecture-filter')!;
  const municipalitySelect = document.querySelector<HTMLSelectElement>('#municipality-filter')!;
  const ownershipSelect = document.querySelector<HTMLSelectElement>('#ownership-filter')!;
  const genderSelect = document.querySelector<HTMLSelectElement>('#gender-filter')!;
  const scheduleSelect = document.querySelector<HTMLSelectElement>('#schedule-filter')!;
  const selectedSchoolList = document.querySelector<HTMLElement>('#selected-school-list')!;
  const selectedSchoolCount = document.querySelector<HTMLElement>('#selected-school-count')!;
  const mockList = document.querySelector<HTMLElement>('#mock-list')!;
  const sourceCount = document.querySelector<HTMLElement>('#source-count')!;
  const timeline = document.querySelector<HTMLElement>('#timeline')!;
  const resultCount = document.querySelector<HTMLElement>('#result-count')!;
  const categoryFilter = document.querySelector<HTMLSelectElement>('#category-filter')!;
  const dateFilter = document.querySelector<HTMLInputElement>('#date-filter')!;
  const toggleVisible = document.querySelector<HTMLButtonElement>('#toggle-visible')!;
  const actionCount = document.querySelector<HTMLElement>('#action-count')!;
  const addButton = document.querySelector<HTMLButtonElement>('#add-calendar')!;
  const removeButton = document.querySelector<HTMLButtonElement>('#remove-calendar')!;
  const installButton = document.querySelector<HTMLButtonElement>('#install-app')!;

  const filteredEvents = (): TimelineEvent[] => allEvents.filter((event) =>
    selectedSources.has(event.source_key)
    && (selectedCategory === 'all' || event.category === selectedCategory)
    && (!fromDate || event.starts_at.slice(0, 10) >= fromDate));

  const actionEvents = (): TimelineEvent[] => filteredEvents().filter((event) => selectedEvents.has(event.id));

  const visibleSchoolSources = (): SourceOption[] => schoolSources.filter((source) =>
      matchesSchoolSearch({
        name: source.name,
        name_reading: source.name_reading,
        aliases: source.aliases,
      }, schoolQuery)
      && (prefectureFilter === 'all' || source.prefecture === prefectureFilter)
      && (municipalityFilter === 'all' || source.municipality === municipalityFilter)
      && (ownershipFilter === 'all' || source.ownership === ownershipFilter)
      && (genderFilter === 'all' || source.gender === genderFilter)
      && (scheduleFilter === 'all'
        || (scheduleFilter === 'has-events' && (source.verified_event_count ?? 0) > 0)
        || (scheduleFilter === 'awaiting' && (source.verified_event_count ?? 0) === 0)));

  const renderChoiceList = (kind: SourceKind, container: HTMLElement): void => {
    const visibleSources = kind === 'school' ? visibleSchoolSources() : sources.filter((source) => source.kind === kind);
    container.innerHTML = visibleSources.length
      ? visibleSources.map((source) => `
        <label class="source-choice ${selectedSources.has(source.key) ? 'is-selected' : ''}">
          <input type="checkbox" value="${source.key}" ${selectedSources.has(source.key) ? 'checked' : ''} />
          <span class="checkmark" aria-hidden="true">✓</span><span><strong>${escapeHtml(source.name)}</strong>${source.kind === 'school' ? `<small>${escapeHtml([source.prefecture, source.municipality, source.gender, source.ownership].filter(Boolean).join('・') || '属性確認中')} ／ ${(source.verified_event_count ?? 0) > 0 ? `確認済み日程 ${source.verified_event_count}件` : '公式発表待ち'}</small>` : ''}</span>
        </label>
      `).join('')
      : '<div class="choice-empty">該当する学校がありません。別の学校名で検索してください。</div>';
  };

  const renderSources = (): void => {
    renderChoiceList('school', schoolList);
    renderChoiceList('mock_exam', mockList);
    sourceCount.textContent = `${selectedSources.size}件選択中`;
    const selectedSchools = schoolSources.filter((source) => selectedSources.has(source.key));
    selectedSchoolCount.textContent = `${selectedSchools.length}校`;
    selectedSchoolList.innerHTML = selectedSchools.length
      ? selectedSchools.map((source) => `<button type="button" data-source-key="${source.key}">${escapeHtml(source.name)}<span aria-hidden="true">×</span></button>`).join('')
      : '<span class="selected-school-empty">まだ学校を選択していません。</span>';
    document.querySelectorAll<HTMLButtonElement>('.source-toggle').forEach((button) => {
      const kind = button.dataset.kind as SourceKind;
      const kindSources = kind === 'school' ? visibleSchoolSources() : sources.filter((source) => source.kind === kind);
      button.textContent = kindSources.length > 0 && kindSources.every((source) => selectedSources.has(source.key)) ? 'すべて解除' : 'すべて選択';
    });
  };

  const renderTimeline = (): void => {
    const events = filteredEvents();
    const chosen = actionEvents();
    resultCount.textContent = `${events.length}件の確認済み日程`;
    actionCount.textContent = String(chosen.length);
    addButton.disabled = chosen.length === 0;
    removeButton.disabled = chosen.length === 0;
    toggleVisible.disabled = events.length === 0;
    toggleVisible.textContent = events.length > 0 && events.every((event) => selectedEvents.has(event.id)) ? '表示中をすべて解除' : '表示中をすべて選択';
    if (!events.length) {
      timeline.innerHTML = selectedSources.size === 0
        ? '<div class="empty-state"><strong>まず学校か模試を選んでください。</strong><span>選んだものの日程だけを表示します。</span></div>'
        : '<div class="empty-state">条件に合う確認済みの日程はありません。</div>';
      return;
    }
    timeline.innerHTML = events.map((event) => {
      const stateClass = event.change_type ? `event--${event.change_type}` : '';
      const stateLabel = event.change_type === 'changed' ? '<span class="change-badge">変更あり</span>' : event.change_type === 'cancelled' ? '<span class="change-badge change-badge--cancelled">中止</span>' : '';
      const formatted = formatDate(event.starts_at);
      return `<article class="event ${stateClass} ${selectedEvents.has(event.id) ? 'is-calendar-selected' : ''}">
        <time datetime="${escapeHtml(event.starts_at)}"><strong>${formatted.split('(')[0]}</strong><span>${formatted.match(/\((.)\)/)?.[1] ?? ''}</span></time>
        <div class="event__body">
          <div class="event__meta"><span class="category category--${event.category}">${categoryLabels[event.category]}</span>${stateLabel}<span class="year-badge">${event.admission_year}年度入学向け</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          <p class="school-name">${escapeHtml(event.owner_name)}</p>
          <label class="event-picker"><input type="checkbox" value="${escapeHtml(event.id)}" ${selectedEvents.has(event.id) ? 'checked' : ''} /><span>${selectedEvents.has(event.id) ? '追加・削除の対象' : 'カレンダー対象にする'}</span></label>
          <a class="source-link" href="${escapeHtml(event.source_url)}" target="_blank" rel="noreferrer">公式情報を確認 <span aria-hidden="true">↗</span></a>
          <p class="verified">最終確認 ${formatVerified(event.verified_at)}</p>
        </div>
      </article>`;
    }).join('');
  };

  const setSource = (key: string, checked: boolean): void => {
    if (checked) {
      selectedSources.add(key);
      allEvents.filter((event) => event.source_key === key).forEach((event) => selectedEvents.add(event.id));
    } else {
      selectedSources.delete(key);
      allEvents.filter((event) => event.source_key === key).forEach((event) => selectedEvents.delete(event.id));
    }
  };

  schoolSearch.addEventListener('input', () => {
    schoolQuery = schoolSearch.value;
    renderSources();
  });
  for (const select of [prefectureSelect, municipalitySelect, ownershipSelect, genderSelect, scheduleSelect]) {
    select.addEventListener('change', () => {
      prefectureFilter = prefectureSelect.value;
      municipalityFilter = municipalitySelect.value;
      ownershipFilter = ownershipSelect.value;
      genderFilter = genderSelect.value;
      scheduleFilter = scheduleSelect.value;
      renderSources();
    });
  }
  selectedSchoolList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-source-key]');
    if (!button) return;
    setSource(button.dataset.sourceKey!, false);
    saveSet(sourceSelectionKey, selectedSources);
    saveSet(eventSelectionKey, selectedEvents);
    renderSources();
    renderTimeline();
  });

  for (const list of [schoolList, mockList]) list.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.type !== 'checkbox') return;
    setSource(input.value, input.checked);
    saveSet(sourceSelectionKey, selectedSources);
    saveSet(eventSelectionKey, selectedEvents);
    renderSources();
    renderTimeline();
  });

  document.querySelectorAll<HTMLButtonElement>('.source-toggle').forEach((button) => button.addEventListener('click', () => {
    const kind = button.dataset.kind as SourceKind;
    const kindSources = kind === 'school' ? visibleSchoolSources() : sources.filter((source) => source.kind === kind);
    const select = !kindSources.every((source) => selectedSources.has(source.key));
    kindSources.forEach((source) => setSource(source.key, select));
    saveSet(sourceSelectionKey, selectedSources);
    saveSet(eventSelectionKey, selectedEvents);
    renderSources();
    renderTimeline();
  }));

  timeline.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.type !== 'checkbox') return;
    if (input.checked) selectedEvents.add(input.value); else selectedEvents.delete(input.value);
    saveSet(eventSelectionKey, selectedEvents);
    renderTimeline();
  });
  categoryFilter.addEventListener('change', () => { selectedCategory = categoryFilter.value as TimelineCategory | 'all'; renderTimeline(); });
  dateFilter.addEventListener('change', () => { fromDate = dateFilter.value; renderTimeline(); });
  toggleVisible.addEventListener('click', () => {
    const events = filteredEvents();
    const select = !events.every((event) => selectedEvents.has(event.id));
    events.forEach((event) => select ? selectedEvents.add(event.id) : selectedEvents.delete(event.id));
    saveSet(eventSelectionKey, selectedEvents);
    renderTimeline();
  });
  addButton.addEventListener('click', () => downloadIcs(generateCalendarIcs(actionEvents()), 'juken-calendar-add.ics'));
  removeButton.addEventListener('click', () => downloadIcs(generateCalendarIcs(actionEvents(), 'cancel'), 'juken-calendar-remove.ics'));

  let installPrompt: Event & { prompt: () => Promise<void> } | null = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as Event & { prompt: () => Promise<void> };
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    await installPrompt?.prompt();
    installButton.hidden = true;
  });

  renderSources();
  renderTimeline();
}

start().catch((error: unknown) => {
  app.innerHTML = `<div class="error-state"><h2>読み込みに失敗しました</h2><p>${escapeHtml(error instanceof Error ? error.message : '不明なエラー')}</p></div>`;
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
