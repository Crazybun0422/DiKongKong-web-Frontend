const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { fixture, server } = require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const out = 'artifacts/market-address-20261006';
fs.mkdirSync(out, { recursive: true });
server.listen(0, '127.0.0.1', async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, bypassCSP: true });
  await fixture(page, 'packages/market/detail/index');
  await page.evaluate(() => {
   const original = AndroidMini.call;
   AndroidMini.call = (id, method, payload) => {
    const args = JSON.parse(payload);
    if (method === 'request' && args.url.includes('geocoder')) {
     platformCalls.push({method,args});
     setTimeout(() => miniReply(id, true, { statusCode: 200, data: { status: 0, result: {
      address: '江苏省苏州市工业园区星湖街1号',
      formatted_addresses: { recommend: '测试大厦', rough: '工业园区' }
     } } }), 0);
    } else original(id, method, payload);
   };
   miniDebug.active.setData({ product: { id: 1, title: '测试商品', stock: 10, cashPrice: 8, maxFlp: 2, variants: [], imageUrls: [] }, selected: { stock: 10, cashPrice: 8, maxFlp: 2 }, checkoutOpen: true, error: '', recipient: '收货人', phone: '13800138000', address: '原收货地址' });
   miniDebug.active.totals();
  });
  for (const width of [320, 393, 1200]) {
   await page.setViewportSize({width,height:852});
   await page.locator('.address-heading').evaluate(el => el.scrollIntoView({block:'center'}));
   await page.waitForTimeout(100);
   const boxes = await page.evaluate(() => {
    const parent = document.querySelector('.address-heading').getBoundingClientRect();
    const button = document.querySelector('.address-map-button').getBoundingClientRect();
    return { left: parent.left, right: parent.right, buttonLeft: button.left, buttonRight: button.right, width: button.width, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
   });
   assert.equal(boxes.width, 88);
   assert.ok(boxes.buttonLeft >= boxes.left && boxes.buttonRight <= boxes.right);
   assert.ok(boxes.pageWidth <= boxes.viewport);
   await page.screenshot({ path: `${out}/address-${width}.png` });
  }
  await page.setViewportSize({width:393,height:852});
  await page.locator('.address-map-button').click();
  await page.waitForFunction(() => miniDebug.active.route === 'pages/markers/location-picker/index' && miniDebug.active.data.fullAddress === '江苏省苏州市工业园区星湖街1号');
  assert.ok(await page.evaluate(() => platformCalls.some(c => c.method === 'location')));
  assert.equal(await page.evaluate(() => miniDebug.active.data.addressDetail), '工业园区');
  const coords = await page.evaluate(() => ({latitude: miniDebug.active.data.selectedLatitude, longitude: miniDebug.active.data.selectedLongitude}));
  await page.evaluate(() => miniDebug.active.onConfirm());
  await page.waitForFunction(() => miniDebug.active.route === 'packages/market/detail/index');
  assert.deepEqual(await page.evaluate(() => ({address:miniDebug.active.data.address,recipient:miniDebug.active.data.recipient,phone:miniDebug.active.data.phone})), {address:'江苏省苏州市工业园区星湖街1号',recipient:'收货人',phone:'13800138000'});
  await page.evaluate(() => miniDebug.active.field({currentTarget:{dataset:{field:'address'}}, detail:{value:'江苏省苏州市工业园区星湖街1号2幢302室'}}));
  await page.locator('.address-map-button').click();
  await page.waitForFunction(() => miniDebug.active.route === 'pages/markers/location-picker/index' && miniDebug.active._initialPayload);
  const reopened = await page.evaluate(() => miniDebug.active._initialPayload);
  assert.equal(reopened.latitude, coords.latitude);
  assert.equal(reopened.longitude, coords.longitude);
  await page.evaluate(() => wx.navigateBack());
  await page.waitForFunction(() => miniDebug.active.route === 'packages/market/detail/index');
  assert.equal(await page.evaluate(() => miniDebug.active.data.address), '江苏省苏州市工业园区星湖街1号2幢302室');
  await page.locator('.address-map-button').click();
  await page.waitForFunction(() => miniDebug.active.route === 'pages/markers/location-picker/index' && miniDebug.active.data.canConfirm);
  await page.evaluate(() => {miniDebug.active.setData({addressError:'网络错误',fullAddress:'',addressMain:'31, 120',addressDetail:'无法获取详细地址'});miniDebug.active.onConfirm();});
  await page.waitForFunction(() => miniDebug.active.route === 'packages/market/detail/index');
  assert.equal(await page.evaluate(() => miniDebug.active.data.address), '江苏省苏州市工业园区星湖街1号2幢302室');
  console.log('PASS: responsive address control, GPS and reverse geocoding, full-address return, recipient preservation, manual edit, prior-point reopen, cancel and failure preservation.');
 } catch (error) {
  console.error(error);
  process.exitCode = 1;
 } finally { await browser.close(); server.close(); }
});
