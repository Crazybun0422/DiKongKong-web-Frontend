<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { fetchAdminUsers } from '../services/adminUsers'
import { fetchMemberGifts, grantMemberGift } from '../services/memberGifts'

const keyword = ref(''), users = ref([]), searching = ref(false), selectedCode = ref()
const selectedUser = ref(null), saving = ref(false), confirming = ref(false)
const form = reactive({ unit: 'MONTH', quantity: 1, reason: '' })
const logs = ref([]), loading = ref(false), filterCode = ref('')
const pager = reactive({ current: 1, pageSize: 10, total: 0 })
const errorText = e => e?.response?.data?.message?.zh || e?.message || '操作失败，请稍后重试'
let searchSequence = 0
// Keep the same request ID when a network response is lost, including after a page refresh.
const pendingKey = 'member-gift-pending-request'
const pending = ref(null)
try { pending.value = JSON.parse(sessionStorage.getItem(pendingKey) || 'null') } catch {}
const duration = computed(() => `${form.quantity || 0} ${form.unit === 'YEAR' ? '年' : '个月'}`)
const canSubmit = computed(() => selectedUser.value && Number.isInteger(form.quantity) && form.quantity >= 1
  && form.quantity <= (form.unit === 'YEAR' ? 10 : 120) && form.reason.trim().length > 0 && form.reason.trim().length <= 200)
async function searchUsers() {
  const sequence = ++searchSequence
  searching.value = true
  try {
    const result = await fetchAdminUsers({ keyword: keyword.value, size: 20 })
    if (sequence === searchSequence) users.value = result.content
  } catch (e) { message.error(errorText(e)) }
  finally { if (sequence === searchSequence) searching.value = false }
}
function selectUser(code) { selectedUser.value = users.value.find(user => user.featureCode === code) || null }
function changeUnit() { form.quantity = 1 }
async function loadLogs() {
  loading.value = true
  try {
    const data = await fetchMemberGifts({ page: pager.current, size: pager.pageSize, featureCode: filterCode.value })
    logs.value = data.content; pager.total = data.totalElements
  } catch (e) { message.error(errorText(e)) }
  finally { loading.value = false }
}
function changePage(page) { pager.current = page.current; pager.pageSize = page.pageSize; loadLogs() }
function searchLogs() { pager.current = 1; loadLogs() }
function submit() {
  if (!canSubmit.value || saving.value || confirming.value) return
  const user = selectedUser.value
  const payload = { featureCode: user.featureCode, unit: form.unit, quantity: form.quantity, reason: form.reason.trim() }
  const fingerprint = JSON.stringify(payload)
  if (pending.value?.fingerprint !== fingerprint) {
    const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    pending.value = { fingerprint, requestId: `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}` }
    try { sessionStorage.setItem(pendingKey, JSON.stringify(pending.value)) } catch {}
  }
  const requestId = pending.value.requestId
  confirming.value = true
  Modal.confirm({
    title: '确认赠送会员',
    content: `赠送给 ${user.username}（${user.featureCode}）${duration.value}会员。原因：${payload.reason}。有效会员从原到期日续加，其他用户从当天起算。`,
    okText: '确认赠送', cancelText: '取消',
    onCancel() { confirming.value = false },
    async onOk() {
      saving.value = true
      try {
        const result = await grantMemberGift({ ...payload, requestId })
        user.member = true; user.memberExpireDate = result.afterExpireDate
        message.success(`赠送成功，会员有效期至 ${result.afterExpireDate}`)
        pending.value = null
        try { sessionStorage.removeItem(pendingKey) } catch {}
        form.reason = ''; pager.current = 1
        await loadLogs()
        confirming.value = false
      } catch (e) { message.error(errorText(e)) }
      finally { saving.value = false; confirming.value = false }
    },
  })
}
const columns = [
  { title: '赠送时间', dataIndex: 'createdAt', key: 'createdAt', width: 175 },
  { title: '用户', key: 'user', width: 150 },
  { title: '赠送时长', key: 'duration', width: 105 },
  { title: '原到期日', key: 'before', width: 120 },
  { title: '续期起算日', dataIndex: 'baseDate', width: 120 },
  { title: '赠送后到期日', dataIndex: 'afterExpireDate', width: 130 },
  { title: '操作管理员', dataIndex: 'adminUsername', width: 130 },
  { title: '赠送原因', dataIndex: 'reason', width: 220 },
]
onMounted(loadLogs)
</script>

