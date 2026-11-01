const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5193';
const out = path.resolve(process.env.ADMIN_CHECK_OUTPUT || 'build/checks/admin-appearance');
fs.mkdirSync(out, { recursive: true });
const skins = [['lime-night','青柠夜航','#d6ff62'],['ocean-blue','深海蓝','#85c8ff'],['twilight-purple','暮光紫','#ceb0ff'],['sand-gold','暖砂金','#efc67f'],['ink-white','墨白','#ffffff']];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const saved = new Map([['account-a', 'lime-night'], ['account-b', 'ocean-blue']]);
  const errors = [], writes = [];
  let failSave = false, failRead = false;
  async function contextFor(token) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(value => { if (!localStorage.getItem('dikongkong_token')) localStorage.setItem('dikongkong_token', value); }, token);
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const account = req.headers().authorization?.replace('Bearer ', '');
      let data = { content: [], records: [], items: [], rows: [], list: [], totalElements: 0, total: 0, config: {}, releases: [] };
      if (url.pathname === '/api/auth/profile') data = { username: account, email: 'admin@example.com' };
      if (url.pathname === '/api/auth/appearance') {
        if (req.method() === 'PUT') {
          const payload = req.postDataJSON(); writes.push({ account, ...payload });
          assert.deepEqual(Object.keys(payload), ['skin']);
          if (failSave) return route.fulfill({ status: 500, json: { success: false, message: { zh: '测试保存失败' } } });
          saved.set(account, payload.skin);
        } else if (failRead) return route.fulfill({ status: 503, json: { success: false } });
        data = { skin: saved.get(account) || 'lime-night' };
      }
      return route.fulfill({ json: { success: true, data } });
    });
    return context;
  }
  async function openSettings(context) {
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/admin/settings');
    await page.getByRole('radio', { name: '青柠夜航', exact: true }).waitFor();
    return page;
  }
  async function assertSkin(page, id) {
    await page.waitForFunction(value => document.documentElement.dataset.adminSkin === value, id);
  }
  try {
    const context = await contextFor('account-a');
    const page = await openSettings(context);
    for (const [id, name, accent] of skins) {
      await page.getByRole('radio', { name, exact: true }).check();
      if (id !== 'lime-night') await page.getByRole('button', { name: '保存皮肤', exact: true }).click();
      await assertSkin(page, id);
      const accentRgb = 'rgb(' + accent.slice(1).match(/../g).map(v => parseInt(v, 16)).join(', ') + ')';
      await page.waitForFunction(rgb => getComputedStyle(document.querySelector('.ant-tabs-tab-active .ant-tabs-tab-btn')).color === rgb, accentRgb);
      assert.equal((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--admin-lime'))).trim(), accent);
      assert.equal(saved.get('account-a'), id);
      // Inspect an enabled primary button after the new tokens have settled.
      await page.getByRole('radio', { name: id === 'lime-night' ? '深海蓝' : '青柠夜航', exact: true }).check();
      const primary = page.getByRole('button', { name: '保存皮肤', exact: true });
      await page.waitForFunction(rgb => getComputedStyle(document.querySelector('.appearance-actions .ant-btn-primary')).backgroundColor === rgb, accentRgb);
      const contrast = await primary.evaluate(e => {
        const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(n => Number(n) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const css = getComputedStyle(e), a = luminance(css.color), b = luminance(css.backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      });
      assert.ok(contrast >= 4.5, `${id}: primary contrast ${contrast}`);
      await page.getByRole('radio', { name, exact: true }).check();
      await page.locator('.ant-message-notice').last().waitFor({ state: 'hidden' });
      await page.screenshot({ path: path.join(out, `${id}-desktop.png`), fullPage: true });
    }
    await page.reload(); await assertSkin(page, 'ink-white');
    await page.getByRole('radio', { name: '深海蓝', exact: true }).check();
    failSave = true;
    await page.getByRole('button', { name: '保存皮肤', exact: true }).click();
    await page.getByText('测试保存失败', { exact: true }).waitFor();
    await assertSkin(page, 'ink-white');
    assert.equal(saved.get('account-a'), 'ink-white');
    assert.equal(await page.evaluate(() => localStorage.getItem('dikongkong_admin_appearance')), 'ink-white');
    failSave = false;
    await page.getByRole('radio', { name: '墨白', exact: true }).check();
    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      await page.screenshot({ path: path.join(out, `ink-white-${width}.png`), fullPage: true });
    }
    // A separate browser with empty local storage restores the server setting.
    const fresh = await contextFor('account-a');
    const second = await openSettings(fresh); await assertSkin(second, 'ink-white');
    // Switching accounts in the same browser must load that account's own choice.
    await second.evaluate(() => localStorage.setItem('dikongkong_token', 'account-b'));
    await second.reload(); await assertSkin(second, 'ocean-blue');
    assert.equal(saved.get('account-a'), 'ink-white');
    // API load errors are visible and never represented as a saved preference.
    failRead = true;
    await second.reload(); await second.getByText('无法读取管理员皮肤设置，请重试。', { exact: true }).waitFor();
    assert.equal(await second.getByRole('button', { name: '保存皮肤', exact: true }).isDisabled(), true);
    failRead = false;
    await second.getByRole('button', { name: '重新读取', exact: true }).click();
    await second.getByRole('radio', { name: '墨白', exact: true }).check();
    await second.getByRole('button', { name: '保存皮肤', exact: true }).click(); await assertSkin(second, 'ink-white');
    // Ghost button contrast stays white in the monochrome skin.
    await second.goto(base + '/admin/subscription-push');
    const ghost = second.getByRole('button', { name: '更新落地页 >' }); await ghost.waitFor();
    for (const mode of ['normal', 'hover', 'focus']) {
      if (mode === 'hover') await ghost.hover(); if (mode === 'focus') await ghost.focus();
      assert.equal(await ghost.evaluate(e => getComputedStyle(e).color), 'rgb(255, 255, 255)');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ skins: skins.map(s => s[1]), writes, accountPersistence: true, failureHandling: true, mobileOverflow: false, errors }, null, 2));
    console.log('PASS: 5 skins, server save/reload, fresh browser restore, account isolation, read/write errors, mobile layouts, ghost contrast.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
