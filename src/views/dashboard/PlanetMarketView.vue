<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import http from '../../services/http'
import { uploadPublicFile, buildDownloadUrl, extractObjectName } from '../../services/files'
import { newMarketVariant, marketVariantsForEdit } from '../../utils/market-product-form'
const tab=ref('products'), rows=ref([]), total=ref(0), page=ref(1), loading=ref(false), saving=ref(false)
const q=ref(''),category=ref(''),status=ref('PAID'),supplier=ref(''),editing=ref(false),shipping=ref(null),settling=ref(null),logistics=reactive({carrier:'',trackingNumber:''}),reference=ref('')
const form=reactive({})
const deleting=ref(null), pinning=ref(null)
const marketClosed=ref(false), configLoaded=ref(false), configSaving=ref(false)
const labels={WAITING_PAYMENT:'待支付',PAID:'待发货',SHIPPED:'已发货',COMPLETED:'已收货',CANCELLED:'已取消'}
const imageSrc=value=>buildDownloadUrl(extractObjectName(value))
const money=v=>Number(v||0).toFixed(2)
const date=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'—'
const fail=e=>message.error(e.response?.data?.message?.zh||e.message||'操作失败')
async function req(path,method='get',data){const r=await http[method]('/market/admin'+path,data);if(!r.data.success)throw Error(r.data.message?.zh||'操作失败');return r.data.data}
async function load(){loading.value=true;try{let url=tab.value==='products'?'/products?q='+encodeURIComponent(q.value)+'&category='+encodeURIComponent(category.value):tab.value==='audits'?'/audits':'/orders?status='+status.value+'&supplier='+encodeURIComponent(supplier.value);url+=(url.includes('?')?'&':'?')+'page='+(page.value-1);const r=await req(url);rows.value=r.content;total.value=r.totalElements}catch(e){fail(e)}finally{loading.value=false}}
function switchTab(){page.value=1;load()}
async function loadConfig(){try{const config=await req('/config');marketClosed.value=config.closed;configLoaded.value=true}catch(e){fail(e)}}
async function setMarketClosed(closed){
 if(!configLoaded.value||configSaving.value)return;
 configSaving.value=true;
 try{const config=await req('/config','put',{closed});marketClosed.value=config.closed;message.success(closed?'星球有市已关闭':'星球有市已开启')}catch(e){fail(e)}finally{configSaving.value=false}
}
async function deleteProduct(product){
 if(deleting.value!==null)return;
 deleting.value=product.id;
 try{await req('/products/'+product.id,'delete');message.success('商品已删除');if(rows.value.length===1&&page.value>1)page.value--;await load()}catch(e){fail(e)}finally{deleting.value=null}
}
async function togglePin(product){
 if(pinning.value!==null)return;
 pinning.value=product.id;
 try{await req('/products/'+product.id+'/pin','put',{pinned:!product.pinned,revision:product.revision});message.success(product.pinned?'已取消置顶':'商品已置顶');await load()}catch(e){fail(e)}finally{pinning.value=null}
}
function edit(row){Object.keys(form).forEach(k=>delete form[k]);Object.assign(form,row||{title:'',brand:'',category:'',description:'',imageUrl:'',originalPrice:null,maxFlp:null,costPrice:null,supplier:'',stock:0,presale:false,published:false});form.imageUrls=[...(row?.imageUrls?.length?row.imageUrls:row?.imageUrl?[row.imageUrl]:[])];form.variants=marketVariantsForEdit(row);editing.value=true}
function variantCash(v){return (Number(v.originalPrice)||0)-(Number(v.maxFlp)||0)}
function addVariant(){if(form.variants.length<30)form.variants.push(newMarketVariant())}
function removeVariant(index){if(!saving.value&&form.variants.length>1)form.variants.splice(index,1)}
function removeImage(index){form.imageUrls.splice(index,1);form.imageUrl=form.imageUrls[0]||''}
function moveImage(index,delta){const next=index+delta;if(next<0||next>=form.imageUrls.length)return;[form.imageUrls[index],form.imageUrls[next]]=[form.imageUrls[next],form.imageUrls[index]];form.imageUrl=form.imageUrls[0]}
async function save(){
 if(saving.value)return;
 if(!form.title?.trim()||!form.imageUrls?.length||!form.supplier?.trim())return message.warning('请填写名称、图片和供应商');
 const offers=form.variants.length?form.variants:[form];
 if(offers.some(v=>v.originalPrice==null||v.maxFlp==null||v.costPrice==null||!(Number(v.maxFlp)>0&&variantCash(v)>Number(v.costPrice)&&Number(v.costPrice)>=0&&variantCash(v)>0)))return message.warning('每个套餐现金价必须高于成本价，且 FLP 必须大于零');
 if(form.variants.some(v=>!v.name?.trim()))return message.warning('请填写套餐名称');
 const base=offers[0];saving.value=true;
 try{await req('/products'+(form.id?'/'+form.id:''),form.id?'put':'post',{...form,originalPrice:base.originalPrice,maxFlp:base.maxFlp,costPrice:base.costPrice,stock:form.variants.length?0:form.stock,imageUrl:extractObjectName(form.imageUrls[0]),imageUrls:form.imageUrls.map(extractObjectName),variants:form.variants.map(v=>({...v,imageUrl:extractObjectName(v.imageUrl)||''}))});editing.value=false;message.success('已保存');await load()}catch(e){fail(e)}finally{saving.value=false}
}
async function upload({file,onSuccess,onError}){
 if(saving.value||form.imageUrls.length>=9){const e=Error('请等待当前上传完成，最多上传 9 张图片');onError(e);message.warning(e.message);return;}
 saving.value=true;try{const r=await uploadPublicFile(file);form.imageUrls.push(r.objectName);form.imageUrl=form.imageUrls[0];onSuccess(r)}catch(e){fail(e);onError(e)}finally{saving.value=false}
}
async function uploadVariant(variant,{file,onSuccess,onError}){
 if(saving.value){onError(Error('请等待当前上传完成'));return;}
 saving.value=true;
 try{const r=await uploadPublicFile(file);if(form.variants.includes(variant))variant.imageUrl=r.objectName;onSuccess(r)}catch(e){fail(e);onError(e)}finally{saving.value=false}
}
function showShip(o){shipping.value=o;Object.assign(logistics,{carrier:'',trackingNumber:''})}
async function ship(){saving.value=true;try{await req('/orders/'+shipping.value.id+'/ship','post',logistics);shipping.value=null;await load()}catch(e){fail(e)}finally{saving.value=false}}
async function settle(){saving.value=true;try{await req('/orders/'+settling.value.id+'/settle','post',{reference:reference.value});settling.value=null;await load()}catch(e){fail(e)}finally{saving.value=false}}
async function exportOrders(){if(!['PAID','SHIPPED','COMPLETED'].includes(status.value))return message.warning('请选择待发货、已发货或已收货订单');try{const r=await http.get('/market/admin/orders/export',{params:{status:status.value,supplier:supplier.value},responseType:'blob'});const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download='星球有市-'+labels[status.value]+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){message.error('导出失败，请缩小筛选范围后重试')}}
onMounted(()=>{load();loadConfig()})
</script>
<template>
 <section class="market-admin"><div class="heading"><div><h1>星球有市</h1><p>商品、订单与供应商结算</p></div><a-button v-if="tab==='products'" type="primary" @click="edit()">新增商品</a-button></div>
 <div class="market-switch"><span>关闭星球有市</span><a-switch :checked="marketClosed" :disabled="!configLoaded || configSaving" :loading="configSaving" @change="setMarketClosed"/><small>关闭后隐藏 Android、小程序入口，已有订单保留。</small></div>
 <a-tabs v-model:active-key="tab" @change="switchTab"><a-tab-pane key="products" tab="商品管理"/><a-tab-pane key="orders" tab="订单 / 发货 / 结算"/><a-tab-pane key="audits" tab="操作日志"/></a-tabs>
 <div class="filters" v-if="tab==='products'"><a-input-search v-model:value="q" placeholder="搜索品牌或商品名称" @search="switchTab"/><a-input v-model:value="category" placeholder="分类（精确匹配）" @pressEnter="switchTab" style="max-width:220px"/><a-button @click="switchTab">筛选</a-button></div>
 <div class="filters" v-if="tab==='orders'"><a-select v-model:value="status" @change="switchTab" style="width:150px"><a-select-option value="">全部状态</a-select-option><a-select-option v-for="(label,key) in labels" :key="key" :value="key">{{label}}</a-select-option></a-select><a-input v-model:value="supplier" placeholder="供应商名称（精确匹配）" @pressEnter="switchTab"/><a-button @click="switchTab">筛选</a-button><a-button @click="exportOrders">下载商家订单 CSV</a-button></div>
 <a-spin :spinning="loading"><div class="table-scroll"><table v-if="tab==='products'"><thead><tr><th>商品</th><th>原价 / 直接购买</th><th>仅需现金＋FLP</th><th>成本 / 供应商</th><th>可售数量</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="p in rows" :key="p.id"><td><div class="product"><img :src="imageSrc(p.imageUrl)"/><span><small v-if="p.brand||p.category">{{p.brand}}<template v-if="p.brand&&p.category"> · </template>{{p.category}}</small><br v-if="p.brand||p.category"/>{{p.title}} <a-tag v-if="p.pinned" color="blue">置顶</a-tag><a-tag v-if="p.presale" color="orange">预售</a-tag></span></div></td><td>¥{{money(p.originalPrice)}}</td><td>¥{{money(p.originalPrice-p.maxFlp)}} ＋ {{money(p.maxFlp)}} FLP</td><td>¥{{money(p.costPrice)}}<br/>{{p.supplier}}</td><td>{{p.stock}}</td><td><a-tag :color="p.published?'green':'default'">{{p.published?'上架':'下架'}}</a-tag></td><td><a-button type="link" :loading="pinning===p.id" :disabled="pinning!==null || deleting!==null" @click="togglePin(p)">{{p.pinned?'取消置顶':'置顶'}}</a-button><a-button type="link" :disabled="deleting!==null" @click="edit(p)">编辑</a-button><a-popconfirm title="删除这个商品？" description="删除后不再展示，已有订单保留。" ok-text="删除" cancel-text="取消" :disabled="deleting!==null" @confirm="deleteProduct(p)"><a-button type="link" danger :loading="deleting===p.id" :disabled="deleting!==null && deleting!==p.id">删除</a-button></a-popconfirm></td></tr></tbody></table>
 <table v-else-if="tab==='orders'"><thead><tr><th>订单 / 商品</th><th>收货信息</th><th>现金 / FLP / 成本</th><th>供应商</th><th>状态 / 物流</th><th>付款 / 结算</th><th>操作</th></tr></thead><tbody><tr v-for="o in rows" :key="o.id"><td><small>{{o.id}}</small><br/>{{o.title}}<br v-if="o.variantName"/><span v-if="o.variantName">{{o.variantName}}</span> ×{{o.quantity}}</td><td>{{o.recipient}} {{o.phone}}<br/>{{o.address}}</td><td>¥{{money(o.cash)}}<br/><template v-if="o.paymentMode==='CASH'">纯现金购买</template><template v-else>{{money(o.flp)}} FLP</template><br/>成本 ¥{{money(o.cost)}}</td><td>{{o.supplier}}</td><td>{{labels[o.status]}}<br/>{{o.carrier}} {{o.trackingNumber}}</td><td>{{date(o.paidAt)}}<br/>{{o.settledAt?'已结算 '+date(o.settledAt):'未结算'}}<br/>{{o.settlementReference}}</td><td><a-button v-if="o.status==='PAID'" type="link" @click="showShip(o)">录入发货</a-button><a-button v-if="o.status==='COMPLETED'&&!o.settledAt" type="link" @click="settling=o;reference=''">登记结算</a-button></td></tr></tbody></table>
 <table v-else><thead><tr><th>时间</th><th>操作者</th><th>操作</th><th>对象</th><th>详情</th></tr></thead><tbody><tr v-for="log in rows" :key="log.id"><td>{{date(log.createdAt)}}</td><td>{{log.actor}}</td><td>{{log.action}}</td><td>{{log.target}}</td><td>{{log.detail}}</td></tr></tbody></table><a-empty v-if="!loading&&!rows.length" description="暂无记录"/></div></a-spin>
 <a-pagination v-model:current="page" :total="total" :page-size="tab==='audits'?30:20" :show-size-changer="false" @change="load"/>
 <a-modal ok-text="保存" cancel-text="取消" v-model:open="editing" :title="form.id?'编辑商品':'新增商品'" :confirm-loading="saving" @ok="save" width="680px"><a-form layout="vertical"><a-form-item label="商品名称"><a-input v-model:value="form.title" :maxlength="120"/></a-form-item><div class="price-fields"><a-form-item label="品牌名称"><a-input v-model:value="form.brand" :maxlength="80" placeholder="如：星球好物"/></a-form-item><a-form-item label="分类标签"><a-input v-model:value="form.category" :maxlength="40" placeholder="如：飞行配件"/><small>同名标签自动归类，上架后显示在商城分类栏。</small></a-form-item></div><a-form-item label="商品图片（最多 9 张，第一张为主图）"><a-upload accept="image/*" :show-upload-list="false" :custom-request="upload" :disabled="saving || form.imageUrls.length >= 9"><a-button :loading="saving">上传图片</a-button></a-upload><div class="image-list"><div v-for="(url,index) in form.imageUrls" :key="url+index" class="image-item"><img :src="imageSrc(url)" class="preview"/><span>{{index===0?'主图':'图片 '+(index+1)}}</span><div><a-button size="small" :disabled="saving || index===0" @click="moveImage(index,-1)">前移</a-button><a-button size="small" :disabled="saving || index===form.imageUrls.length-1" @click="moveImage(index,1)">后移</a-button><a-button size="small" danger :disabled="saving" @click="removeImage(index)">删除</a-button></div></div></div></a-form-item>
 <div class="variant-heading"><strong>套餐规格</strong><a-button :disabled="saving || form.variants.length >= 30" @click="addVariant">新增套餐</a-button></div><p class="variant-help">每个套餐可单独填写名称、价格、库存，并上传一张规格图；未上传规格图时使用商品主图。直接购买按所选套餐原价收费，不使用 FLP。</p>
 <div class="variant-editor" v-for="(v,index) in form.variants" :key="v.id"><div class="variant-heading"><a-input v-model:value="v.name" placeholder="套餐名称，如：标准版 / 双电池套装" :maxlength="80"/><a-button danger :disabled="saving || form.variants.length <= 1" @click="removeVariant(index)">移除</a-button></div><div class="price-fields"><a-form-item label="原价（元）"><a-input-number v-model:value="v.originalPrice" :min="0.01" :precision="2"/></a-form-item><a-form-item label="抵扣 FLP"><a-input-number v-model:value="v.maxFlp" :min="0.01" :precision="2"/></a-form-item><a-form-item label="成本（元）"><a-input-number v-model:value="v.costPrice" :min="0" :precision="2"/></a-form-item><a-form-item label="可售库存"><a-input-number v-model:value="v.stock" :min="0" :max="1000000" :precision="0"/></a-form-item></div><span>仅需 ¥{{money(variantCash(v))}} ＋ {{money(v.maxFlp)}} FLP</span>
 <div class="variant-image"><span class="variant-image-label">规格图（仅一张）</span><img v-if="v.imageUrl" :src="imageSrc(v.imageUrl)" class="variant-preview" :alt="v.name || '套餐规格图'"/><a-upload accept="image/*" :multiple="false" :show-upload-list="false" :custom-request="options=>uploadVariant(v,options)" :disabled="saving"><a-button :disabled="saving">{{v.imageUrl?'更换规格图':'上传规格图'}}</a-button></a-upload><a-button v-if="v.imageUrl" danger size="small" :disabled="saving" @click="v.imageUrl=''">移除图片</a-button></div></div>
 <a-form-item label="供应商"><a-input v-model:value="form.supplier" :maxlength="120"/></a-form-item><a-form-item label="商品介绍"><a-textarea v-model:value="form.description" :rows="4" :maxlength="8000"/></a-form-item><a-space><a-checkbox v-model:checked="form.presale">标记预售</a-checkbox><a-checkbox v-model:checked="form.published">上架</a-checkbox></a-space></a-form></a-modal>
 <a-modal ok-text="确认发货" cancel-text="取消" :open="!!shipping" title="录入发货信息" :confirm-loading="saving" @cancel="shipping=null" @ok="ship"><a-form layout="vertical"><a-form-item label="物流公司"><a-input v-model:value="logistics.carrier"/></a-form-item><a-form-item label="运单号"><a-input v-model:value="logistics.trackingNumber"/></a-form-item></a-form></a-modal>
 <a-modal ok-text="登记结算" cancel-text="取消" :open="!!settling" title="登记供应商结算" :confirm-loading="saving" @cancel="settling=null" @ok="settle"><p>供应商：{{settling?.supplier}}，应结算成本 ¥{{money(settling?.cost)}}</p><p>完成线下打款后填写结算凭证号。</p><a-input v-model:value="reference" placeholder="转账流水号 / 结算批次号" :maxlength="120"/></a-modal>
 </section>