<template>
  <div class="member-gifts">
    <a-card title="赠送会员">
      <a-form layout="vertical" class="gift-form">
        <a-form-item label="指定用户" required>
          <div class="user-search">
            <a-input v-model:value="keyword" placeholder="输入用户名或6位特征码" :disabled="confirming" @press-enter="searchUsers" />
            <a-button :loading="searching" :disabled="confirming" @click="searchUsers">搜索用户</a-button>
          </div>
          <a-select v-model:value="selectedCode" placeholder="从搜索结果中选定用户" :disabled="confirming" class="user-select" @change="selectUser">
            <a-select-option v-for="user in users" :key="user.featureCode" :value="user.featureCode">{{ user.username }}（{{ user.featureCode }}）</a-select-option>
          </a-select>
          <div v-if="selectedUser" class="selected-user">
            <a-avatar :src="selectedUser.avatarUrl">{{ selectedUser.username?.slice(0,1) }}</a-avatar>
            <span>{{ selectedUser.username }} · {{ selectedUser.featureCode }}<br><small>当前到期日：{{ selectedUser.memberExpireDate || '未设置' }}</small></span>
          </div>
        </a-form-item>
        <a-form-item label="赠送时长" required>
          <a-space wrap>
            <a-radio-group v-model:value="form.unit" :disabled="confirming" @change="changeUnit">
              <a-radio-button value="MONTH">按月赠送</a-radio-button>
              <a-radio-button value="YEAR">按年赠送</a-radio-button>
            </a-radio-group>
            <a-input-number v-model:value="form.quantity" :disabled="confirming" :min="1" :max="form.unit === 'YEAR' ? 10 : 120" :precision="0" />
            <span>{{ form.unit === 'YEAR' ? '年' : '个月' }}</span>
          </a-space>
          <p class="gift-help">按自然月/年计算；有效会员从原到期日续加，已过期或未开通的用户从当天起算。</p>
        </a-form-item>
        <a-form-item label="赠送原因" required>
          <a-textarea v-model:value="form.reason" :disabled="confirming" :maxlength="200" show-count :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="填写赠送原因，记录到操作日志" />
        </a-form-item>
        <a-button type="primary" :loading="saving" :disabled="!canSubmit || confirming" @click="submit">赠送会员</a-button>
      </a-form>
    </a-card>
    <a-card title="赠送日志">
      <div class="log-tools">
        <a-input v-model:value="filterCode" placeholder="按用户特征码查询" allow-clear @press-enter="searchLogs" />
        <a-button @click="searchLogs">查询</a-button>
        <a-button :loading="loading" @click="loadLogs">刷新</a-button>
      </div>
      <a-table :columns="columns" :data-source="logs" :loading="loading" :pagination="{ ...pager, showSizeChanger: true }" :scroll="{ x: 1150 }" row-key="id" size="small" @change="changePage">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">{{ record.createdAt?.replace('T', ' ').slice(0, 19) }}</template>
          <template v-else-if="column.key === 'user'">{{ record.username }}<br><small>{{ record.featureCode }}</small></template>
          <template v-else-if="column.key === 'duration'">{{ record.quantity }} {{ record.unit === 'YEAR' ? '年' : '个月' }}</template>
          <template v-else-if="column.key === 'before'">{{ record.beforeExpireDate || '未设置' }}</template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.member-gifts { display: grid; gap: 20px; }
.gift-form { max-width: 680px; }
.user-search,.log-tools { display: flex; align-items: center; gap: 10px; }
.user-select { width: 100%; margin-top: 12px; }
.selected-user { display: flex; align-items: center; gap: 10px; margin-top: 12px; color: var(--admin-text); }
.selected-user small,.gift-help { color: var(--admin-muted); font-size: 13px; }
.gift-help { margin: 10px 0 0; }
.log-tools { margin-bottom: 16px; flex-wrap: wrap; }
.log-tools .ant-input-affix-wrapper { width: 240px; }
</style>
