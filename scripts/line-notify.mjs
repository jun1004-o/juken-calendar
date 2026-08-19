import { readFile } from 'node:fs/promises';

export const OWNER = 'jun1004-o';
export const PREFIXES = ['[稟議]', '[重大通知]', '[経営報告]'];
const LINE_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const MAX_TEXT_LENGTH = 4500;

export function classifyTitle(title) {
  const matches = PREFIXES.filter((prefix) => title.startsWith(prefix));
  return matches.length === 1 ? matches[0].slice(1, -1) : null;
}

export function isAuthorized({ actor, issueAuthor, isPullRequest = false }) {
  return actor === OWNER && issueAuthor === OWNER && !isPullRequest;
}

export function redactSecrets(value) {
  return value
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/((?:access[_ -]?token|api[_ -]?key|secret|password)\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[REDACTED]');
}

export function truncateUnicode(value, maximum = MAX_TEXT_LENGTH) {
  const characters = Array.from(value);
  if (characters.length <= maximum) return value;
  return `${characters.slice(0, maximum - 1).join('')}…`;
}

export function summarizeBody(body, maximum = 900) {
  const clean = redactSecrets(body ?? '')
    .replace(/```[\s\S]*?```/g, '[code omitted]')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateUnicode(clean || '本文なし', maximum);
}

export function buildIssueMessage({ issue, repository }) {
  const notificationClass = classifyTitle(issue.title);
  if (!notificationClass) throw new Error('Issue title does not have an allowed notification prefix.');
  return truncateUnicode([
    `【${notificationClass}】`,
    redactSecrets(issue.title),
    '',
    summarizeBody(issue.body),
    '',
    repository,
    issue.html_url,
  ].join('\n'));
}

export function buildPayload(to, text) {
  return JSON.stringify({ to, messages: [{ type: 'text', text }] });
}

export function requireSecrets(env) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = env.LINE_USER_ID;
  if (!token || !userId) throw new Error('Required LINE notification secrets are not configured.');
  return { token, userId };
}

export async function sendLineMessage({ token, userId, text, fetchImpl = fetch }) {
  const response = await fetchImpl(LINE_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: buildPayload(userId, text),
  });
  if (!response.ok) throw new Error(`LINE Messaging API request failed with status ${response.status}.`);
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const actor = process.env.GITHUB_ACTOR;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!eventName || !actor || !repository) throw new Error('Required GitHub context is missing.');

  const secrets = requireSecrets(process.env);
  let text;
  if (eventName === 'workflow_dispatch') {
    if (actor !== OWNER) throw new Error('Manual connectivity test is restricted to the repository owner.');
    text = `【接続テスト】\n中学受験AI会社からLINE通知を送信できました。\n${repository}`;
  } else if (eventName === 'issues') {
    if (!process.env.GITHUB_EVENT_PATH) throw new Error('GitHub event payload path is missing.');
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    if (event.action !== 'opened') throw new Error('Only newly opened issues can trigger notifications.');
    if (!isAuthorized({ actor, issueAuthor: event.issue?.user?.login, isPullRequest: Boolean(event.issue?.pull_request) })) {
      throw new Error('Notification event is not authorized.');
    }
    text = buildIssueMessage({ issue: event.issue, repository });
  } else {
    throw new Error(`Unsupported GitHub event: ${eventName}`);
  }

  await sendLineMessage({ ...secrets, text });
  console.log('LINE notification sent successfully.');
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'LINE notification failed.');
  process.exitCode = 1;
});
