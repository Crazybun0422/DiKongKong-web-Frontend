<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  DatabaseOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons-vue'
import { fetchFlpPool, saveFlpPool } from '../../services/flp'

const loading = ref(false)
const saving = ref(false)
const MAX_LOTTERY_REWARD_ITEMS = 32
const updatedAt = ref('')
const totals = reactive({
  remainingTotal: 0,
  issuedTotal: 0,
  destroyedTotal: 0,
})
const form = reactive({
  totalSupply: 9600000,
  checkinStandardReward: 0.1,
  checkinBonusReward: 0.2,
  lotteryRewards: Array.from({ length: 8 }, () => 0),
  friendRegisterReward: 0,
  friendFirstMarkerReward: 0,
  memberInviteMonthlyReward: 3,
  memberInviteYearlyReward: 30,
  pinApprovedAReward: 0,
  pinApprovedBReward: 0,
  broadcastLike10Reward: 0.2,
  broadcastLike20Reward: 1,
  commentLikeRewardThreshold: 5,
  commentLikeRewardFlp: 0.2,
})

const metricItems = computed(() => [
  { key: 'remaining', label: '剩余总量', value: totals.remainingTotal, tone: 'remaining' },
  { key: 'issued', label: '已生产', value: totals.issuedTotal, tone: 'issued' },
  { key: 'destroyed', label: '已销毁', value: totals.destroyedTotal, tone: 'destroyed' },
  { key: 'supply', label: '设定总量', value: form.totalSupply, tone: 'supply' },
])

const formatFlp = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 8 }).format(number)
}

const applyPayload = (payload = {}) => {
  const config = payload.config || {}
  Object.keys(form).forEach((key) => {
    if (key === 'lotteryRewards') return
    if (config[key] !== undefined && config[key] !== null) {
      form[key] = Number(config[key])
    }
  })
  if (Array.isArray(config.lotteryRewards) && config.lotteryRewards.length) {
    form.lotteryRewards = config.lotteryRewards.map((item) => Number(item) || 0)
  }
  totals.remainingTotal = Number(payload.remainingTotal) || 0
  totals.issuedTotal = Number(payload.issuedTotal) || 0
  totals.destroyedTotal = Number(payload.destroyedTotal) || 0
  updatedAt.value = config.updatedAt || ''
}

const loadPool = async () => {
  loading.value = true
  try {
    applyPayload(await fetchFlpPool())
  } catch (error) {
    console.error('Failed to load FLP pool', error)
    message.error('FLP矿池加载失败')
  } finally {
    loading.value = false
  }
}

const toNumber = (value) => Number(value) || 0

const addLotteryReward = () => {
  if (form.lotteryRewards.length >= MAX_LOTTERY_REWARD_ITEMS) return
  form.lotteryRewards.push(0)
}

const removeLotteryReward = (index) => {
  if (form.lotteryRewards.length <= 1) {
    message.warning('至少保留一个奖项')
    return
  }
  form.lotteryRewards.splice(index, 1)
}

