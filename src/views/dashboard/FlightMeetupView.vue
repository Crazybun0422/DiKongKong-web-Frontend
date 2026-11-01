<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import http from '../../services/http'
import FlightMeetupMessages from '../../components/FlightMeetupMessages.vue'
const boardEvent=ref(null)
const items=ref([]), total=ref(0), page=ref(1), status=ref(''), loading=ref(false), selected=ref(null), detail=ref(null), action=ref('reject'), reason=ref(''), saving=ref(false)
const states={PUBLISHED:'已发布',REJECTED:'已驳回',CANCELLED:'已取消',DELETED:'已删除'}
const columns=[{title:'约飞主题',key:'title',dataIndex:'title'},{title:'发起人',key:'host'},{title:'时间',key:'time'},{title:'集合点',dataIndex:'address'},{title:'人数',key:'count'},{title:'状态',key:'status'},{title:'操作',key:'action',width:285}]
const date=value=>new Date(value).toLocaleString('zh-CN',{hour12:false})
const error=e=>message.error(e?.response?.data?.message?.zh||e.message||'操作失败')
async function load(){loading.value=true;try{const r=await http.get('/flight-meetups/admin',{params:{page:page.value-1,size:20,status:status.value||undefined}});items.value=r.data.data.items;total.value=r.data.data.total;}catch(e){error(e)}finally{loading.value=false}}
function filter(){page.value=1;load()}
async function inspect(row){try{detail.value=(await http.get('/flight-meetups/admin/'+row.id)).data.data}catch(e){error(e)}}
function review(row,type){selected.value=row;action.value=type;reason.value=''}
async function submit(){if(!reason.value.trim())return message.warning('请填写处理原因');saving.value=true;try{await http.post(`/flight-meetups/admin/${selected.value.id}/${action.value}`,{revision:selected.value.revision,reason:reason.value.trim()});message.success('处理成功，已向发起人及参与人发送约飞消息');selected.value=null;await load()}catch(e){error(e);if(e.response?.status===409){selected.value=null;await load()}}finally{saving.value=false}}
onMounted(load)
</script>
<template>
  <section class="meetup-admin">
    <div class="meetup-toolbar"><div><h2>星球约飞管理</h2><p>查看约飞、参与人员、留言板与审核状态。驳回后发起人可修改并重新发布。</p></div><a-space><a-select v-model:value="status" style="width:140px" @change="filter"><a-select-option value="">全部状态</a-select-option><a-select-option v-for="(label,key) in states" :key="key" :value="key">{{label}}</a-select-option></a-select><a-button @click="load">刷新</a-button></a-space></div>
    <a-table :columns="columns" :data-source="items" :loading="loading" row-key="id" :scroll="{x:1100}" :pagination="{current:page,pageSize:20,total,showSizeChanger:false}" @change="p=>{page=p.current;load()}">
      <template #bodyCell="{column,record}">
        <template v-if="column.key==='host'">{{record.host.name}}<div class="meetup-muted">{{record.host.featureCode}}</div></template>
        <template v-else-if="column.key==='time'">{{date(record.startsAt)}}<div class="meetup-muted">至 {{date(record.endsAt)}}</div></template>
        <template v-else-if="column.key==='count'">{{record.joinedCount}} / {{record.capacity}}</template>
        <template v-else-if="column.key==='status'"><a-tag :color="record.status==='REJECTED'?'orange':record.status==='PUBLISHED'?'blue':'default'">{{states[record.status]}}</a-tag><div class="meetup-muted">{{record.reason}}</div></template>
        <template v-else-if="column.key==='action'"><a-space><a-button size="small" @click="inspect(record)">详情</a-button><a-button size="small" @click="boardEvent=record">留言板</a-button><a-button v-if="record.status==='PUBLISHED'" size="small" @click="review(record,'reject')">驳回</a-button><a-button v-if="record.status!=='DELETED'" size="small" danger @click="review(record,'delete')">删除</a-button></a-space></template>
      </template>
    </a-table>
    <a-modal :open="!!selected" :title="action==='reject'?'驳回约飞':'删除约飞'" :confirm-loading="saving" @ok="submit" @cancel="()=>{if(!saving)selected=null}">
      <p>{{selected?.title}}</p><p>{{action==='reject'?'驳回后约飞将下架，发起人可修改并重新发布。':'删除后约飞将下架且不可恢复发布。'}}处理原因会发送给发起人和当前参与人。</p><a-textarea v-model:value="reason" :rows="4" :maxlength="250" show-count placeholder="请输入处理原因" />
    </a-modal>
    <a-drawer :open="!!detail" title="约飞详情" width="min(640px, 100vw)" @close="detail=null">
      <template v-if="detail"><h3>{{detail.title}}</h3><a-button @click="boardEvent=detail">查看留言板</a-button><p>{{date(detail.startsAt)}} — {{date(detail.endsAt)}}</p><p>{{detail.address}} · 范围 {{detail.radiusMeters/1000}} km</p><p>集合点（GCJ-02）：{{detail.latitude}}, {{detail.longitude}}</p><p>{{detail.nearbyVisible?'附近可见':'仅通过卡片邀请'}} · {{states[detail.status]}}</p><p v-if="detail.reason">处理原因：{{detail.reason}}</p><a-divider>参与人员（{{detail.joinedCount}} / {{detail.capacity}}）</a-divider><a-list :data-source="detail.participants"><template #renderItem="{item}"><a-list-item><a-list-item-meta :title="item.name+' · '+item.featureCode" :description="(item.aircraft||'发起人')+(item.message?' · '+item.message:'')"><template #avatar><a-avatar :src="item.avatarUrl">{{item.name?.slice(0,1)}}</a-avatar></template></a-list-item-meta></a-list-item></template></a-list></template>
    </a-drawer>
    <FlightMeetupMessages :event="boardEvent" @close="boardEvent=null" />
  </section>
</template>
<style scoped>
.meetup-admin{padding:24px;background:var(--admin-surface);border-radius:12px}.meetup-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap}.meetup-toolbar h2{margin:0 0 8px}.meetup-toolbar p,.meetup-muted{color:var(--admin-muted);font-size:12px;margin:4px 0}.meetup-muted{max-width:220px;overflow-wrap:anywhere}
</style>
