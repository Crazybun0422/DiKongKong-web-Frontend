const fs=require('fs');
const file='src/views/dashboard/PlanetMarketView.vue';let s=fs.readFileSync(file,'utf8');
s=s.replace('不同套餐可分别设置现金＋FLP、成本及可售库存；不配置套餐时使用下方默认规格。','每个套餐可单独填写名称、价格、库存，并上传一张规格图；未上传规格图时使用商品主图。');
s=s.replace(':disabled="saving" @click="form.variants.splice(index,1)"',':disabled="saving || form.variants.length <= 1" @click="removeVariant(index)"');
s=s.replace('<span>仅需 ¥{{money(variantCash(v))}} ＋ {{money(v.maxFlp)}} FLP</span></div>',`<span>仅需 ¥{{money(variantCash(v))}} ＋ {{money(v.maxFlp)}} FLP</span>
 <div class="variant-image"><span class="variant-image-label">规格图（仅一张）</span><img v-if="v.imageUrl" :src="imageSrc(v.imageUrl)" class="variant-preview" :alt="v.name || '套餐规格图'"/><a-upload accept="image/*" :multiple="false" :show-upload-list="false" :custom-request="options=>uploadVariant(v,options)" :disabled="saving"><a-button :disabled="saving">{{v.imageUrl?'更换规格图':'上传规格图'}}</a-button></a-upload><a-button v-if="v.imageUrl" danger size="small" :disabled="saving" @click="v.imageUrl=''">移除图片</a-button></div></div>`);
const start=s.indexOf(' <div class="price-fields" v-if="!form.variants.length">'),end=s.indexOf('<a-form-item label="商品介绍">',start);
if(start<0||end<0)throw Error('default offer section missing');
s=s.slice(0,start)+' <a-form-item label="供应商"><a-input v-model:value="form.supplier" :maxlength="120"/></a-form-item>'+s.slice(end);
s=s.replace('</style>','.variant-image{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px}.variant-image-label{flex-basis:100%;font-size:13px}.variant-preview{width:76px;height:76px;object-fit:contain;border:1px solid #e6ebf2;border-radius:8px;background:white}\n</style>');
fs.writeFileSync(file,s);
