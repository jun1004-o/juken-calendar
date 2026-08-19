import './style.css';
import { generateIcs } from './lib/ics';
import type { AdmissionEvent, EventCategory, School } from './types';

const app = document.querySelector<HTMLElement>('#app')!;
if (!app) throw new Error('Application root is missing.');

const categoryLabels: Record<EventCategory, string> = {
  briefing: '説明会',
  open_school: '公開・体験',
  festival: '文化祭',
  application: '出願',
  exam: '試験',
  result: '合格発表',
  enrollment: '入学手続',
  other: 'その他',
};

const categoryOptions = Object.entries(categoryLabels) as [EventCategory, string][];
const selectionKey = 'juken-calendar:selected-schools:v1';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
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

function loadSelection(schools: School[]): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(selectionKey) ?? '[]');
    if (Array.isArray(stored) && stored.length) return new Set(stored.filter((id): id is string => typeof id === 'string'));
  } catch {
    localStorage.removeItem(selectionKey);
  }
  return new Set(schools.map((school) => school.id));
}

function downloadIcs(content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'juken-calendar.ics';
  anchor.click();
  URL.revokeObjectURL(url);
}

async function start(): Promise<void> {
  const [schoolsResponse, eventsResponse] = await Promise.all([
    fetch('./data/schools.json'), fetch('./data/events.json'),
  ]);
  if (!schoolsResponse.ok || !eventsResponse.ok) throw new Error('日程データを取得できませんでした。');

  const schools = await schoolsResponse.json() as School[];
  const allEvents = (await eventsResponse.json() as AdmissionEvent[])
    .filter((event) => event.status === 'verified' && event.verified_at)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const selectedSchools = loadSelection(schools);
  let selectedCategory: EventCategory | 'all' = 'all';
  let fromDate = '';
  const schoolMap = new Map(schools.map((school) => [school.id, school]));

  app.innerHTML = `
    <section class="panel school-panel" aria-labelledby="school-title">
      <div class="section-heading">
        <div><span class="step">1</span><h2 id="school-title">志望校を選ぶ</h2></div>
        <button id="toggle-schools" class="text-button" type="button">すべて解除</button>
      </div>
      <div id="school-list" class="school-grid"></div>
      <p class="privacy-note">選択内容はこの端末だけに保存されます。ログインは不要です。</p>
    </section>
    <section class="panel" aria-labelledby="timeline-title">
      <div class="section-heading section-heading--stack">
        <div><span class="step">2</span><h2 id="timeline-title">日程を確認する</h2></div>
        <p id="result-count" class="result-count"></p>
      </div>
      <div class="filters">
        <label>種類<select id="category-filter"><option value="all">すべて</option>${categoryOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label>この日以降<input id="date-filter" type="date" /></label>
      </div>
      <div id="timeline" class="timeline"></div>
      <div class="calendar-bar">
        <div><strong>選んだ日程をカレンダーへ</strong><span>確認済みの日程だけを書き出します</span></div>
        <button id="export-ics" class="primary-button" type="button">カレンダーに追加</button>
      </div>
    </section>
  `;

  const schoolList = document.querySelector<HTMLElement>('#school-list');
  const timeline = document.querySelector<HTMLElement>('#timeline');
  const resultCount = document.querySelector<HTMLElement>('#result-count');
  const toggleSchools = document.querySelector<HTMLButtonElement>('#toggle-schools');
  const categoryFilter = document.querySelector<HTMLSelectElement>('#category-filter');
  const dateFilter = document.querySelector<HTMLInputElement>('#date-filter');
  const exportButton = document.querySelector<HTMLButtonElement>('#export-ics');
  if (!schoolList || !timeline || !resultCount || !toggleSchools || !categoryFilter || !dateFilter || !exportButton) return;

  const filteredEvents = (): AdmissionEvent[] => allEvents.filter((event) =>
    selectedSchools.has(event.school_id)
    && (selectedCategory === 'all' || event.category === selectedCategory)
    && (!fromDate || event.starts_at.slice(0, 10) >= fromDate));

  const renderSchools = (): void => {
    schoolList.innerHTML = schools.map((school) => `
      <label class="school-choice ${selectedSchools.has(school.id) ? 'is-selected' : ''}">
        <input type="checkbox" value="${school.id}" ${selectedSchools.has(school.id) ? 'checked' : ''} />
        <span class="checkmark" aria-hidden="true">✓</span><span>${escapeHtml(school.name)}</span>
      </label>
    `).join('');
    toggleSchools.textContent = selectedSchools.size === schools.length ? 'すべて解除' : 'すべて選択';
  };

  const renderTimeline = (): void => {
    const events = filteredEvents();
    resultCount.textContent = `${events.length}件の確認済み日程`;
    exportButton.disabled = events.length === 0;
    if (!events.length) {
      timeline.innerHTML = '<div class="empty-state">条件に合う確認済みの日程はありません。</div>';
      return;
    }
    timeline.innerHTML = events.map((event) => {
      const school = schoolMap.get(event.school_id);
      const stateClass = event.change_type ? `event--${event.change_type}` : '';
      const stateLabel = event.change_type === 'changed' ? '<span class="change-badge">変更あり</span>' : event.change_type === 'cancelled' ? '<span class="change-badge change-badge--cancelled">中止</span>' : '';
      return `<article class="event ${stateClass}">
        <time datetime="${escapeHtml(event.starts_at)}"><strong>${formatDate(event.starts_at).split('(')[0]}</strong><span>${formatDate(event.starts_at).match(/\((.)\)/)?.[1] ?? ''}</span></time>
        <div class="event__body">
          <div class="event__meta"><span class="category category--${event.category}">${categoryLabels[event.category]}</span>${stateLabel}</div>
          <h3>${escapeHtml(event.title)}</h3>
          <p class="school-name">${escapeHtml(school?.name ?? event.school_id)}</p>
          ${event.registration_closes_at ? `<p class="deadline">申込締切 ${formatDate(event.registration_closes_at)}</p>` : ''}
          <a class="source-link" href="${escapeHtml(event.source_url)}" target="_blank" rel="noreferrer">学校公式情報を確認 <span aria-hidden="true">↗</span></a>
          <p class="verified">最終確認 ${formatVerified(event.verified_at)}</p>
        </div>
      </article>`;
    }).join('');
  };

  schoolList.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.type !== 'checkbox') return;
    if (input.checked) selectedSchools.add(input.value); else selectedSchools.delete(input.value);
    localStorage.setItem(selectionKey, JSON.stringify([...selectedSchools]));
    renderSchools(); renderTimeline();
  });
  toggleSchools.addEventListener('click', () => {
    if (selectedSchools.size === schools.length) selectedSchools.clear(); else schools.forEach((school) => selectedSchools.add(school.id));
    localStorage.setItem(selectionKey, JSON.stringify([...selectedSchools]));
    renderSchools(); renderTimeline();
  });
  categoryFilter.addEventListener('change', () => { selectedCategory = categoryFilter.value as EventCategory | 'all'; renderTimeline(); });
  dateFilter.addEventListener('change', () => { fromDate = dateFilter.value; renderTimeline(); });
  exportButton.addEventListener('click', () => downloadIcs(generateIcs(filteredEvents(), schools)));

  renderSchools(); renderTimeline();
}

start().catch((error: unknown) => {
  app.innerHTML = `<div class="error-state"><h2>読み込みに失敗しました</h2><p>${escapeHtml(error instanceof Error ? error.message : '不明なエラー')}</p></div>`;
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
