import { preview } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Guard the shared React entry: native workbench styles must not affect the website.
const server = await preview({ build: { outDir: '.game-build/mobile' }, preview: { host: '127.0.0.1', port: 17819, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:17819/games/drone-race/');
  await page.locator('.web-game .generate-button').waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.all-aircraft-button').count(), 0);
    assert.equal(await page.locator('.landscape-hint').count(), 0);
    assert.ok(await page.locator('.flight-panel .stats').isVisible());
    assert.ok(await page.locator('.lab-main > .hangar-arc').isVisible());
    const sketch = await page.locator('.sketch-section').boundingBox();
    const result = await page.locator('.result-section').boundingBox();
    if (width <= 390) assert.ok(result.y >= sketch.y + sketch.height - 1, 'portrait web stacks its panels');
    if (width === 1440) assert.ok(result.x >= sketch.x + sketch.width, 'desktop web has two columns');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'web overflow at ' + width);
    await page.getByRole('button', { name: '下一款机型', exact: true }).click();
    assert.ok(await page.locator('.solo-button').isDisabled(), 'web model selection still requires generation');
    await page.locator('.generate-button').click();
    await page.waitForFunction(() => !document.querySelector('.solo-button').disabled);
  }
  await page.getByRole('button', { name: '开始飞行', exact: true }).click();
  await page.locator('.race-screen').waitFor();
  assert.equal(await page.locator('.flight-stick').count(), 0, 'web keeps its original flight controls');
  assert.equal(await page.locator('.controls-swap').count(), 0);
  await page.setViewportSize({ width: 390, height: 900 });
  assert.ok(await page.locator('.touch-controls').isVisible(), 'web portrait touch controls remain available');
  assert.equal(await page.locator('.touch-controls button').count(), 6);

  const native = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  native.on('pageerror', error => errors.push(error.message));
  await native.addInitScript(() => { window.DroneGameNative = { postMessage() {} }; });
  await native.goto('http://127.0.0.1:17819/games/drone-race/');
  await native.locator('.native-game .generate-button').waitFor();
  const sketch = await native.locator('.sketch-section').boundingBox();
  const result = await native.locator('.result-section').boundingBox();
  assert.ok(result.x >= sketch.x + sketch.width, 'native keeps the landscape workbench');
  assert.ok(sketch.height > 150 && result.height > 150, 'native viewport keeps usable canvases');
  assert.ok(sketch.y + sketch.height <= 390 && result.y + result.height <= 390);
  assert.equal(await native.locator('.sketch-modes').count(), 0, 'native uses free-outline generation without a mode switch');
  assert.equal((await native.locator('.panel-heading').textContent()).trim(), '', 'native removes the drawing title');
  assert.equal(await native.locator('.paper-empty strong').textContent(), '请在稿纸上绘制');
  const paper = await native.locator('.sketch-paper').boundingBox();
  assert.ok(Math.abs(paper.width - paper.height) < 1, 'native drawing paper stays square');
  assert.deepEqual(await native.locator('.sketch-actions button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label') || node.textContent.trim())), ['生成无人机', '撤销一笔', '清空画布']);
  const sketchActions = await native.locator('.sketch-actions').boundingBox();
  assert.ok(sketchActions.y >= paper.y + paper.height, 'native generate, undo and erase actions stay below the drawing paper');
  assert.equal(await native.locator('.flight-panel .stats').isVisible(), true, 'native keeps the aircraft performance panel');
  assert.equal(await native.locator('.header-actions .match-button').count(), 0, 'multiplayer race action is removed');
  assert.equal(await native.locator('.course-picker label').isVisible(), true, 'native keeps the course label');
  assert.equal(await native.locator('.lab-main > .hangar-arc').count(), 0);
  await native.getByRole('button', { name: /所有机型/ }).click();
  await native.locator('.hangar-dialog[open] .hangar-arc').waitFor();
  await native.getByRole('button', { name: '下一款机型', exact: true }).click();
  await native.locator('.hangar-dialog .game-dialog-close').click();
  assert.equal(await native.locator('.solo-button').isDisabled(), false, 'native selection is ready to fly');
  await native.evaluate(() => {
    const fixture = document.createElement('div');
    fixture.className = 'native-race';
    fixture.style.cssText = 'position:fixed;inset:0;z-index:999;background:#123';
    fixture.innerHTML = '<div class="race-top"><div class="sound-controls"><button>音</button><button>设置</button></div><div class="track-name"><strong>翡翠山谷</strong></div><div class="race-time">0.00<small>秒</small></div></div>';
    document.body.append(fixture);
  });
  const clock = await native.locator('.native-race .race-time').boundingBox(), track = await native.locator('.native-race .track-name').boundingBox();
  assert.ok(clock.y <= 12 && track.y <= 12, 'native clock and compact course card stay at the top');
  assert.ok(clock.x + clock.width < track.x, 'native clock does not overlap the compact course card');
  assert.equal((await native.locator('.native-race .track-name').innerText()).trim(), '翡翠山谷', 'native course card only contains the Chinese course name');
  assert.deepEqual(errors, []);
  console.log('Layout isolation passed: responsive web carousel and flight; native landscape workbench and modal carousel.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
