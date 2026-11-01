from pathlib import Path
p=Path('src/views/dashboard/PlanetMarketView.vue');s=p.read_text('utf-8')
s=s.replace("function edit(row){", "function edit(row){")
s=s.replace("editing.value=true}","form.imageUrls=[...(row?.imageUrls?.length?row.imageUrls:row?.imageUrl?[row.imageUrl]:[])];form.variants=(row?.variants||[]).map(v=>({...v}));editing.value=true}",1)
start=s.index('async function save()');end=s.index('function showShip',start)
s=s[:start]+'''function variantCash(v){return (Number(v.originalPrice)||0)-(Number(v.maxFlp)||0)}
function addVariant(){if(form.variants.length<30)form.variants.push({id:'v_'+crypto.randomUUID().replaceAll('-',''),name:'',originalPrice:null,maxFlp:null,costPrice:null,stock:0})}
function removeImage(index){form.imageUrls.splice(index,1);form.imageUrl=form.imageUrls[0]||''}
function moveImage(index,delta){const next=index+delta;if(next<0||next>=form.imageUrls.length)return;[form.imageUrls[index],form.imageUrls[next]]=[form.imageUrls[next],form.imageUrls[index]];form.imageUrl=form.imageUrls[0]}
async function save(){
 if(saving.value)return;
 if(!form.title?.trim()||!form.imageUrls?.length||!form.supplier?.trim())return message.warning('请填写名称、图片和供应商');
 const offers=form.variants.length?form.variants:[form];
 if(offers.some(v=>v.originalPrice==null||v.maxFlp==null||v.costPrice==null||!(Number(v.maxFlp)>0&&variantCash(v)>Number(v.costPrice)&&Number(v.costPrice)>=0&&variantCash(v)>0)))return message.warning('每个套餐现金价必须高于成本价，且 FLP 必须大于零');
 if(form.variants.some(v=>!v.name?.trim()))return message.warning('请填写套餐名称');
 const base=offers[0];saving.value=true;
 try{await req('/products'+(form.id?'/'+form.id:''),form.id?'put':'post',{...form,originalPrice:base.originalPrice,maxFlp:base.maxFlp,costPrice:base.costPrice,stock:form.variants.length?0:form.stock,imageUrl:extractObjectName(form.imageUrls[0]),imageUrls:form.imageUrls.map(extractObjectName)});editing.value=false;message.success('已保存');await load()}catch(e){fail(e)}finally{saving.value=false}
}
async function upload({file,onSuccess,onError}){
 if(saving.value||form.imageUrls.length>=9){const e=Error('请等待当前上传完成，最多上传 9 张图片');onError(e);message.warning(e.message);return;}
 saving.value=true;try{const r=await uploadPublicFile(file);form.imageUrls.push(r.objectName);form.imageUrl=form.imageUrls[0];onSuccess(r)}catch(e){fail(e);onError(e)}finally{saving.value=false}
}
''' +s[end:]
old='''<a-form-item label="商品主图"><a-upload accept="image/*" :show-upload-list="false" :custom-request="upload"><a-button :loading="saving">上传图片</a-button></a-upload><img v-if="form.imageUrl" :src="imageSrc(form.imageUrl)" class="preview"/></a-form-item><div class="price-fields">'''
new='''<a-form-item label="商品图片（最多 9 张，第一张为主图）"><a-upload accept="image/*" :show-upload-list="false" :custom-request="upload" :disabled="saving || form.imageUrls.length >= 9"><a-button :loading="saving">上传图片</a-button></a-upload><div class="image-list"><div v-for="(url,index) in form.imageUrls" :key="url+index" class="image-item"><img :src="imageSrc(url)" class="preview"/><span>{{index===0?'主图':'图片 '+(index+1)}}</span><div><a-button size="small" :disabled="saving || index===0" @click="moveImage(index,-1)">前移</a-button><a-button size="small" :disabled="saving || index===form.imageUrls.length-1" @click="moveImage(index,1)">后移</a-button><a-button size="small" danger :disabled="saving" @click="removeImage(index)">删除</a-button></div></div></div></a-form-item>
 <div class="variant-heading"><strong>套餐规格</strong><a-button :disabled="saving || form.variants.length >= 30" @click="addVariant">新增套餐</a-button></div><p class="variant-help">不同套餐可分别设置现金＋FLP、成本及可售库存；不配置套餐时使用下方默认规格。</p>
 <div class="variant-editor" v-for="(v,index) in form.variants" :key="v.id"><div class="variant-heading"><a-input v-model:value="v.name" placeholder="套餐名称，如：标准版 / 双电池套装" :maxlength="80"/><a-button danger :disabled="saving" @click="form.variants.splice(index,1)">移除</a-button></div><div class="price-fields"><a-form-item label="原价（元）"><a-input-number v-model:value="v.originalPrice" :min="0.01" :precision="2"/></a-form-item><a-form-item label="抵扣 FLP"><a-input-number v-model:value="v.maxFlp" :min="0.01" :precision="2"/></a-form-item><a-form-item label="成本（元）"><a-input-number v-model:value="v.costPrice" :min="0" :precision="2"/></a-form-item><a-form-item label="可售库存"><a-input-number v-model:value="v.stock" :min="0" :max="1000000" :precision="0"/></a-form-item></div><span>仅需 ¥{{money(variantCash(v))}} ＋ {{money(v.maxFlp)}} FLP</span></div>
 <div class="price-fields" v-if="!form.variants.length">'''
assert old in s;s=s.replace(old,new)
s=s.replace('<a-alert :message="\'用户支付', '<a-alert v-if="!form.variants.length" :message="\'用户支付')
s=s.replace('<a-form-item label="可售数量（不含待支付订单已锁定数量）">','<a-form-item v-if="!form.variants.length" label="可售数量（不含待支付订单已锁定数量）">')
s=s.replace('{{o.title}} ×{{o.quantity}}','{{o.title}}<br v-if="o.variantName"/><span v-if="o.variantName">{{o.variantName}}</span> ×{{o.quantity}}')
s=s.replace('</style>', '.image-list{display:flex;flex-wrap:wrap;gap:16px}.image-item{display:flex;flex-direction:column;gap:6px;font-size:12px}.image-item .preview{margin:8px 0 0}.image-item>div{display:flex;gap:4px}.variant-heading{display:flex;align-items:center;gap:12px;justify-content:space-between}.variant-help{font-size:12px;color:#718096;margin:8px 0 14px}.variant-editor{padding:14px;border:1px solid #e6ebf2;border-radius:10px;margin-bottom:12px;background:#f8fafc}.variant-editor .price-fields>div{min-width:120px}\n</style>')
p.write_text(s,encoding='utf-8')
