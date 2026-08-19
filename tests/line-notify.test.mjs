import { describe, expect, it, vi } from 'vitest';
import {
  buildIssueMessage, buildPayload, classifyTitle, isAuthorized, redactSecrets,
  requireSecrets, sendLineMessage, truncateUnicode,
} from '../scripts/line-notify.mjs';

describe('LINE governance notification', () => {
  it('classifies only approved prefixes', () => {
    expect(classifyTitle('[稟議] 有料化')).toBe('稟議');
    expect(classifyTitle('[重大通知] 障害')).toBe('重大通知');
    expect(classifyTitle('[経営報告] 進捗')).toBe('経営報告');
    expect(classifyTitle('通常作業')).toBeNull();
  });

  it('requires both trusted actor and issue author and excludes PRs', () => {
    expect(isAuthorized({ actor: 'jun1004-o', issueAuthor: 'jun1004-o' })).toBe(true);
    expect(isAuthorized({ actor: 'attacker', issueAuthor: 'jun1004-o' })).toBe(false);
    expect(isAuthorized({ actor: 'jun1004-o', issueAuthor: 'jun1004-o', isPullRequest: true })).toBe(false);
  });

  it('JSON-encodes attacker-controlled text safely', () => {
    const payload = buildPayload('U123', 'hello"}\n${{ secrets.TOKEN }}');
    expect(JSON.parse(payload)).toEqual({ to: 'U123', messages: [{ type: 'text', text: 'hello"}\n${{ secrets.TOKEN }}' }] });
  });

  it('truncates by Unicode code point without splitting surrogate pairs', () => {
    expect(truncateUnicode('😀😀😀😀', 3)).toBe('😀😀…');
  });

  it('redacts obvious secrets from outgoing text', () => {
    expect(redactSecrets('access_token=abcdefghijklmnopqrstuvwxyz1234567890ABCDE')).not.toContain('abcdefghijklmnopqrstuvwxyz');
    const message = buildIssueMessage({
      repository: 'jun1004-o/juken-calendar',
      issue: { title: '[重大通知] test', body: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890TOKEN', html_url: 'https://github.com/test/1' },
    });
    expect(message).toContain('[REDACTED]');
  });

  it('fails closed when either secret is missing', () => {
    expect(() => requireSecrets({ LINE_USER_ID: 'U123' })).toThrow(/not configured/);
    expect(() => requireSecrets({ LINE_CHANNEL_ACCESS_TOKEN: 'token' })).toThrow(/not configured/);
  });

  it('sends a safely encoded JSON request without logging secrets', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await sendLineMessage({ token: 'secret-token', userId: 'U123', text: 'hello', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0];
    expect(request.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(request.body).messages[0].text).toBe('hello');
  });
});
