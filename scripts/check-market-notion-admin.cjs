const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('dikongkong_token','fixture'));
 const image=fs.readFileSync('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/assets/logo.png');
 let saved,uploads=0;const product={id:1,revision:1,title:'飞行便携收纳包',brand:'星球好物',category:'飞行配件',imageUrl:'first.png',imageUrls:['first.png'],originalPrice:10,maxFlp:2,costPrice:7,supplier:'测试商家',stock:3,published:true,presale:true,variants:[]};
 await page.route('**/api/**',r=>{const req=r.request(),p=new URL(req.url()).pathname;if(req.resourceType()==='script')return r.fulfill({contentType:'text/javascript',body:''});if(p.startsWith('/api/files/download/'))return r.fulfill({contentType:'image/png',body:image});let data={};if(p==='/api/files/upload'){data='https://old-upload.invalid/files/image'+(++uploads)+'.png'}else if(p==='/api/market/admin/products'&&req.method()==='GET')data={content:[product],totalElements:1};else if(p==='/api/market/admin/products/1'){saved=req.postDataJSON();Object.assign(product,saved);data=product;}return r.fulfill({json:{success:true,data}});});
 await page.goto('http://127.0.0.1:5188/admin/planet-market');await page.getByRole('button',{name:'编辑',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'second.png',mimeType:'image/png',buffer:image});await page.waitForFunction(()=>document.querySelectorAll('.image-item').length===2&&document.querySelectorAll('.preview')[1].naturalWidth>0);
 await page.getByRole('button',{name:/前\s*移/}).nth(1).click();assert((await page.locator('.preview').first().getAttribute('src')).endsWith('/image1.png'));
 await page.getByRole('button',{name:'新增套餐',exact:true}).click();await page.getByPlaceholder('套餐名称，如：标准版 / 双电池套装').fill('标准版');
 const nums=page.locator('.variant-editor input[role=spinbutton]');await nums.nth(0).fill('10');await nums.nth(1).fill('2');await nums.nth(2).fill('7');await nums.nth(3).fill('3');
 await page.getByRole('button',{name:'新增套餐',exact:true}).click();await page.getByPlaceholder('套餐名称，如：标准版 / 双电池套装').nth(1).fill('双电池套装');const extra=page.locator('.variant-editor').nth(1).locator('input[role=spinbutton]');await extra.nth(0).fill('20');await extra.nth(1).fill('3');await extra.nth(2).fill('10');await extra.nth(3).fill('5');
 await page.screenshot({path:'artifacts/market-notion/admin-variants.png',fullPage:true});await page.getByRole('button',{name:/保\s*存/}).click();await page.waitForFunction(()=>!document.querySelector('.ant-modal-wrap')||getComputedStyle(document.querySelector('.ant-modal-wrap')).display==='none');
 assert.equal(saved.imageUrl,'image1.png');assert.deepEqual(saved.imageUrls,['image1.png','first.png']);assert.equal(saved.variants.length,2);assert.equal(saved.variants[1].maxFlp,3);assert.equal(saved.variants[1].stock,5);assert(saved.variants[0].id!==saved.variants[1].id);assert.deepEqual(errors,[]);
 console.log('PASS admin multiple uploads, decoded image preview, cover reorder, independent variants, filename-only save.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
