const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),JSZip=require('jszip');
const root=path.resolve(process.env.XINGGE_ADMIN_ROOT||path.join(__dirname,'../build/xingge-verification')),out=path.resolve(__dirname,'../build/checks/xingge');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,req.url.startsWith('/admin')?'admin/index.html':'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));});
server.listen(0,'127.0.0.1',async()=>{
 const browser=await chromium.launch({headless:true});let uploadCount=0;
 try{
  const origin='http://127.0.0.1:'+server.address().port,context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(()=>localStorage.setItem('dikongkong_token','fixture-admin'));
  let current={status:'unconfigured'};
  await context.route('**/*',r=>{
   const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(!u.pathname.startsWith('/api/'))return r.continue();
   let data={content:[],records:[],items:[],rows:[],list:[],totalElements:0,total:0,config:{},releases:[]};
   if(u.pathname.includes('/auth/profile'))data={username:'星球管理员'};
   if(u.pathname==='/api/xingge-image-packs/version')data=current;
   if(u.pathname==='/api/xingge-image-packs/upload'){assert.equal(r.request().headers().authorization,'Bearer fixture-admin');uploadCount++;data=current={status:'ready',schemaVersion:2,resourceVersion:'xingge-art-fixture-1',version:'xingge-art-fixture-1',fileName:'fixture.zip'};}
   return r.fulfill({json:{success:true,data}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/admin/settings');
  await page.getByRole('tab',{name:'系统设置',exact:true}).evaluate(e=>e.click());
  await page.getByRole('tab',{name:'星格图片包',exact:true}).evaluate(e=>e.click());
  const section=page.locator('.skytype-pack');await section.waitFor();await page.waitForTimeout(200);
  assert(await section.getByText('未获取',{exact:true}).count()>=1);await section.screenshot({path:path.join(out,'upload-unconfigured.png')});
  const bad=await new JSZip().file('old.png','old').generateAsync({type:'nodebuffer'});
  await section.locator('input[type=file]').setInputFiles({name:'old.zip',mimeType:'application/zip',buffer:bad});
  await section.locator('.ant-alert-error').getByText('old.zip：ZIP 根目录缺少有效的 manifest.json。',{exact:true}).waitFor();assert.equal(uploadCount,0);
  const zip=new JSZip().file('manifest.json',JSON.stringify({schemaVersion:2,testVersion:'lowaltitude-star-v2-20261028',resourceVersion:'xingge-art-fixture-1',entries:Array.from({length:50},(_,i)=>({key:String(i)}))}));
  const manifest={schemaVersion:2,testVersion:'lowaltitude-star-v2-20261028',resourceVersion:'xingge-art-fixture-1',entries:Array.from({length:50},(_,i)=>({key:String(i),file:'image-'+i+'.png'}))};
  for(const e of manifest.entries)zip.file(e.file,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64'));
  zip.file('manifest.json',JSON.stringify({...manifest,testVersion:'wrong-test-version'}));
  await section.locator('input[type=file]').setInputFiles({name:'wrong-version.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await section.locator('.ant-alert-error').filter({hasText:'testVersion 为 "wrong-test-version"'}).waitFor();assert.equal(uploadCount,0);
  zip.file('manifest.json',JSON.stringify(manifest));
  await section.locator('input[type=file]').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await page.waitForFunction(()=>document.querySelector('.skytype-pack input[readonly]')?.value==='xingge-art-fixture-1');
  await section.getByRole('button',{name:'上传并保存',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.skytype-pack__meta-value')?.textContent.includes('xingge-art-fixture-1'));assert.equal(uploadCount,1);
  if(process.env.XINGGE_ARTWORK_ZIP) {
   const actual=process.env.XINGGE_ARTWORK_ZIP;
   const source=JSON.parse(await (await JSZip.loadAsync(fs.readFileSync(actual))).file('manifest.json').async('string'));
   await section.locator('input[type=file]').setInputFiles(actual);
   await page.waitForFunction(version=>document.querySelector('.skytype-pack input[readonly]')?.value===version,source.resourceVersion);
   assert.equal(await section.locator('.ant-alert-error').count(),0);
   await section.screenshot({path:path.join(out,'actual-pack-selected.png')});
   await section.getByRole('button',{name:'上传并保存',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.skytype-pack__file-name'));
   assert.equal(uploadCount,2);console.log('PASS actual user ZIP: '+path.basename(actual)+' ('+source.entries.length+' images, '+source.resourceVersion+')');
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await section.screenshot({path:path.join(out,'upload-mobile.png')});assert.deepEqual(errors,[]);
  console.log('PASS admin UI: unconfigured, legacy ZIP rejection, manifest version, authenticated upload, mobile layout');
 }finally{await browser.close();server.close();}
});
process.on('unhandledRejection',e=>{console.error(e);process.exitCode=1;server.close();});
