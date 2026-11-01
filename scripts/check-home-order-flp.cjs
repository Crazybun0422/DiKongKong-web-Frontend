const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('dikongkong_token','fixture'));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    if(route.request().resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:''});
    let data={};
    if(url.pathname==='/api/orders')data={content:[
     {id:'market:LLP20261006153045-000001',orderNumber:'LLP20261006153045-000001',orderType:'MARKET',referenceId:'LLP20261006153045-000001',featureCode:'ABC123',status:'PAID',paymentType:'WECHAT',amount:16,flpAmount:4,createdAt:'2026-10-06T15:30:45',updatedAt:'2026-10-06T15:31:00'},
     {id:'points',orderNumber:'LLP20261006153046-000002',orderType:'MEMBER',referenceId:'MONTHLY',featureCode:'DEF456',status:'PAID',paymentType:'FLP',amount:20,flpAmount:20},
     ...Array.from({length:8},(_,i)=>({id:'legacy-'+i,orderNumber:'1b5b201f7ed84dd4a1e05c1fbc9b931a',referenceId:'1b5b201f7ed84dd4a1e05c1fbc9b931a',featureCode:'D71RCW',status:'WAITING_PAYMENT',paymentType:'WECHAT',amount:0.02,createdAt:'2026-10-07T18:04:35',updatedAt:'2026-10-07T18:04:35'}))
    ],totalElements:1498,totalPages:150,page:0,size:10};
    return route.fulfill({json:{success:true,data}});
   }
   if(url.origin!=='http://127.0.0.1:5188')return route.abort();
   return route.continue();
  });
  await page.goto('http://127.0.0.1:5188/admin/');
  await page.locator('.board-item--orders').click();
  await page.getByText('4.00 FLP',{exact:true}).waitFor();
  assert.equal(await page.getByText('20.00 FLP',{exact:true}).count(),1);
  assert.ok((await page.locator('.orders-table').innerText()).includes('微信 ＋ FLP'));
  const row=page.locator('.orders-table tbody tr').filter({hasText:'DEF456'});
  assert.ok((await row.innerText()).includes('—'));
  fs.mkdirSync('artifacts/order-number-20261006',{recursive:true});
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  await page.screenshot({path:'artifacts/order-number-20261006/home-flp.png'});
  for(const width of [1920,1280,768,390]) {
   await page.setViewportSize({width,height:720});
   await page.waitForTimeout(150);
   const layout=await page.evaluate(()=>{
    const modal=document.querySelector('.ant-modal-content');
    const wrapper=document.querySelector('.orders-table');
    const body=wrapper.querySelector('.ant-table-body');
    const header=wrapper.querySelector('.ant-table-header');
    const bounds=modal.getBoundingClientRect();
    const inside=el=>{const r=el.getBoundingClientRect();return r.left>=bounds.left&&r.right<=bounds.right+1};
    body.scrollLeft=body.scrollWidth;
    return {inViewport:bounds.left>=0&&bounds.right<=innerWidth,
     contained:[wrapper,body,header,wrapper.querySelector('.ant-pagination')].every(inside),
     scrolls:body.scrollWidth>body.clientWidth&&body.scrollLeft>0,
     verticalScroll:body.scrollHeight>body.clientHeight,
     noWrap:[...wrapper.querySelectorAll('th')].every(el=>getComputedStyle(el).whiteSpace==='nowrap'),
     fixed:getComputedStyle(body.querySelector('table')).tableLayout==='fixed',
     legacyTitle:!!wrapper.querySelector('td[title="1b5b201f7ed84dd4a1e05c1fbc9b931a"]')};
   });
   for(const [key,value] of Object.entries(layout))assert.equal(value,true,`${width}px: ${key}`);
   await page.locator('.orders-table .ant-table-body').evaluate(el=>{el.scrollLeft=0;});
   await page.screenshot({path:`artifacts/order-number-20261006/order-layout-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: LLP/legacy orders, cash/FLP, fixed columns, full ID titles, contained horizontal/vertical scrolling and pagination at 1920/1280/768/390px.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

