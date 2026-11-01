import { preview } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const server = await preview({ preview: { host: '127.0.0.1', port: 17821, strictPort: true } });
const browser = await chromium.launch({ headless: true });
const origin = 'http://127.0.0.1:17821';
const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const rows = [
  { rank: 1, playerId: 1, name: '会员飞手', member: true, avatarUrl: avatar, featureCode: 'VIP001', rating: 820, races: 10, completions: 8, gates: 90, bestFinishMs: 61000 },
  { rank: 2, playerId: 2, name: '普通飞手', member: false, avatarUrl: '/__avatar/missing', featureCode: 'USER02', rating: 120, races: 2, completions: 1, gates: 15 },
];
try {
  const game = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await game.route('**/__avatar/missing', route => route.fulfill({ status: 404, body: '' }));
  await game.addInitScript(({ rows }) => {
    window.DroneGameNative = { postMessage(raw) {
      const { id, action } = JSON.parse(raw);
      setTimeout(() => window.__droneGameNativeReply({ id, data: action === 'leaderboard' ? { season: '2026-09', items: rows } : { entry: rows[0] } }), 0);
    } };
  }, { rows });
  await game.goto(origin + '/games/drone-race/');
  await game.getByRole('button', { name: '天梯榜', exact: true }).click();
  await game.locator('.ladder-list li').nth(1).waitFor();
  await game.waitForFunction(() => document.querySelector('.ladder-avatar img')?.naturalWidth > 0);
  assert.equal(await game.locator('.ladder-avatar--vip').count(), 1);
  await game.waitForFunction(() => document.querySelectorAll('.ladder-avatar')[1]?.textContent === '普');
  assert.equal(await game.locator('.ladder-avatar--vip').evaluate(el => getComputedStyle(el).borderTopWidth), '2px');
  await game.screenshot({ path: '.game-build/ladder-avatars.png' });

  const admin = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const requests = [];
  await admin.addInitScript(() => localStorage.setItem('dikongkong_token', 'fixture-admin'));
  await admin.route('**/api/**', async route => {
    const url = new URL(route.request().url()); let data = {};
    if (url.pathname === '/api/files/download/member.png') return route.fulfill({ contentType: 'image/png', body: Buffer.from(avatar.split(',')[1], 'base64') });
    if (url.pathname === '/api/drone-game/admin/leaderboard') {
      assert.equal(route.request().headers().authorization, 'Bearer fixture-admin');
      requests.push(Object.fromEntries(url.searchParams));
      const page = Number(url.searchParams.get('page'));
      data = { season: url.searchParams.get('season') === 'current' ? '2026-09' : url.searchParams.get('season'), items: page ? [{ ...rows[1], name: '第二页飞手' }] : rows.map((row, i) => ({ ...row, avatarUrl: i ? '' : 'member.png' })), page, size: 20, totalElements: 21 };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await admin.goto(origin + '/admin/drone-leaderboard');
  await admin.locator('.drone-leaderboard').getByText('VIP001', { exact: true }).waitFor();
  assert.equal(await admin.locator('.drone-leaderboard .vip-avatar').count(), 1);
  await admin.waitForFunction(() => document.querySelector('.drone-leaderboard .vip-avatar img')?.naturalWidth > 0);
  assert.equal(requests[0].page, '0');
  await admin.locator('.ant-pagination-item-2').click();
  await admin.getByText('第二页飞手', { exact: true }).waitFor();
  assert.equal(requests.at(-1).page, '1');
  await admin.getByPlaceholder('当前赛季').click();
  await admin.locator('.ant-picker-cell[title="2026-08"]').click();
  await admin.waitForFunction(() => document.querySelector('.drone-leaderboard header p')?.textContent.includes('2026-08'));
  assert.equal(requests.at(-1).page, '0');
  await admin.locator('.drone-leaderboard h1').click();
  await admin.screenshot({ path: '.game-build/admin-drone-ladder.png' });
  console.log('Ladder UI passed: member ring, loaded avatar, broken-image fallback, authenticated admin page, pagination and season filter.');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
