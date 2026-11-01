const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.ADMIN_CHECK_URL || 'http://127.0.0.1:5191';
const output = path.resolve('build/checks/virtual-payment-config');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(() => localStorage.setItem('dikongkong_token', 'test-admin-only'));
    let stored = {
      enabled: true, offerId: 'test-offer', env: 0, appKey: 'test-app-key', sandboxAppKey: '',
      callbackToken: 'testCallbackToken123', encodingAesKey: '', miniProgramOriginalId: 'gh_test',
      products: [
        { business: 'MONTHLY', productId: 'yue', priceFen: 1200 },
        { business: 'YEARLY', productId: 'nian', priceFen: 11900 },
        { business: 'LIFETIME', productId: 'zhongshen', priceFen: 49800 },
        { business: 'CIRCLE_UNLOCK', productId: 'qunjiesuo', priceFen: 199 },
      ],
    };
    const view = () => ({ config: stored, appKeyConfigured: true, sandboxAppKeyConfigured: false, callbackTokenConfigured: true, encodingAesKeyConfigured: false });
    let puts = 0, mode = 'success';
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(baseUrl).origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/config/virtual-payment') {
        if (request.method() === 'PUT') {
          puts++;
          await new Promise(resolve => setTimeout(resolve, 200));
          if (mode === 'conflict') return route.fulfill({ status: 409, json: { success: false, message: { 'zh-CN': 'EncodingAESKey 应为 43 位' }, data: null } });
          if (mode === 'application-error') return route.fulfill({ json: { success: false, message: { 'zh-CN': '配置保存被拒绝' }, data: null } });
          if (mode === 'malformed') return route.fulfill({ json: { success: true, data: null } });
          if (mode === 'network') return route.abort('failed');
          assert.equal(request.headers().authorization, 'Bearer test-admin-only');
          stored = { ...request.postDataJSON(), offerId: request.postDataJSON().offerId.trim() };
        }
        return route.fulfill({ json: { success: true, data: view() } });
      }
      const data = url.pathname.includes('/auth/profile')
        ? { username: '测试管理员', email: 'test@example.com' }
        : { content: [], records: [], items: [], rows: [], list: [], totalElements: 0, total: 0, config: {}, releases: [] };
      return route.fulfill({ json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl + '/admin/settings');
    await page.getByRole('tab', { name: '支付设置', exact: true }).click();
    const card = page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: '微信虚拟支付 · 会员与群解锁' }) }).last();
    const field = label => card.locator('.ant-form-item').filter({ has: page.locator('.ant-form-item-label', { hasText: label }) }).locator('input');
    const save = card.getByRole('button', { name: '保存配置', exact: true });
    await field('OfferID').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'test-offer'));
    await field('OfferID').fill('  updated-offer  ');
    await save.click();
    await page.waitForTimeout(700);
    assert.equal(puts, 1, '点击保存必须发出一次 PUT 请求');
    assert.equal(stored.offerId, 'updated-offer');
    assert.equal(await field('OfferID').inputValue(), 'updated-offer', '必须回显后端保存后的值');
    assert.equal(await field('正式环境 AppKey').inputValue(), 'test-app-key');
    await card.getByRole('alert').filter({ hasText: '虚拟支付配置已保存' }).waitFor();

    await field('OfferID').fill('unsaved-edit');
    await card.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'updated-offer'));
    await field('OfferID').fill('keep-draft');
    for (const [failure, expected] of [
      ['conflict', 'EncodingAESKey 应为 43 位'],
      ['application-error', '配置保存被拒绝'],
      ['malformed', '服务器未返回有效的虚拟支付配置'],
      ['network', '无法连接服务器'],
    ]) {
      mode = failure;
      const before = puts;
      await save.click();
      await card.getByRole('alert').filter({ hasText: expected }).waitFor();
      assert.equal(puts, before + 1);
      assert.equal(await field('OfferID').inputValue(), 'keep-draft', '保存失败不能丢失填写内容');
      assert.equal(await save.isDisabled(), false, '保存失败后必须允许重试');
    }
    mode = 'success';
    const beforeRetry = puts;
    await save.evaluate(button => { button.click(); button.click(); });
    await card.getByRole('alert').filter({ hasText: '虚拟支付配置已保存' }).waitFor();
    assert.equal(puts, beforeRetry + 1, '连续点击不能重复保存');
    assert.equal(stored.offerId, 'keep-draft');
    assert.deepEqual(errors, []);
    fs.mkdirSync(output, { recursive: true });
    await card.screenshot({ path: path.join(output, 'saved.png') });
    console.log(JSON.stringify({ success: true, checks: ['click submits', 'saved values echo', 'reload', 'HTTP validation error', 'application error', 'invalid response', 'network error', 'draft retained', 'retry', 'duplicate submit guard'], puts }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