</template>
<style scoped>
.market-switch{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:0 0 18px}.market-admin{padding:24px;max-width:1600px;margin:auto}.heading{display:flex;align-items:center;justify-content:space-between}h1{margin:0;font-size:24px}.heading p{color:var(--admin-muted);margin:6px 0 20px}.filters{display:flex;gap:12px;margin:0 0 20px;max-width:850px}.filters .ant-input-search{max-width:340px}.table-scroll{overflow-x:auto;background:var(--admin-surface);border-radius:12px;border:1px solid var(--admin-line);margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;background:var(--admin-raised);color:var(--admin-muted);white-space:nowrap}td,th{padding:14px;border-bottom:1px solid var(--admin-line)}td{overflow-wrap:anywhere;min-width:100px}small{color:var(--admin-muted);font-size:10px}.product{display:flex;gap:12px;align-items:center;min-width:220px}.product img{width:52px;height:52px;object-fit:cover;border-radius:8px}.preview{display:block;width:100px;height:100px;object-fit:cover;margin-top:12px}.price-fields{display:flex;flex-wrap:wrap;gap:16px;margin-top:16px}.price-fields>div{flex:1;min-width:160px}.price-fields .ant-input-number{width:100%}
.image-list{display:flex;flex-wrap:wrap;gap:16px}.image-item{display:flex;flex-direction:column;gap:6px;font-size:12px}.image-item .preview{margin:8px 0 0}.image-item>div{display:flex;gap:4px}.variant-heading{display:flex;align-items:center;gap:12px;justify-content:space-between}.variant-help{font-size:12px;color:var(--admin-muted);margin:8px 0 14px}.variant-editor{padding:14px;border:1px solid var(--admin-line);border-radius:10px;margin-bottom:12px;background:var(--admin-raised)}.variant-editor .price-fields>div{min-width:120px}
.variant-image{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px}.variant-image-label{flex-basis:100%;font-size:13px}.variant-preview{width:76px;height:76px;object-fit:contain;border:1px solid var(--admin-line);border-radius:8px;background:var(--admin-surface)}
</style>
