<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import AnnouncementPreview from './AnnouncementPreview.vue'
import { emptyAnnouncement, cleanAnnouncementHtml, uploadAnnouncementFile, isAnnouncementFile, publicAnnouncementUrl } from '../../utils/noFlyAnnouncement'
const props = defineProps({modelValue:Object,sourceUrl:String,title:String,disabled:Boolean})
const emit=defineEmits(['update:modelValue','busy'])
const editor=ref(null), imageInput=ref(null), fileInput=ref(null), htmlInput=ref(null), preview=ref(false), uploading=ref(false), replaceUrl=ref('')
let disposed=false
onBeforeUnmount(()=>{disposed=true})
const value=computed(()=>({...emptyAnnouncement(),...props.modelValue,title:props.modelValue?.title||props.title||'',sourceUrl:props.modelValue?.sourceUrl||props.sourceUrl||''}))
const busy=computed(()=>props.disabled || uploading.value)
function update(patch){emit('update:modelValue',{...value.value,...patch})}
function sync(){if(editor.value) update({content:cleanAnnouncementHtml(editor.value.innerHTML)})}
watch(()=>props.modelValue?.content,async html=>{await nextTick();if(editor.value && document.activeElement!==editor.value)editor.value.innerHTML=cleanAnnouncementHtml(html,true)},{immediate:true})
const remoteImages=computed(()=>{const d=new DOMParser().parseFromString(value.value.content||'','text/html');return [...new Set(Array.from(d.images).map(x=>x.getAttribute('src')).filter(x=>!isAnnouncementFile(x)))]})
function command(name,arg){if(busy.value)return;editor.value?.focus();document.execCommand(name,false,arg);sync()}
function link(){const url=window.prompt('链接地址（PDF等文件请使用下方上传附件）','https://');if(publicAnnouncementUrl(url))command('createLink',url)}
function initialize(){update({title:value.value.title||props.title||'',sourceUrl:value.value.sourceUrl||props.sourceUrl||'',content:value.value.content||'<h2>管制时间</h2><p></p><h2>管制范围</h2><p></p><h2>公告正文</h2><p></p>'})}
async function upload(event,image){const file=event.target.files?.[0];event.target.value='';if(!file)return;const original=props.modelValue;uploading.value=true;emit('busy',true)
  try{const stored=await uploadAnnouncementFile(file)
    if(disposed || props.modelValue!==original)return
    if(image){
      if(!stored.mediaType.startsWith('image/'))throw new Error('请选择图片')
      let content=value.value.content||''
      if(replaceUrl.value){const d=new DOMParser().parseFromString(content,'text/html');Array.from(d.images).filter(n=>n.getAttribute('src')===replaceUrl.value).forEach(n=>n.setAttribute('src',stored.url));content=d.body.innerHTML}
      else content+=`<p><img src="${stored.url}" alt="公告配图"></p>`
      update({content});if(editor.value)editor.value.innerHTML=cleanAnnouncementHtml(content,true)
    }else update({attachments:[...value.value.attachments,stored]})
    message.success('已上传至服务器')
  }catch(e){message.error(e?.response?.data?.message?.zh||e.message||'上传失败')}
  finally{replaceUrl.value='';uploading.value=false;emit('busy',false)}
}
async function paste(event){if(busy.value)return;event.preventDefault();const data=event.clipboardData;const files=Array.from(data?.files||[]);if(files.length){await upload({target:{files,value:''}},true);return}
  const html=data?.getData('text/html');const plain=data?.getData('text/plain')||'';const d=document.createElement('div');d.textContent=plain
  command('insertHTML',cleanAnnouncementHtml(html||d.innerHTML.replace(/\n/g,'<br>')))
}
async function importHtml(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>500000){message.error('正文文件过大');return}
  const d=new DOMParser().parseFromString(await file.text(),'text/html');const main=d.querySelector('article,main')||d.body;update({content:cleanAnnouncementHtml(main.innerHTML)})
}
</script>
<template>
  <section class="announcement-editor">
    <a-space wrap><a-button :disabled="busy" @click="initialize">使用公告版式</a-button><a-button :disabled="busy" @click="htmlInput?.click()">导入正文 HTML</a-button><a-button @click="preview=true">查看公告</a-button></a-space>
    <p class="editor-hint">粘贴网页主要内容，保留段落、图片和链接。图片、PDF与文档附件须上传至服务器，原文链接固定显示在页尾。</p>
    <div class="announcement-fields">
      <a-input :value="value.title" :disabled="busy" :maxlength="200" placeholder="公告标题" @update:value="update({title:$event})" />
      <a-input :value="value.publisher" :disabled="busy" :maxlength="200" placeholder="发布单位" @update:value="update({publisher:$event})" />
      <a-input :value="value.publishedAt" :disabled="busy" :maxlength="80" placeholder="发布日期，如 2026-10-05" @update:value="update({publishedAt:$event})" />
    </div>
    <div class="editor-toolbar"><button type="button" :disabled="busy" @mousedown.prevent="command('bold')">加粗</button><button type="button" :disabled="busy" @mousedown.prevent="command('formatBlock','h2')">小标题</button><button type="button" :disabled="busy" @mousedown.prevent="command('formatBlock','p')">正文</button><button type="button" :disabled="busy" @mousedown.prevent="command('insertUnorderedList')">列表</button><button type="button" :disabled="busy" @mousedown.prevent="link">链接</button><button type="button" :disabled="busy" @click="replaceUrl='';imageInput?.click()">上传配图</button><button type="button" :disabled="busy" @click="fileInput?.click()">上传附件</button></div>
    <div ref="editor" class="body-editor" :contenteditable="!busy" role="textbox" aria-label="公告正文" aria-multiline="true" @input="sync" @paste="paste" @blur="sync" @drop.prevent />
    <div v-for="url in remoteImages" :key="url" class="pending-image"><span>待转存图片：{{ url || '无地址' }}</span><a-button size="small" :disabled="busy" @click="replaceUrl=url;imageInput?.click()">选择本地图片替换</a-button></div>
    <div v-for="(file,i) in value.attachments" :key="file.url" class="attachment-row"><a :href="publicAnnouncementUrl(file.url)" target="_blank" rel="noopener noreferrer">{{ file.name }}</a><a-button size="small" danger :disabled="busy" @click="update({attachments:value.attachments.filter((_,index)=>index!==i)})">移除</a-button></div>
    <a-input :value="value.sourceUrl" :disabled="busy" :maxlength="2048" placeholder="原文链接（页尾显示）" @update:value="update({sourceUrl:$event})" />
    <input ref="imageInput" hidden type="file" accept=".png,.jpg,.jpeg,.gif,.webp" @change="upload($event,true)" /><input ref="fileInput" hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp" @change="upload($event,false)" /><input ref="htmlInput" hidden type="file" accept=".html,.htm" @change="importHtml" />
    <a-modal :open="preview" title="公告预览" :width="820" :footer="null" @cancel="preview=false"><AnnouncementPreview :announcement="value" :fallback-title="title" /></a-modal>
  </section>
</template>
<style scoped>
.announcement-editor{border:1px solid #e3eaf2;border-radius:12px;padding:16px;background:#fafcff}.editor-hint{font-size:13px;color:#64748b;line-height:1.7}.announcement-fields{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:12px}.editor-toolbar{display:flex;gap:6px;flex-wrap:wrap;padding:10px;background:#eef3f9;border-radius:8px 8px 0 0}.editor-toolbar button{border:1px solid #d4deea;border-radius:5px;background:white;padding:5px 10px;cursor:pointer}.body-editor{min-height:240px;max-height:600px;overflow:auto;padding:20px;background:white;border:1px solid #d4deea;line-height:1.9;font-size:16px;outline-color:#1677ff}.body-editor :deep(img){max-width:100%;height:auto}.body-editor :deep(table){max-width:100%}.pending-image,.attachment-row{display:flex;gap:12px;justify-content:space-between;align-items:center;margin:12px 0;overflow-wrap:anywhere}.pending-image{color:#a45f12;font-size:12px}.announcement-editor>.ant-input{margin-top:12px}@media(max-width:640px){.announcement-fields{grid-template-columns:1fr}.body-editor{padding:12px}}
</style>
