import { preview } from 'vite';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

// Test fixture runs the actual Java controllers, embedded engine, rooms and H2 ladder.
// Its test-only users are never sent to any production address.
const javaBase = process.env.DRONE_JAVA_TEST_BASE;
if (!javaBase) throw new Error('Set DRONE_JAVA_TEST_BASE to the isolated Java DroneRaceBrowserFixture URL');
const fixtureURL = new URL(javaBase);
assert.ok(fixtureURL.protocol === 'http:' && ['127.0.0.1','localhost'].includes(fixtureURL.hostname), 'Only a loopback Java test fixture is allowed');
const fixtureTokens = (process.env.DRONE_JAVA_TEST_TOKENS || 'fixture-1,fixture-2,fixture-3,fixture-4').split(',');
let previewServer, browser;
const java = async (pathname, userId = 1, payload) => {
  const response = await fetch(javaBase.replace(/\/$/, '') + pathname, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + fixtureTokens[userId-1] },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const body = await response.json();
  if (!response.ok || body.success === false) throw Error(body.message?.zh || body.error || 'Java request failed');
  return body.data ?? body;
};
const race = (payload, userId = 1) => java('/api/drone-race', userId, payload);
try {
  assert.equal((await (await fetch(javaBase.replace(/\/$/, '') + '/__fixture__/health')).json()).fixture, true, 'Real isolated Java fixture is required');
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 17817, strictPort: true } });
  browser = await chromium.launch({ headless: true });
  const errors = [], failures = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: '{"success":true,"data":null}' }));
  await context.route('https://map.qq.com/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  const page = await context.newPage();
  page.on('pageerror', error => { console.error('Browser error:', error.stack); errors.push(error.message); });
  page.on('response', response => { if (response.status() >= 400) failures.push(response.status() + ' ' + response.url()); });
  const base = 'http://127.0.0.1:17817';
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.products > article').first().getAttribute('id'), 'mini');
  assert.equal(await page.getByRole('link', { name: '苏ICP备2025183953号-2' }).getAttribute('href'), 'https://beian.miit.gov.cn/');
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'homepage overflow ' + width); }
  await page.locator('.game-play').click();
  await page.locator('.generate-button').waitFor();
  await page.reload();
  assert.equal(await page.getByRole('button', { name: /排位|好友|多人/ }).count(), 0);
  assert.equal((await page.locator('body').innerText()).includes('单人'), false);
  assert.equal(await page.locator('.all-aircraft-button').count(), 0, 'web keeps its inline carousel');
  assert.match(await page.locator('.lab-main > .hangar-arc .arc-navigation').innerText(), /277/);
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'game overflow ' + width); }
  await page.getByRole('button', { name: '清空画布', exact: true }).click();
  assert.equal(await page.locator('.generate-button').isDisabled(), true);
  await page.getByRole('button', { name: '下一款机型', exact: true }).click();
  await page.locator('.generate-button').click();
  await page.waitForFunction(() => !document.querySelector('.solo-button').disabled);
  await page.screenshot({ path: path.join(tmpdir(), 'drone-v21-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '开始飞行', exact: true }).click();
  await page.locator('.race-screen').waitFor();
  await page.keyboard.press('v');
  assert.equal(await page.locator('.camera-toggle').getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '返回机库', exact: true }).click();
  await page.getByRole('button', { name: '结束飞行，返回机库', exact: true }).click();

  const manifest = JSON.parse(await readFile('.game-build/resource-packages/mobile-manifest.json', 'utf8'));
  assert.equal(manifest.apiContract, 'java-jwt-v1', 'offline updates must match the existing Java JWT API');
  const zip = await JSZip.loadAsync(await readFile('.game-build/resource-packages/' + manifest.url));
  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const inputs = [];
  let delayMatch = false, startRequests = 0, matchRequests = 0, cancelledLeaves = 0;
  await mobile.exposeFunction('testNative', async raw => {
    const { id, action, payload } = JSON.parse(raw);
    try {
      let data;
      if (action === 'race') {
        if (payload.input) inputs.push(payload.input);
        if (payload.action === 'start') startRequests++;
        if (payload.action === 'match') matchRequests++;
        data = await race(payload);
        if (payload.action === 'leave' && delayMatch) cancelledLeaves++;
        if (payload.action === 'match' && delayMatch) await new Promise(resolve => setTimeout(resolve, 450));
      }
      else if (action === 'leaderboard') data = await java('/api/drone-game/leaderboard?page=0&size=50');
      else if (action === 'myRank') data = await java('/api/drone-game/my-rank');
      return { id, data };
    } catch (error) { return { id, error: error.message }; }
  });
  await mobile.addInitScript(() => { window.DroneGameNative = { postMessage: raw => window.testNative(raw).then(reply => window.__droneGameNativeReply(reply)) }; });
  await mobile.route('**/*', async route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, 'https://drone-game.planet.local', 'offline game must use bundled assets');
    const file = zip.file(decodeURIComponent(url.pathname).replace(/^\//, ''));
    if (!file) { failures.push('missing offline asset ' + url.pathname); await route.fulfill({ status: 404, body: '' }); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg' }[path.extname(url.pathname)] || 'application/octet-stream';
    await route.fulfill({ contentType: type, body: await file.async('nodebuffer') });
  });
  const native = await mobile.newPage();
  native.on('pageerror', error => { console.error('Browser error:', error.stack); errors.push(error.message); });
  await native.goto('https://drone-game.planet.local/index.html');
  await native.getByRole('button', { name: '天梯榜', exact: true }).click();
  await native.locator('.ladder-mine').waitFor();
  await native.locator('.game-dialog[open] .game-dialog-close').click();
  await native.locator('.all-aircraft-button').tap();
  await native.locator('.hangar-dialog .arc-card[data-front="true"]').tap();
  await native.locator('.hangar-dialog .game-dialog-close').tap();
  await native.locator('.generate-button').tap();
  await native.waitForFunction(() => !document.querySelector('.solo-button').disabled);
  await native.locator('.solo-button').tap();
  await native.locator('.race-screen').waitFor();
  assert.equal(startRequests, 1, 'Android free flight creates the same Java challenge room as the mini program');
  await native.getByText('自由飞行 · 天梯', { exact: true }).waitFor();
  await native.getByRole('button', { name: '返回机库', exact: true }).tap();
  const leaveChallenge = native.getByRole('button', { name: '结束飞行，返回机库', exact: true });
  if (await leaveChallenge.isVisible()) await leaveChallenge.tap();
  await native.locator('.generate-button').waitFor();
  delayMatch = true;
  await native.locator('.race-button').tap();
  await native.getByRole('button', { name: '开始匹配', exact: true }).tap();
  const matchingDeadline = Date.now() + 5000;
  while (!matchRequests && Date.now() < matchingDeadline) await native.waitForTimeout(20);
  assert.ok(matchRequests, 'native game starts a Java match request');
  await native.locator('.game-dialog[open] .game-dialog-close').tap();
  const cancellationDeadline = Date.now() + 10000;
  while (!cancelledLeaves && Date.now() < cancellationDeadline) await native.waitForTimeout(50);
  assert.equal(cancelledLeaves, 1, 'cancelled matching frees a late server seat');
  assert.equal(await native.locator('.game-dialog[open]').count(), 0);
  delayMatch = false;
  await native.locator('.race-button').tap();
  await native.getByRole('button', { name: '开始匹配', exact: true }).tap();
  await native.getByText('1 / 4', { exact: true }).waitFor();
  assert.equal(await native.locator('.room-dialog').getByRole('textbox').count(), 0, 'no invitation input');
  const bots = [];
  for (const id of [2, 3, 4]) bots.push(await race({ action: 'match', catalogId: 'camera-2', courseId: 'valley' }, id));
  await native.locator('.race-screen').waitFor();
  assert.equal(await native.locator('.live-rank > div').count(), 4);
  await native.locator('.flight-stick').waitFor({ state: 'visible' });
  const stick = native.locator('.flight-stick');
  const box = await stick.boundingBox();
  await native.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await native.mouse.down();
  await native.mouse.move(box.x + box.width/2 + 25, box.y + box.height/2 - 12, { steps: 3 });
  await native.waitForTimeout(450);
  assert.ok(inputs.some(input => input.steer > .1 && input.lift > .1), 'joystick sends analog axes');
  await native.mouse.up();
  await native.waitForTimeout(400);
  assert.equal(inputs.at(-1).steer, 0); assert.equal(inputs.at(-1).lift, 0);
  await native.getByRole('button', { name: '加速', exact: true }).tap();
  await native.waitForTimeout(150);
  assert.ok(inputs.some(input => input.boost));
  for (const width of [667, 844, 1024]) { await native.setViewportSize({ width, height: 390 }); assert.equal(await native.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'native race overflow ' + width); }
  await native.setViewportSize({ width: 844, height: 390 });
  await native.screenshot({ path: path.join(tmpdir(), 'drone-v21-mobile-race.png'), fullPage: true });
  await native.setViewportSize({ width: 844, height: 390 });
  await native.locator('.flight-stick').waitFor({ state: 'visible' });
  assert.equal(await native.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, 'landscape race fits screen');
  assert.equal(await native.locator('.flight-stick').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight), true, 'landscape joystick stays on screen');
  await native.screenshot({ path: path.join(tmpdir(), 'drone-v21-landscape-race.png'), fullPage: true });
  await native.setViewportSize({ width: 844, height: 390 });
  await native.getByRole('button', { name: '返回机库', exact: true }).tap();
  const exit = native.getByRole('button', { name: '结束飞行，返回机库', exact: true });
  if (await exit.isVisible()) await exit.tap();
  await native.locator('.generate-button').waitFor();
  await native.screenshot({ path: path.join(tmpdir(), 'drone-v21-mobile.png'), fullPage: true });
  await page.goto(base + '/admin/login');
  await page.locator('#app').waitFor();
  const settlementDeadline = Date.now() + 30000;
  let board;
  do { board = await java('/api/drone-game/leaderboard?page=0&size=50'); if (board.items?.length >= 4) break; await new Promise(resolve => setTimeout(resolve, 500)); } while (Date.now() < settlementDeadline);
  assert.ok(board.items?.length >= 4, 'Java full-room result must persist four pilots to ladder');
  const mine = await java('/api/drone-game/my-rank');
  assert.ok(mine.entry?.races >= 1, 'Java personal ladder includes completed match');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  console.log('PASS: homepage/admin routes, ICP, V21 web-only start, 277 models, mobile layouts, fully local native ZIP, Android free-flight Java challenge and ladder path, persisted ladder, four-pilot auto-start, match cancellation, portrait/landscape analog/reset/boost controls');
} finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(resolve => previewServer.httpServer.close(resolve));
}

