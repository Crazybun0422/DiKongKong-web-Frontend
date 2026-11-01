import assert from 'node:assert/strict';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright';

const server=await createServer({configFile:false,plugins:[vue(),{
 name:'apk-fixture',resolveId(id){if(id==='/__apk-fixture.js')return id;},
 load(id){if(id==='/__apk-fixture.js')return `import {createApp} from 'vue';import Antd from 'ant-design-vue';import App from '/src/components/AndroidApkManager.vue';createApp(App).use(Antd).mount('#app');`;},
 configureServer(server){server.middlewares.use('/__apk-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__apk-fixture.js"></script></body></html>');});}
}],server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:393,height:852}});
 let selected=3,changes=0;
 const releases=()=>[4,3,2,1].map(id=>({id,versionName:`2.0.${id}`,versionCode:id,packageName:'cn.llplanet.lowlatitudeplanet',sizeBytes:1048576,sha256:'a'.repeat(64),selected:id===selected,publishedAt:'2026-09-21T12:00:00',downloadUrl:`/api/android/app-releases/${id}/versions/${id}/${'a'.repeat(64)}.apk`}));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()==='PUT'){selected=Number(path.split('/').at(-2));changes++;}
  await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:path.endsWith('/active')?releases().find(r=>r.selected):releases()})});
 });
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__apk-test`);
 await page.getByText('当前升级版本 2.0.3',{exact:true}).waitFor();
 assert.equal(await page.locator('.apk-history-row').count(),4);
 await page.locator('.apk-history-row').filter({hasText:'2.0.2'}).getByRole('button',{name:'设为升级包'}).click();
 await page.getByRole('button',{name:/切\s*换/}).click({timeout:2000});
 await page.getByText('当前升级版本 2.0.2',{exact:true}).waitFor();
 assert.equal(changes,1);
 assert.match(await page.getByText('下载当前安装包',{exact:true}).getAttribute('href'),/\/2\/versions\/2\/[a-f0-9]{64}\.apk$/);
 await page.reload();await page.getByText('当前升级版本 2.0.2',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'android-upgrade-manager.png',fullPage:true});
 console.log('PASS: selected rollback package displayed instead of first row; explicit selection persists after reload; immutable URL; mobile layout.');
} finally {await browser.close();await server.close();}
