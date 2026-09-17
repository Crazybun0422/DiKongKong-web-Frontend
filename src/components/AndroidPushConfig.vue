<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import http from '../services/http'
const { t } = useI18n({ useScope: 'local', messages: {
  'zh-CN': { title:'Android 消息推送', description:'独立管理 Android 设备通知，不使用或消耗微信小程序的订阅授权。', env:'应用环境', dev:'开发版（Debug）', release:'发布版（Release）', enabled:'启用 Android 推送', provider:'推送服务商', none:'尚未接入', appId:'应用标识 / App Key', secret:'服务端凭据', secretHelp:'只在后端保存，不返回给客户端；留空保留同一应用已保存的凭据。', savedSecret:'已保存凭据', checkin:'每日签到提醒', time:'提醒时间（北京时间）', pending:'服务商适配尚未就绪。需要接入服务商、Android SDK 和设备登记后，才能启用真实投递。', ready:'服务端发送通道已配置；每台设备仍需完成登记并允许通知。', save:'保存配置', reload:'刷新', saved:'配置已保存', failed:'操作失败，请检查配置后重试', logs:'最近 100 条发送记录', empty:'暂无记录', category:'提醒类别', status:'状态', recipient:'接收账号', created:'创建时间', accepted:'服务商受理不等于设备送达。记录只标注当前已确认的状态。', campaign:'运营通知', body:'通知内容', send:'发送给已开启此类提醒的 Android 用户', queued:'已加入 Android 发送队列', ops:'运营活动', features:'新功能', custom:'自定义通知', route:'点击后打开的页面', secretNotice:'开发版和发布版的配置分别保存。' },
  en: { title:'Android notifications', description:'Manage Android device notifications independently of WeChat subscription consent.', env:'Environment', dev:'Development (Debug)', release:'Production (Release)', enabled:'Enable Android push', provider:'Provider', none:'Not integrated', appId:'Application ID / App Key', secret:'Server credential', secretHelp:'Stored only on the server. Leave blank to retain the credential for the same application.', savedSecret:'Credential saved', checkin:'Daily check-in reminder', time:'Reminder time (Asia/Shanghai)', pending:'Provider integration, Android SDK and device registration are required before delivery can be enabled.', ready:'Server transport configured. Each device still needs registration and notification permission.', save:'Save configuration', reload:'Refresh', saved:'Configuration saved', failed:'Operation failed. Check the configuration and retry.', logs:'Latest 100 delivery records', empty:'No records', category:'Category', status:'Status', recipient:'Recipient', created:'Created', accepted:'Provider acceptance does not confirm delivery to a device.', campaign:'Operational notification', body:'Message', send:'Send to Android users who opted into this category', queued:'Queued for Android delivery', ops:'Operations', features:'New features', custom:'Custom notification', route:'Page to open', secretNotice:'Development and production settings are saved separately.' }
}})
const env=ref('DEV'), loadedEnv=ref(''), loading=ref(false), saving=ref(false), records=ref([]), error=ref(''), feedback=ref('')
const state=reactive({ enabled:false,provider:'NONE',appId:'',credential:'',credentialConfigured:false,checkinEnabled:false,checkinTime:'20:00',transportReady:false,availableProviders:[] })
const campaign=reactive({ category:'OPS_ACTIVITY', title:'', body:'', route:'packages/social/notifications/index' })
let generation=0
async function load(){const current=++generation, environment=env.value;loading.value=true;error.value='';feedback.value='';try{
 const [c,l]=await Promise.all([http.get('/auth/android/push/config',{params:{environment}}),http.get('/auth/android/push/deliveries',{params:{environment}})])
 if(!c.data?.success||!l.data?.success)throw Error()
 if(current===generation){Object.assign(state,c.data.data,{credential:''});records.value=l.data.data||[];loadedEnv.value=environment}
}catch{if(current===generation)error.value=t('failed')}finally{if(current===generation)loading.value=false}}
async function save(){if(loading.value||saving.value||loadedEnv.value!==env.value)return;saving.value=true;error.value='';feedback.value='';try{
 const {data}=await http.put('/auth/android/push/config',{enabled:state.enabled,provider:state.provider,appId:state.appId,credential:state.credential,checkinEnabled:state.checkinEnabled,checkinTime:state.checkinTime},{params:{environment:env.value}})
 if(!data?.success)throw Error();Object.assign(state,data.data,{credential:''});feedback.value=t('saved');message.success(t('saved'))
}catch{error.value=t('failed')}finally{saving.value=false}}
let requestId=''
async function send(){if(!state.transportReady||saving.value||loading.value||loadedEnv.value!==env.value)return;saving.value=true;error.value='';requestId ||= crypto.randomUUID();try{
 const {data}=await http.post('/auth/android/push/campaigns',{...campaign,requestId},{params:{environment:env.value}})
 if(!data?.success)throw Error();feedback.value=t('queued');requestId='';message.success(t('queued'))
}catch{error.value=t('failed')}finally{saving.value=false}}
watch(campaign,()=>{requestId=''});watch(env,load);onMounted(load)
</script>
<template>
 <a-card :title="t('title')">
  <p>{{t('description')}}</p>
  <a-radio-group v-model:value="env" :disabled="loading||saving"><a-radio-button value="DEV">{{t('dev')}}</a-radio-button><a-radio-button value="RELEASE">{{t('release')}}</a-radio-button></a-radio-group>
  <p style="margin-top:12px">{{t('secretNotice')}}</p>
  <a-alert :type="state.transportReady?'success':'info'" :message="t(state.transportReady?'ready':'pending')" show-icon style="margin:16px 0" />
  <a-form layout="vertical" :model="state" @finish="save">
   <a-form-item :label="t('enabled')"><a-switch v-model:checked="state.enabled" :disabled="loading||saving||!state.availableProviders.length" /></a-form-item>
   <a-form-item :label="t('provider')"><a-select v-model:value="state.provider" :disabled="loading||saving"><a-select-option value="NONE">{{t('none')}}</a-select-option><a-select-option v-for="p in state.availableProviders" :key="p" :value="p">{{p}}</a-select-option></a-select></a-form-item>
   <template v-if="state.provider!=='NONE'">
    <a-form-item :label="t('appId')"><a-input v-model:value="state.appId" :maxlength="256" :disabled="loading||saving" /></a-form-item>
    <a-form-item :label="t('secret')" :help="t('secretHelp')"><a-input-password v-model:value="state.credential" autocomplete="new-password" :placeholder="state.credentialConfigured?t('savedSecret'):''" :disabled="loading||saving" /></a-form-item>
   </template>
   <a-form-item :label="t('checkin')"><a-switch v-model:checked="state.checkinEnabled" :disabled="loading||saving" /></a-form-item>
   <a-form-item :label="t('time')"><a-input v-model:value="state.checkinTime" type="time" :disabled="loading||saving" style="width:160px" /></a-form-item>
   <a-space><a-button type="primary" html-type="submit" :loading="saving" :disabled="loading||loadedEnv!==env">{{t('save')}}</a-button><a-button @click="load" :disabled="loading||saving">{{t('reload')}}</a-button></a-space>
  </a-form>
  <a-alert v-if="error" type="error" :message="error" style="margin-top:16px" /><a-alert v-if="feedback" type="success" :message="feedback" style="margin-top:16px" />
 </a-card>
 <a-card :title="t('campaign')" style="margin-top:20px">
  <a-form :model="campaign" layout="vertical" @finish="send">
   <a-form-item :label="t('category')"><a-select v-model:value="campaign.category" :disabled="saving"><a-select-option value="OPS_ACTIVITY">{{t('ops')}}</a-select-option><a-select-option value="NEW_FEATURE">{{t('features')}}</a-select-option><a-select-option value="CUSTOM_TEMPLATE">{{t('custom')}}</a-select-option></a-select></a-form-item>
   <a-form-item :label="t('title')"><a-input v-model:value="campaign.title" :maxlength="64" :disabled="saving" /></a-form-item><a-form-item :label="t('body')"><a-textarea v-model:value="campaign.body" :maxlength="240" :disabled="saving" /></a-form-item>
   <a-form-item :label="t('route')"><a-input v-model:value="campaign.route" :disabled="saving" /></a-form-item>
   <a-button type="primary" html-type="submit" :loading="saving" :disabled="!state.transportReady||loading||loadedEnv!==env||!campaign.title.trim()||!campaign.body.trim()">{{t('send')}}</a-button>
  </a-form>
 </a-card>
 <a-card :title="t('logs')" style="margin-top:20px"><p>{{t('accepted')}}</p>
  <a-table :data-source="records" row-key="_id" :loading="loading" :pagination="{pageSize:10}" :locale="{emptyText:t('empty')}" :columns="[{title:t('category'),dataIndex:'category'},{title:t('recipient'),dataIndex:'featureCode'},{title:t('status'),dataIndex:'status'},{title:t('created'),dataIndex:'createdAt'}]" />
 </a-card>
</template>
