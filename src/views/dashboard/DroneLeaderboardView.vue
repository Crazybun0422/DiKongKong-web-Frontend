<script setup>
import { onMounted, ref } from 'vue'
import { fetchDroneGameAdminLeaderboard } from '../../services/droneGame'
import { resolveProfileAsset } from '../../services/profile'

const season = ref(''), selectedSeason = ref(''), rows = ref([]), loading = ref(false), error = ref('')
const pagination = ref({ current: 1, pageSize: 20, total: 0, showSizeChanger: true })
let generation = 0
const columns = [
  { title: '排名', dataIndex: 'rank', key: 'rank', width: 75 },
  { title: '飞手', key: 'player', width: 240 },
  { title: '低空号', dataIndex: 'featureCode', key: 'featureCode', width: 110 },
  { title: '成就积分', dataIndex: 'rating', key: 'rating' },
  { title: '飞行次数', dataIndex: 'races', key: 'races' },
  { title: '完赛次数', dataIndex: 'completions', key: 'completions' },
  { title: '穿环次数', dataIndex: 'gates', key: 'gates' },
  { title: '最佳用时', key: 'bestFinish', width: 120 },
  { title: '最近飞行', key: 'lastFlight', width: 190 },
]
async function load(reset = false) {
  if (reset) pagination.value.current = 1
  const request = ++generation
  loading.value = true; error.value = ''
  try {
    const result = await fetchDroneGameAdminLeaderboard({ season: selectedSeason.value || 'current', page: pagination.value.current, size: pagination.value.pageSize })
    if (request !== generation) return
    season.value = result.season
    rows.value = result.content.map(row => ({ ...row, avatarUrl: resolveProfileAsset(row.avatarUrl) }))
    pagination.value = { ...pagination.value, current: result.page, pageSize: result.size, total: result.totalElements }
  } catch (e) { if (request === generation) { rows.value = []; error.value = e.message || '天梯加载失败，请重试' } }
  finally { if (request === generation) loading.value = false }
}
function changePage(page) { pagination.value = { ...pagination.value, current: page.current, pageSize: page.pageSize }; load() }
onMounted(() => load())
</script>

<template>
  <section class="drone-leaderboard">
    <header>
      <div><h1>涂鸦飞行天梯</h1><p>{{ season || '当前赛季' }} · 个人飞行成就，按积分、完赛次数与最佳用时排名</p></div>
      <div class="filters"><a-date-picker v-model:value="selectedSeason" picker="month" value-format="YYYY-MM" placeholder="当前赛季" @change="load(true)" /><a-button :loading="loading" @click="load()">刷新</a-button></div>
    </header>
    <a-alert v-if="error" :message="error" type="error" show-icon />
    <a-table :columns="columns" :data-source="rows" :loading="loading" :pagination="pagination" row-key="playerId" :scroll="{ x: 1150 }" @change="changePage">
      <template #bodyCell="{ column, record }">
        <div v-if="column.key === 'player'" class="player"><a-avatar :src="record.avatarUrl" :class="{ 'vip-avatar': record.member }">{{ record.name?.slice(0, 1) || '飞' }}</a-avatar><span :class="{ 'vip-name': record.member }">{{ record.name }}</span></div>
        <strong v-else-if="column.key === 'rating'">{{ record.rating }}</strong>
        <span v-else-if="column.key === 'bestFinish'">{{ record.bestFinishMs ? (record.bestFinishMs / 1000).toFixed(2) + ' 秒' : '—' }}</span>
        <span v-else-if="column.key === 'lastFlight'">{{ record.lastFlightAt ? new Date(record.lastFlightAt).toLocaleString() : '—' }}</span>
      </template>
    </a-table>
  </section>
</template>

<style scoped>
.drone-leaderboard { display: grid; gap: 20px; }
header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
h1 { margin: 0 0 8px; font-size: 24px; } p { margin: 0; color: var(--admin-muted); }
.filters, .player { display: flex; align-items: center; gap: 12px; }
.vip-avatar { outline: 2px solid #f59e0b; outline-offset: 2px; box-shadow: 0 0 8px #f59e0b66; }
.vip-name { color: #b77908; font-weight: 600; }
</style>