const submit = async () => {
  if (toNumber(form.totalSupply) < totals.issuedTotal + totals.destroyedTotal) {
    message.warning('设定总量不能小于已生产与已销毁数量之和')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      totalSupply: toNumber(form.totalSupply),
      lotteryRewards: form.lotteryRewards.map(toNumber),
    }
    Object.keys(payload).forEach((key) => {
      if (key !== 'lotteryRewards') payload[key] = toNumber(payload[key])
    })
    applyPayload(await saveFlpPool(payload))
    message.success('FLP矿池配置已保存')
  } catch (error) {
    console.error('Failed to save FLP pool', error)
    message.error(error?.response?.data?.message?.zh || 'FLP矿池保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadPool)
</script>

<template>
  <div class="flp-pool-page">
    <header class="page-header">
      <div>
        <div class="page-kicker"><DatabaseOutlined /> FLP POOL</div>
        <h1>FLP矿池管理</h1>
        <p>统一管理发行上限与奖励来源，生产和销毁数据以用户账本为准。</p>
      </div>
      <div class="header-actions">
        <span v-if="updatedAt" class="updated-at">更新于 {{ new Date(updatedAt).toLocaleString() }}</span>
        <a-button :loading="loading" @click="loadPool"><ReloadOutlined />刷新</a-button>
        <a-button type="primary" :loading="saving" @click="submit"><SaveOutlined />保存配置</a-button>
      </div>
    </header>

    <a-spin :spinning="loading">
      <section class="metric-strip" aria-label="FLP矿池概览">
        <div v-for="item in metricItems" :key="item.key" :class="['metric-item', `is-${item.tone}`]">
          <span>{{ item.label }}</span>
          <strong>{{ formatFlp(item.value) }}</strong>
          <small>FLP</small>
        </div>
      </section>

      <section class="config-surface">
        <div class="config-section supply-section">
          <div class="section-copy">
            <h2>矿池总量</h2>
            <p>剩余总量 = 设定总量 - 已生产 - 已销毁，额度耗尽后停止发放。</p>
          </div>
          <a-input-number
            v-model:value="form.totalSupply"
            class="supply-input"
            :min="totals.issuedTotal + totals.destroyedTotal"
            :precision="8"
            :step="1000"
            addon-after="FLP"
          />
        </div>

        <div class="config-section">
          <div class="section-copy">
            <h2>签到与抽奖</h2>
            <p>这里只维护FLP数额；奖品类型、素材和概率仍在抽奖设置中管理。</p>
          </div>
          <div class="field-grid field-grid--two">
            <label class="field-item">
              <span>普通签到</span>
              <a-input-number v-model:value="form.checkinStandardReward" :min="0" :precision="8" :step="0.1" addon-after="FLP" />
            </label>
            <label class="field-item">
              <span>周三/周六签到</span>
              <a-input-number v-model:value="form.checkinBonusReward" :min="0" :precision="8" :step="0.1" addon-after="FLP" />
            </label>
          </div>
          <div class="lottery-grid">
            <div v-for="(_, index) in form.lotteryRewards" :key="index" class="lottery-reward-field">
              <div class="lottery-reward-header">
                <span>奖项{{ index + 1 }}</span>
                <a-tooltip title="删除奖项">
                  <a-button
                    type="text"
                    danger
                    size="small"
                    :disabled="form.lotteryRewards.length <= 1"
                    @click="removeLotteryReward(index)"
                  >
                    <DeleteOutlined />
                  </a-button>
                </a-tooltip>
              </div>
              <a-input-number
                v-model:value="form.lotteryRewards[index]"
                class="lottery-reward-input"
                :min="0"
                :precision="8"
                :step="0.1"
              />
            </div>
            <a-button
              class="lottery-add-button"
              type="dashed"
              :disabled="form.lotteryRewards.length >= MAX_LOTTERY_REWARD_ITEMS"
              @click="addLotteryReward"
            >
              <PlusOutlined />新增奖项
            </a-button>
          </div>
        </div>

        <div class="config-section">
          <div class="section-copy">
            <h2>邀请奖励</h2>
            <p>邀请关系满足对应条件后，奖励发放到邀请人账户。</p>
          </div>
          <div class="field-grid">
            <label class="field-item"><span>好友注册</span><a-input-number v-model:value="form.friendRegisterReward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>好友首个标记</span><a-input-number v-model:value="form.friendFirstMarkerReward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>好友开通月度会员</span><a-input-number v-model:value="form.memberInviteMonthlyReward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>好友开通年度会员</span><a-input-number v-model:value="form.memberInviteYearlyReward" :min="0" :precision="8" addon-after="FLP" /></label>
          </div>
        </div>

        <div class="config-section">
          <div class="section-copy">
            <h2>内容与共建</h2>
            <p>标记审核和广播点赞达标奖励统一从矿池生产。</p>
          </div>
          <div class="field-grid">
            <label class="field-item"><span>标记审核 A 级</span><a-input-number v-model:value="form.pinApprovedAReward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>标记审核 B 级</span><a-input-number v-model:value="form.pinApprovedBReward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>广播点赞超过 10</span><a-input-number v-model:value="form.broadcastLike10Reward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>广播点赞超过 20</span><a-input-number v-model:value="form.broadcastLike20Reward" :min="0" :precision="8" addon-after="FLP" /></label>
            <label class="field-item"><span>评论点赞门槛</span><a-input-number v-model:value="form.commentLikeRewardThreshold" :min="0" :precision="0" addon-before="大于" /></label>
            <label class="field-item"><span>评论点赞奖励</span><a-input-number v-model:value="form.commentLikeRewardFlp" :min="0" :precision="8" addon-after="FLP" /></label>
          </div>
        </div>

        <div class="member-policy">
          <SafetyCertificateOutlined />
          <div><strong>会员奖励倍增</strong><span>会员状态有效且未过期时，所有FLP奖励按基础数额的2倍发放。</span></div>
          <a-tag color="gold">2X</a-tag>
        </div>
      </section>
    </a-spin>
  </div>
</template>

<style scoped>
.flp-pool-page { color: #171717; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.page-kicker { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px; font-weight: 700; }
.page-header h1 { margin: 6px 0 4px; font-size: 28px; letter-spacing: 0; }
.page-header p, .section-copy p { margin: 0; color: #6b7280; line-height: 1.6; }
.header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.updated-at { color: #8b8f97; font-size: 12px; }
.metric-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); background: #111827; color: #fff; border: 1px solid #111827; border-radius: 8px; overflow: hidden; }
.metric-item { min-width: 0; padding: 20px 22px; position: relative; }
.metric-item + .metric-item { border-left: 1px solid rgba(255,255,255,.16); }
.metric-item span { display: block; color: #cbd5e1; font-size: 13px; }
.metric-item strong { display: inline-block; margin-top: 8px; max-width: calc(100% - 36px); overflow: hidden; text-overflow: ellipsis; font-size: 26px; line-height: 1.1; }
.metric-item small { margin-left: 6px; color: #94a3b8; }
.metric-item.is-issued strong { color: #86efac; }
.metric-item.is-destroyed strong { color: #fca5a5; }
.config-surface { margin-top: 20px; background: #fff; border: 1px solid #d9dde4; border-radius: 8px; }
.config-section { display: grid; grid-template-columns: minmax(220px, .75fr) minmax(0, 2fr); gap: 34px; padding: 26px 28px; }
.config-section + .config-section { border-top: 1px solid #e8eaf0; }
.section-copy h2 { margin: 0 0 6px; font-size: 17px; }
.supply-section { align-items: center; }
.supply-input { width: min(420px, 100%); }
.field-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 16px; }
.field-grid--two { grid-template-columns: repeat(2, minmax(180px, 1fr)); margin-bottom: 18px; }
.field-item { display: flex; flex-direction: column; gap: 7px; color: #3f4650; font-size: 13px; min-width: 0; }
.field-item :deep(.ant-input-number-group-wrapper), .field-item :deep(.ant-input-number) { width: 100%; }
.lottery-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 14px; }
.lottery-reward-field { min-width: 0; padding: 12px; border: 1px solid #e1e5eb; border-radius: 6px; background: #fafbfc; }
.lottery-reward-header { display: flex; align-items: center; justify-content: space-between; min-height: 28px; margin-bottom: 8px; color: #303742; font-size: 14px; font-weight: 600; }
.lottery-reward-header :deep(.ant-btn) { width: 28px; height: 28px; padding: 0; }
.lottery-reward-input { width: 100%; }
.lottery-reward-input :deep(.ant-input-number-input) { height: 42px; font-size: 15px; }
.lottery-add-button { min-height: 94px; }
.member-policy { display: flex; align-items: center; gap: 12px; margin: 0 28px 26px; padding: 14px 16px; border: 1px solid #e5c66b; border-radius: 6px; background: #fffaf0; color: #8a6500; }
.member-policy > span:first-child { font-size: 22px; }
.member-policy div { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.member-policy div span { color: #7c6a34; font-size: 13px; }
@media (max-width: 1100px) { .metric-strip { grid-template-columns: repeat(2, 1fr); } .metric-item:nth-child(3) { border-left: 0; border-top: 1px solid rgba(255,255,255,.16); } .metric-item:nth-child(4) { border-top: 1px solid rgba(255,255,255,.16); } .field-grid { grid-template-columns: repeat(2, 1fr); } .lottery-grid { grid-template-columns: repeat(2, minmax(150px, 1fr)); } }
@media (max-width: 720px) { .page-header { align-items: flex-start; flex-direction: column; } .header-actions { justify-content: flex-start; } .metric-strip { grid-template-columns: 1fr; } .metric-item + .metric-item { border-left: 0; border-top: 1px solid rgba(255,255,255,.16); } .config-section { grid-template-columns: 1fr; gap: 16px; padding: 22px 18px; } .field-grid, .field-grid--two { grid-template-columns: 1fr; } .lottery-grid { grid-template-columns: 1fr; } .member-policy { margin: 0 18px 20px; align-items: flex-start; } }
</style>
