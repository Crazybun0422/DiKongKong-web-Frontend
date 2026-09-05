<script setup>
import COS from 'cos-js-sdk-v5'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  banAdminPlanetBroadcastAuthor,
  createAdminPlanetBroadcast,
  createAdminPlanetBroadcastEventSource,
  deleteAdminPlanetBroadcast,
  deleteAdminPlanetBroadcastComment,
  fetchAdminPlanetBroadcasts,
  fetchAdminPlanetBroadcastComments,
  fetchAdminPlanetBroadcastGovernanceConfig,
  fetchAdminPlanetBroadcastQuotaConfig,
  pushAdminPlanetBroadcast,
  unbanAdminPlanetBroadcastAuthor,
  updateAdminPlanetBroadcastGovernanceConfig,
  updateAdminPlanetBroadcastQuotaConfig,
  updateAdminPlanetBroadcastPin,
} from '../services/planetBroadcasts'
import { fetchTencentCosSts } from '../services/config'
import { buildDownloadUrl, extractObjectName, uploadPublicFile } from '../services/files'
import { resolveProfileAsset } from '../services/profile'
import OfficialAccountMaterialSettings from './OfficialAccountMaterialSettings.vue'

const loading = ref(false)
const rows = ref([])
const page = ref(0)
const size = ref(20)
const total = ref(0)
const streamStatus = ref('连接中')
const commentsLoading = ref(false)
const detailVisible = ref(false)
const activeDetailRecord = ref(null)
const commentRows = ref([])
const quotaConfigLoading = ref(false)
const quotaEnforced = ref(false)
const categoryFilter = ref('ALL')
const governanceStatusFilter = ref('VOTING')
const governanceConfigLoading = ref(false)
const governanceConfigSaving = ref(false)
const governanceForm = ref({
  participationRate: 5,
  agreeRate: 51,
  voteCostPerVoteFlp: 0.001,
})
const governanceUpdatedAt = ref('')
const publishVisible = ref(false)
const publishing = ref(false)
const publishForm = ref({
  content: '',
})
const publishImages = ref([])
const publishImageUploading = ref(false)
let eventSource = null
let tencentCosStsPromise = null
const mediaUrlCache = new Map()
const SYSTEM_BROADCAST_FEATURE_CODE = '__PLANET_ADMIN__'
const MAX_PUBLISH_IMAGE_COUNT = 5
const COS_HOST_PATTERN = /^(?<bucket>.+)\.cos\.(?<region>[^.]+)\.(?:myqcloud\.com|tencentcos\.cn)$/i
const LEGACY_BROADCAST_CATEGORY_OPTIONS = [
  { value: 'GOVERNANCE_VOTE', label: '星球治理投票', color: 'magenta' },
  { value: 'FLY_TOGETHER', label: '约飞广播', color: 'blue' },
  { value: 'AIRSPACE_ALERT', label: '空域提醒', color: 'red' },
  { value: 'FLIGHT_STATUS', label: '飞行动态', color: 'green' },
  { value: 'AERIAL_SHARE', label: '航拍分享', color: 'cyan' },
  { value: 'FLIGHT_STORY', label: '飞行糗事', color: 'orange' },
  { value: 'DEVICE_DISCUSSION', label: '设备交流', color: 'purple' },
  { value: 'PILOT_RECRUITMENT', label: '飞手招募', color: 'gold' },
  { value: 'CASUAL_CHAT', label: '随便聊聊', color: 'default' },
]
const BROADCAST_CATEGORY_OPTIONS = [
  { value: 'WORK_SHARE', label: '作品分享', color: 'cyan' },
  { value: 'ASK_FRIEND', label: '问飞友', color: 'blue' },
  { value: 'INTELLIGENCE_GROUP', label: '情报组', color: 'green' },
  { value: 'WHITE_PAPER', label: '白皮书', color: 'purple' },
  { value: 'GOVERNANCE_VOTE', label: '星球治理投票', color: 'magenta' },
  { value: 'PLANET_DYNAMIC', label: '星球动态', color: 'gold' },
]
const BROADCAST_CATEGORY_ALIAS_MAP = {
  AERIAL_SHARE: 'WORK_SHARE',
  FLY_TOGETHER: 'ASK_FRIEND',
  DEVICE_DISCUSSION: 'ASK_FRIEND',
  PILOT_RECRUITMENT: 'ASK_FRIEND',
  CASUAL_CHAT: 'ASK_FRIEND',
  AIRSPACE_ALERT: 'INTELLIGENCE_GROUP',
  FLIGHT_STATUS: 'INTELLIGENCE_GROUP',
  FLIGHT_STORY: 'INTELLIGENCE_GROUP',
}
const BROADCAST_CATEGORY_FILTER_OPTIONS = [
  { value: 'ALL', label: '全部' },
  ...BROADCAST_CATEGORY_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
]

const GOVERNANCE_STATUS_FILTER_OPTIONS = [
  { value: 'VOTING', label: '投票中' },
  { value: 'PASSED', label: '通过' },
  { value: 'FAILED', label: '失效' },
]

const pinnedCount = computed(() => rows.value.filter((item) => item.pinned).length)
const governanceFilterVisible = computed(() => categoryFilter.value === 'GOVERNANCE_VOTE')

const columns = [
  { title: '内容', key: 'content', dataIndex: 'content' },
  { title: '类型', key: 'category', dataIndex: 'category', width: 120 },
  { title: '播报人', key: 'author', dataIndex: 'authorName', width: 180 },
  { title: '评论', key: 'commentCount', dataIndex: 'commentCount', width: 90 },
  { title: '点赞', key: 'likeCount', dataIndex: 'likeCount', width: 90 },
  { title: '时间', key: 'createdAt', dataIndex: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 320 },
]

const formatTime = (value) => {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

const summarize = (record) => {
  const content = String(record?.content || '').trim()
  if (content) return content
  const media = Array.isArray(record?.media) ? record.media : []
  if (!media.length) return '星球广播'
  const type = String(media[0]?.type || '').toUpperCase()
  if (type === 'VOICE') return '语音广播'
  if (type === 'CHANNEL_VIDEO') return '视频号视频'
  if (type === 'VIDEO') return '录像广播'
  if (type === 'IMAGE') return '图片广播'
  if (type === 'EMOJI') return '表情广播'
  return '星球广播'
}

const authorLabel = (record) =>
  String(record?.authorName || record?.authorNickname || record?.nickname || '星球用户').trim()

const authorAvatar = (record) => (isSystemBroadcast(record) ? '' : resolveProfileAsset(record?.authorAvatarUrl || record?.avatarUrl || ''))

const authorInitial = (record) => authorLabel(record).slice(0, 1)

const isAuthorBanned = (record) => String(record?.authorStatus || '').toUpperCase() === 'BANNED'

const isSystemBroadcast = (record) => String(record?.authorFeatureCode || '').trim() === SYSTEM_BROADCAST_FEATURE_CODE

const formatLocationVisibility = (record) => {
  const visibility = String(record?.locationVisibility || '').toUpperCase()
  if (visibility === 'HIDDEN') return '隐藏'
  if (visibility === 'CITY') return '精确到县市'
  if (visibility === 'EXACT') return '具体位置'
  return record?.locationText || record?.latitude || record?.longitude ? '具体位置' : '隐藏'
}

const displaySummary = (record) => summarize(record)

const normalizeBroadcastCategory = (value) => {
  const text = String(value || 'WORK_SHARE').trim().toUpperCase()
  if (BROADCAST_CATEGORY_ALIAS_MAP[text]) return BROADCAST_CATEGORY_ALIAS_MAP[text]
  return BROADCAST_CATEGORY_OPTIONS.some((item) => item.value === text) ? text : 'WORK_SHARE'
}

const broadcastCategoryMeta = (record) =>
  BROADCAST_CATEGORY_OPTIONS.find((item) => item.value === normalizeBroadcastCategory(record?.category)) ||
  BROADCAST_CATEGORY_OPTIONS[BROADCAST_CATEGORY_OPTIONS.length - 1]

const broadcastCategoryLabel = (record) => broadcastCategoryMeta(record).label

const broadcastCategoryColor = (record) => broadcastCategoryMeta(record).color

const isGovernanceBroadcast = (record) => normalizeBroadcastCategory(record?.category) === 'GOVERNANCE_VOTE'

const governanceVoteSummary = (record) => record?.governanceVote || null

const formatFlpAmount = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toFixed(8).replace(/\.?0+$/, '')
}

const resolveGovernancePercentValue = (value, numerator, denominator) => {
  let number = Number(value)
  const count = Number(numerator)
  const total = Number(denominator)
  if ((!Number.isFinite(number) || number === 0) && count > 0 && total > 0) {
    number = (count * 100) / total
  }
  return Number.isFinite(number) && number > 0 ? number : 0
}

const formatGovernancePercent = (value, numerator, denominator) => {
  const number = resolveGovernancePercentValue(value, numerator, denominator)
  if (number <= 0) return '0%'
  const decimals = number >= 1
    ? (Number.isInteger(number) ? 0 : 2)
    : Math.min(12, Math.max(2, Math.ceil(-Math.log10(number)) + 2))
  const fixed = number.toFixed(decimals).replace(/\.?0+$/, '')
  return fixed !== '0' ? `${fixed}%` : `${number.toPrecision(2)}%`
}

const governanceStartedFlpTotal = (record) => {
  const summary = governanceVoteSummary(record)
  return Number(summary?.startedFlpTotal ?? summary?.totalIssuedFlp) || 0
}

const governanceVotedFlpTotal = (record) => Number(governanceVoteSummary(record)?.totalVotes) || 0

const governanceStatusLabel = (record) => {
  const status = String(governanceVoteSummary(record)?.status || '').toUpperCase()
  if (status === 'PASSED') return '通过'
  if (status === 'FAILED') return '失效'
  return '投票中'
}

const mediaType = (media) => String(media?.type || '').toUpperCase()

const hasVideoBroadcastMedia = (record) =>
  Array.isArray(record?.media) && record.media.some((item) => mediaType(item) === 'VIDEO')

const isDisplayableBroadcast = (record) => !hasVideoBroadcastMedia(record)

const isCosRef = (value) => {
  const text = String(value || '').trim()
  return /\.cos\.[^.]+\.(myqcloud\.com|tencentcos\.cn)/i.test(text) || /^planet-broadcast\//.test(text) || /^pins\/videos\//.test(text)
}

const resolveMediaUrl = (media) => {
  if (!media) return ''
  if (media.adminUrl) return media.adminUrl
  const rawUrl = String(media.url || '').trim()
  const rawObjectName = String(media.objectName || '').trim()
  if (rawUrl && (isCosRef(rawUrl) || rawUrl.includes('/files/download/'))) return rawUrl
  if (rawObjectName && !isCosRef(rawObjectName)) return buildDownloadUrl(extractObjectName(rawObjectName) || rawObjectName)
  if (rawUrl && !isCosRef(rawUrl)) return buildDownloadUrl(extractObjectName(rawUrl) || rawUrl)
  return rawObjectName || rawUrl
}

const normalizeObjectKey = (value) =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .split('?')[0]
    .split('#')[0]

const parseCosMediaSource = (value, stsConfig = {}) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) {
    try {
      const target = new URL(raw)
      const hostMatch = target.hostname.match(COS_HOST_PATTERN)
      if (!hostMatch?.groups?.bucket || !hostMatch?.groups?.region) return null
      return {
        bucket: hostMatch.groups.bucket,
        region: hostMatch.groups.region,
        key: normalizeObjectKey(decodeURIComponent(target.pathname || '')),
      }
    } catch (error) {
      return null
    }
  }
  const defaultBucket = Array.isArray(stsConfig?.buckets) ? stsConfig.buckets[0] : ''
  const defaultRegion = String(stsConfig?.region || '').trim()
  if (!defaultBucket || !defaultRegion || !isCosRef(raw)) return null
  return {
    bucket: defaultBucket,
    region: defaultRegion,
    key: normalizeObjectKey(raw),
  }
}

const getTencentCosSts = () => {
  if (!tencentCosStsPromise) {
    tencentCosStsPromise = fetchTencentCosSts().catch((error) => {
      tencentCosStsPromise = null
      throw error
    })
  }
  return tencentCosStsPromise
}

const createTencentCosClient = (sts) =>
  new COS({
    SecretId: sts.tmpSecretId,
    SecretKey: sts.tmpSecretKey,
    SecurityToken: sts.sessionToken,
    Protocol: 'https:',
  })

const getTencentCosObjectUrl = (client, params) =>
  new Promise((resolve, reject) => {
    client.getObjectUrl(params, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(data?.Url || data?.url || '')
    })
  })

const resolveCosMediaUrl = async (rawRef) => {
  const ref = String(rawRef || '').trim()
  if (!ref || !isCosRef(ref)) return ''
  if (mediaUrlCache.has(ref)) return mediaUrlCache.get(ref)
  const sts = await getTencentCosSts()
  const source = parseCosMediaSource(ref, sts)
  if (!source?.bucket || !source?.region || !source?.key) return ''
  const client = createTencentCosClient(sts)
  const url = await getTencentCosObjectUrl(client, {
    Bucket: source.bucket,
    Region: source.region,
    Key: source.key,
    Sign: true,
    Protocol: 'https:',
  })
  if (url) mediaUrlCache.set(ref, url)
  return url
}

const hydratePlanetBroadcastMediaUrls = async (items = []) => {
  const list = Array.isArray(items) ? items : []
  return Promise.all(list.map(async (record) => {
    const media = Array.isArray(record?.media) ? record.media : []
    const nextMedia = await Promise.all(media.map(async (item) => {
      const ref = String(item.url || item.objectName || '').trim()
      if (!isCosRef(ref)) return item
      try {
        const adminUrl = await resolveCosMediaUrl(ref)
        return adminUrl ? { ...item, adminUrl } : item
      } catch (error) {
        console.warn('Failed to resolve planet broadcast COS media url', error)
        return item
      }
    }))
    return { ...record, media: nextMedia }
  }))
}

const formatDurationMs = (value) => {
  const totalSeconds = Math.max(0, Math.round((Number(value) || 0) / 1000))
  if (!totalSeconds) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds} 秒`
}

const formatMediaSize = (value) => {
  const size = Math.max(0, Number(value) || 0)
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`
  return `${(size / 1024 / 1024).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

const mediaName = (media, index) => {
  const name = String(media?.name || '').trim()
  if (name) return name
  const type = mediaType(media)
  if (type === 'FILE') return `文件 ${index + 1}`
  if (type === 'VOICE') return `语音 ${index + 1}`
  if (type === 'CHANNEL_VIDEO') return `视频号 ${index + 1}`
  if (type === 'VIDEO') return `录像 ${index + 1}`
  if (type === 'IMAGE') return `图片 ${index + 1}`
  if (type === 'EMOJI') return `表情 ${index + 1}`
  return `媒体 ${index + 1}`
}

const channelVideoSummary = (media = {}) => {
  const feedToken = String(media.feedToken || '').trim()
  const finderUserName = String(media.finderUserName || '').trim()
  const feedId = String(media.feedId || '').trim()
  if (feedToken) return `feed-token: ${feedToken}`
  if (finderUserName && feedId) return `${finderUserName} / ${feedId}`
  return String(media.url || media.objectName || '-').trim() || '-'
}

const loadQuotaConfig = async () => {
  quotaConfigLoading.value = true
  try {
    const data = await fetchAdminPlanetBroadcastQuotaConfig()
    quotaEnforced.value = data?.quotaEnforced === true
  } catch (error) {
    console.error('Failed to load planet broadcast quota config', error)
    message.error('加载广播限制开关失败')
  } finally {
    quotaConfigLoading.value = false
  }
}

const setQuotaEnforced = async (checked) => {
  quotaConfigLoading.value = true
  try {
    const data = await updateAdminPlanetBroadcastQuotaConfig({ quotaEnforced: checked === true })
    quotaEnforced.value = data?.quotaEnforced === true
    message.success(quotaEnforced.value ? '已开启发送次数限制' : '已关闭发送次数限制')
  } catch (error) {
    console.error('Failed to update planet broadcast quota config', error)
    message.error('保存广播限制开关失败')
  } finally {
    quotaConfigLoading.value = false
  }
}

const normalizeParticipationRate = (value, fallback = 5) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : fallback
}

const normalizePositiveNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

const applyGovernanceConfig = (data = {}) => {
  governanceForm.value = {
    participationRate: normalizeParticipationRate(data.participationRate, 5),
    agreeRate: normalizeParticipationRate(data.agreeRate, 51),
    voteCostPerVoteFlp: normalizePositiveNumber(data.voteCostPerVoteFlp, 0.001),
  }
  governanceUpdatedAt.value = data.updatedAt || ''
}

const loadGovernanceConfig = async () => {
  governanceConfigLoading.value = true
  try {
    applyGovernanceConfig(await fetchAdminPlanetBroadcastGovernanceConfig())
  } catch (error) {
    console.error('Failed to load planet broadcast governance config', error)
    message.error('加载治理投票配置失败')
  } finally {
    governanceConfigLoading.value = false
  }
}

const saveGovernanceConfig = async () => {
  governanceConfigSaving.value = true
  try {
    const data = await updateAdminPlanetBroadcastGovernanceConfig({
      participationRate: normalizeParticipationRate(governanceForm.value.participationRate, 5),
      agreeRate: normalizeParticipationRate(governanceForm.value.agreeRate, 51),
      voteCostPerVoteFlp: normalizePositiveNumber(governanceForm.value.voteCostPerVoteFlp, 0.001),
    })
    applyGovernanceConfig(data)
    message.success('已保存治理投票配置')
  } catch (error) {
    console.error('Failed to save planet broadcast governance config', error)
    message.error('保存治理投票配置失败')
  } finally {
    governanceConfigSaving.value = false
  }
}

const openPublishModal = () => {
  publishForm.value = { content: '' }
  publishImages.value = []
  publishVisible.value = true
}

const closePublishModal = () => {
  if (publishing.value) return
  publishVisible.value = false
}

const collectPasteImageFiles = (event) => {
  const clipboard = event?.clipboardData
  if (!clipboard) return []
  const itemFiles = Array.from(clipboard.items || [])
    .filter((item) => item.kind === 'file' && /^image\//i.test(item.type || ''))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  if (itemFiles.length) return itemFiles
  return Array.from(clipboard.files || []).filter((file) => /^image\//i.test(file.type || ''))
}

const uploadPublishImages = async (files = []) => {
  const usableFiles = files.filter((file) => file && /^image\//i.test(file.type || ''))
  if (!usableFiles.length) return
  const remain = MAX_PUBLISH_IMAGE_COUNT - publishImages.value.length
  if (remain <= 0) {
    message.warning('最多粘贴 5 张图片')
    return
  }
  const targets = usableFiles.slice(0, remain)
  if (usableFiles.length > remain) {
    message.warning('最多粘贴 5 张图片')
  }
  publishImageUploading.value = true
  try {
    const uploaded = []
    for (const file of targets) {
      const result = await uploadPublicFile(file)
      if (!result?.url && !result?.objectName) continue
      uploaded.push({
        uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name || result.objectName || 'image',
        size: file.size || 0,
        url: result.url,
        objectName: result.objectName,
      })
    }
    if (uploaded.length) {
      publishImages.value = [...publishImages.value, ...uploaded]
      message.success(`已添加 ${uploaded.length} 张图片`)
    }
  } catch (error) {
    console.error('Failed to upload pasted planet dynamic image', error)
    message.error('图片上传失败')
  } finally {
    publishImageUploading.value = false
  }
}

const handlePublishPaste = async (event) => {
  const imageFiles = collectPasteImageFiles(event)
  if (!imageFiles.length) return
  event.preventDefault()
  await uploadPublishImages(imageFiles)
}

const removePublishImage = (uid) => {
  publishImages.value = publishImages.value.filter((item) => item.uid !== uid)
}

const submitAdminBroadcast = async () => {
  const content = String(publishForm.value.content || '').trim()
  if (!content && !publishImages.value.length) {
    message.warning('请输入内容或粘贴图片')
    return
  }
  if (content.length > 1000) {
    message.warning('广播内容不能超过 1000 字')
    return
  }
  if (publishImageUploading.value) {
    message.warning('图片还在上传')
    return
  }
  publishing.value = true
  try {
    await createAdminPlanetBroadcast({
      content,
      category: 'PLANET_DYNAMIC',
      media: publishImages.value.map((item) => ({
        type: 'IMAGE',
        url: item.url,
        objectName: item.objectName,
        name: item.name,
        size: item.size,
      })),
      locationVisibility: 'HIDDEN',
    })
    message.success('星球动态已发布')
    publishVisible.value = false
    publishImages.value = []
    categoryFilter.value = 'PLANET_DYNAMIC'
    await loadRows(0)
  } catch (error) {
    console.error('Failed to publish planet dynamic broadcast', error)
    message.error('发布星球动态失败')
  } finally {
    publishing.value = false
  }
}

const loadRows = async (nextPage = page.value) => {
  loading.value = true
  try {
    const data = await fetchAdminPlanetBroadcasts({
      page: nextPage,
      size: size.value,
      category: categoryFilter.value,
      governanceStatus: categoryFilter.value === 'GOVERNANCE_VOTE' ? governanceStatusFilter.value : undefined,
    })
    rows.value = await hydratePlanetBroadcastMediaUrls((data?.content || []).filter(isDisplayableBroadcast))
    page.value = Number(data?.page) || 0
    total.value = Number(data?.totalElements) || 0
  } catch (error) {
    console.error('Failed to load planet broadcasts', error)
    message.error('加载星球广播失败')
  } finally {
    loading.value = false
  }
}

const handleCategoryFilterChange = () => {
  if (categoryFilter.value === 'GOVERNANCE_VOTE' && !governanceStatusFilter.value) {
    governanceStatusFilter.value = 'VOTING'
  }
  loadRows(0)
}

const handleTableChange = (pagination) => {
  const nextPage = Math.max(0, Number(pagination?.current || 1) - 1)
  const nextSize = Number(pagination?.pageSize) || size.value
  size.value = nextSize
  loadRows(nextPage)
}

const setPinned = async (record, pinned) => {
  if (!record?.id) return
  if (pinned && !record.pinned && pinnedCount.value >= 3) {
    message.warning('最多置顶 3 条')
    return
  }
  try {
    await updateAdminPlanetBroadcastPin(record.id, {
      pinned,
      pinOrder: pinned ? 0 : null,
    })
    message.success(pinned ? '已置顶' : '已取消置顶')
    await loadRows()
  } catch (error) {
    console.error('Failed to update planet broadcast pin', error)
    message.error('操作失败')
  }
}

const pushBroadcastNotification = (record) => {
  if (!record?.id) return
  Modal.confirm({
    title: '推送圈子动态',
    content: '将这条广播通过微信订阅消息推送给已授权用户。',
    okText: '推送全部',
    cancelText: '取消',
    onOk: async () => {
      try {
        await pushAdminPlanetBroadcast(record.id)
        message.success('已开始推送')
      } catch (error) {
        console.error('Failed to push planet broadcast notification', error)
        message.error('推送失败')
      }
    },
  })
}

const confirmDelete = (record) => {
  if (!record?.id) return
  Modal.confirm({
    title: '删除广播',
    content: summarize(record),
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteAdminPlanetBroadcast(record.id)
        message.success('已删除')
        await loadRows()
      } catch (error) {
        console.error('Failed to delete planet broadcast', error)
        message.error('删除失败')
      }
    },
  })
}

const loadComments = async (record = activeDetailRecord.value) => {
  if (!record?.id) return
  commentsLoading.value = true
  try {
    const data = await fetchAdminPlanetBroadcastComments(record.id, { page: 0, size: 50 })
    commentRows.value = data?.content || []
  } catch (error) {
    console.error('Failed to load planet broadcast comments', error)
    message.error('评论加载失败')
  } finally {
    commentsLoading.value = false
  }
}

const openDetail = async (record) => {
  if (!record?.id) return
  activeDetailRecord.value = record
  commentRows.value = []
  detailVisible.value = true
  await loadComments(record)
}

const closeDetail = () => {
  detailVisible.value = false
  activeDetailRecord.value = null
  commentRows.value = []
}

const commentAuthorLabel = (comment) =>
  String(comment?.authorName || comment?.authorNickname || comment?.nickname || comment?.authorFeatureCode || '星球用户').trim()

const confirmDeleteComment = (comment) => {
  const record = activeDetailRecord.value
  if (!record?.id || !comment?.id) return
  Modal.confirm({
    title: '删除评论',
    content: comment.content || '-',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteAdminPlanetBroadcastComment(record.id, comment.id)
        message.success('已删除')
        await loadComments(record)
        await loadRows()
      } catch (error) {
        console.error('Failed to delete planet broadcast comment', error)
        message.error('删除失败')
      }
    },
  })
}

const updateAuthorBan = (record, banned) => {
  const featureCode = String(record?.authorFeatureCode || '').trim()
  if (!featureCode) return
  Modal.confirm({
    title: banned ? '封禁播报人' : '解禁播报人',
    content: `${authorLabel(record)}（${featureCode}）`,
    okText: banned ? '封禁' : '解禁',
    okType: banned ? 'danger' : 'primary',
    cancelText: '取消',
    onOk: async () => {
      try {
        if (banned) {
          await banAdminPlanetBroadcastAuthor(featureCode)
          message.success('已封禁播报人')
        } else {
          await unbanAdminPlanetBroadcastAuthor(featureCode)
          message.success('已解禁播报人')
        }
        if (activeDetailRecord.value?.authorFeatureCode === featureCode) {
          activeDetailRecord.value = {
            ...activeDetailRecord.value,
            authorStatus: banned ? 'BANNED' : 'ACTIVE',
          }
        }
        await loadRows()
      } catch (error) {
        console.error('Failed to update planet broadcast author ban status', error)
        message.error('操作失败')
      }
    },
  })
}

const openStream = () => {
  closeStream()
  if (typeof EventSource === 'undefined') {
    streamStatus.value = '浏览器不支持实时连接'
    return
  }
  eventSource = createAdminPlanetBroadcastEventSource()
  streamStatus.value = '连接中'
  eventSource.addEventListener('ready', () => {
    streamStatus.value = '实时接收中'
  })
  eventSource.addEventListener('broadcast', () => {
    streamStatus.value = '实时接收中'
    loadRows()
    if (detailVisible.value && activeDetailRecord.value?.id) {
      loadComments(activeDetailRecord.value)
    }
  })
  eventSource.onerror = () => {
    streamStatus.value = '连接重试中'
  }
}

const closeStream = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

onMounted(() => {
  loadQuotaConfig()
  loadGovernanceConfig()
  loadRows()
  openStream()
})

onBeforeUnmount(() => {
  closeStream()
})
</script>

<template>
  <section class="planet-broadcast-admin">
    <header class="broadcast-admin-header">
      <div>
        <h3>星球广播</h3>
        <p>实时查看广播，设置最多 3 条置顶。</p>
      </div>
      <div class="header-actions">
        <span class="quota-switch-label">类型</span>
        <a-select
          v-model:value="categoryFilter"
          class="category-filter-select"
          :options="BROADCAST_CATEGORY_FILTER_OPTIONS"
          @change="handleCategoryFilterChange"
        />
        <a-select
          v-if="governanceFilterVisible"
          v-model:value="governanceStatusFilter"
          class="governance-status-filter-select"
          :options="GOVERNANCE_STATUS_FILTER_OPTIONS"
          @change="loadRows(0)"
        />
        <span class="quota-switch-label">发送次数限制</span>
        <a-switch
          :checked="quotaEnforced"
          :loading="quotaConfigLoading"
          checked-children="开"
          un-checked-children="关"
          @change="setQuotaEnforced"
        />
        <a-tag color="blue">{{ streamStatus }}</a-tag>
        <a-button type="primary" @click="openPublishModal">发布星球动态</a-button>
        <a-button @click="loadRows()" :loading="loading">刷新</a-button>
      </div>
    </header>

    <a-modal
      v-model:open="publishVisible"
      title="发布星球动态"
      :confirm-loading="publishing"
      ok-text="发布"
      cancel-text="取消"
      @ok="submitAdminBroadcast"
      @cancel="closePublishModal"
    >
      <a-form layout="vertical">
        <a-form-item label="广播内容">
          <a-textarea
            v-model:value="publishForm.content"
            :maxlength="1000"
            :rows="5"
            show-count
            @paste="handlePublishPaste"
            placeholder="输入要发布给用户的星球动态"
          />
        </a-form-item>
        <div class="publish-image-panel" @paste="handlePublishPaste">
          <div class="publish-image-hint">
            <span>粘贴图片即可添加</span>
            <a-spin v-if="publishImageUploading" size="small" />
          </div>
          <div v-if="publishImages.length" class="publish-image-list">
            <div v-for="item in publishImages" :key="item.uid" class="publish-image-item">
              <img :src="item.url" :alt="item.name" />
              <button type="button" class="publish-image-remove" @click="removePublishImage(item.uid)">×</button>
            </div>
          </div>
        </div>
        <a-alert message="发布后会以低空星球官方身份显示，类型为星球动态。" type="info" show-icon />
      </a-form>
    </a-modal>

    <OfficialAccountMaterialSettings />

    <section class="broadcast-reward-panel">
      <div class="reward-panel-title">星球治理投票配置</div>
      <a-spin :spinning="governanceConfigLoading">
        <div class="reward-form-row">
          <a-form-item label="参与率">
            <a-input-number
              v-model:value="governanceForm.participationRate"
              :min="0"
              :max="100"
              :step="0.000001"
              addon-after="%"
            />
          </a-form-item>
          <a-form-item label="赞同率">
            <a-input-number
              v-model:value="governanceForm.agreeRate"
              :min="0"
              :max="100"
              :step="0.000001"
              addon-after="%"
            />
          </a-form-item>
          <a-form-item label="每票扣除费率">
            <a-input-number
              v-model:value="governanceForm.voteCostPerVoteFlp"
              :min="0.000001"
              :max="100"
              :precision="6"
              :step="0.001"
              addon-after="%"
            />
          </a-form-item>
          <a-button type="primary" :loading="governanceConfigSaving" @click="saveGovernanceConfig">保存</a-button>
        </div>
        <div v-if="governanceUpdatedAt" class="reward-updated">最近更新：{{ formatTime(governanceUpdatedAt) }}</div>
      </a-spin>
    </section>

    <a-table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="{ current: page + 1, pageSize: size, total, showSizeChanger: true }"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'content'">
          <div class="broadcast-copy" :title="displaySummary(record)">{{ displaySummary(record) }}</div>
          <div v-if="record.media?.length" class="media-list">
            <div v-for="(media, index) in record.media" :key="`${record.id}-${index}`" class="media-row">
              <template v-if="mediaType(media) === 'VOICE'">
                <div class="media-title">
                  <span>{{ mediaName(media, index) }}</span>
                  <span v-if="formatDurationMs(media.durationMs)" class="media-duration">
                    {{ formatDurationMs(media.durationMs) }}
                  </span>
                </div>
                <audio class="media-audio" controls preload="none" :src="resolveMediaUrl(media)" />
                <div v-if="media.transcript" class="media-transcript">{{ media.transcript }}</div>
              </template>
              <template v-else-if="mediaType(media) === 'IMAGE' || mediaType(media) === 'EMOJI'">
                <a :href="resolveMediaUrl(media)" target="_blank" rel="noreferrer" class="media-preview-link">
                  <img class="media-image" :src="resolveMediaUrl(media)" :alt="mediaName(media, index)" />
                </a>
              </template>
              <template v-else-if="mediaType(media) === 'CHANNEL_VIDEO'">
                <div class="media-title">
                  <span>{{ mediaName(media, index) }}</span>
                </div>
                <div class="media-link">{{ channelVideoSummary(media) }}</div>
              </template>
              <template v-else>
                <div class="media-title">
                  <a :href="resolveMediaUrl(media)" target="_blank" rel="noreferrer" class="media-link">
                    {{ mediaName(media, index) }}
                  </a>
                  <span v-if="formatMediaSize(media.size)" class="media-duration">
                    {{ formatMediaSize(media.size) }}
                  </span>
                </div>
              </template>
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'category'">
          <a-tag :color="broadcastCategoryColor(record)">{{ broadcastCategoryLabel(record) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'author'">
          <div class="author-cell">
            <a-avatar :src="authorAvatar(record)" :size="28">{{ authorInitial(record) }}</a-avatar>
            <span>{{ authorLabel(record) }}</span>
            <a-tag v-if="isAuthorBanned(record)" color="red">已封禁</a-tag>
          </div>
        </template>
        <template v-else-if="column.key === 'likeCount'">
          {{ Number(record.likeCount) || 0 }}
        </template>
        <template v-else-if="column.key === 'createdAt'">
          {{ formatTime(record.createdAt) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button size="small" type="primary" @click="openDetail(record)">详情</a-button>
            <a-button size="small" @click="setPinned(record, !record.pinned)">
              {{ record.pinned ? '取消置顶' : '置顶' }}
            </a-button>
            <a-button size="small" @click="pushBroadcastNotification(record)">推送全部</a-button>
            <a-button size="small" danger @click="confirmDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="detailVisible"
      title="广播详情"
      :footer="null"
      width="760px"
      @cancel="closeDetail"
    >
      <div v-if="activeDetailRecord" class="broadcast-detail">
        <div class="detail-author-row">
          <a-avatar :src="authorAvatar(activeDetailRecord)" :size="36">
            {{ authorInitial(activeDetailRecord) }}
          </a-avatar>
          <div class="detail-author-main">
            <div class="detail-author-name">
              {{ authorLabel(activeDetailRecord) }}
              <a-tag v-if="activeDetailRecord.pinned" color="gold">置顶</a-tag>
              <a-tag v-if="isAuthorBanned(activeDetailRecord)" color="red">已封禁</a-tag>
              <a-button
                v-if="activeDetailRecord.authorFeatureCode && !isSystemBroadcast(activeDetailRecord)"
                size="small"
                :danger="!isAuthorBanned(activeDetailRecord)"
                @click="updateAuthorBan(activeDetailRecord, !isAuthorBanned(activeDetailRecord))"
              >
                {{ isAuthorBanned(activeDetailRecord) ? '解禁' : '封禁' }}
              </a-button>
            </div>
            <div class="detail-meta">{{ formatTime(activeDetailRecord.createdAt) }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">内容</div>
          <div class="detail-content">{{ summarize(activeDetailRecord) }}</div>
        </div>

        <div v-if="activeDetailRecord.media?.length" class="detail-section">
          <div class="detail-section-title">媒体</div>
          <div class="media-list media-list--detail">
            <div
              v-for="(media, index) in activeDetailRecord.media"
              :key="`${activeDetailRecord.id}-detail-${index}`"
              class="media-row"
            >
              <template v-if="mediaType(media) === 'VOICE'">
                <div class="media-title">
                  <span>{{ mediaName(media, index) }}</span>
                  <span v-if="formatDurationMs(media.durationMs)" class="media-duration">
                    {{ formatDurationMs(media.durationMs) }}
                  </span>
                </div>
                <audio class="media-audio" controls preload="none" :src="resolveMediaUrl(media)" />
                <div v-if="media.transcript" class="media-transcript">{{ media.transcript }}</div>
              </template>
              <template v-else-if="mediaType(media) === 'IMAGE' || mediaType(media) === 'EMOJI'">
                <a :href="resolveMediaUrl(media)" target="_blank" rel="noreferrer" class="media-preview-link">
                  <img class="media-image media-image--detail" :src="resolveMediaUrl(media)" :alt="mediaName(media, index)" />
                </a>
              </template>
              <template v-else-if="mediaType(media) === 'CHANNEL_VIDEO'">
                <div class="media-title">
                  <span>{{ mediaName(media, index) }}</span>
                </div>
                <div class="media-link">{{ channelVideoSummary(media) }}</div>
              </template>
              <template v-else>
                <div class="media-title">
                  <a :href="resolveMediaUrl(media)" target="_blank" rel="noreferrer" class="media-link">
                    {{ mediaName(media, index) }}
                  </a>
                  <span v-if="formatMediaSize(media.size)" class="media-duration">
                    {{ formatMediaSize(media.size) }}
                  </span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div
          v-if="isGovernanceBroadcast(activeDetailRecord) && governanceVoteSummary(activeDetailRecord)"
          class="detail-section"
        >
          <div class="detail-section-title">治理投票</div>
          <div class="governance-detail-grid">
            <div class="governance-detail-item">
              <span>状态</span>
              <strong>{{ governanceStatusLabel(activeDetailRecord) }}</strong>
            </div>
            <div class="governance-detail-item">
              <span>发起投票时FLP总数</span>
              <strong>{{ formatFlpAmount(governanceStartedFlpTotal(activeDetailRecord)) }}</strong>
            </div>
            <div class="governance-detail-item">
              <span>参与投票FLP</span>
              <strong>{{ formatFlpAmount(governanceVotedFlpTotal(activeDetailRecord)) }}</strong>
            </div>
            <div class="governance-detail-item">
              <span>当前FLP参与率</span>
              <strong>
                {{
                  formatGovernancePercent(
                    governanceVoteSummary(activeDetailRecord).participationRate,
                    governanceVotedFlpTotal(activeDetailRecord),
                    governanceStartedFlpTotal(activeDetailRecord),
                  )
                }}
              </strong>
            </div>
            <div class="governance-detail-item">
              <span>通过门槛</span>
              <strong>{{ formatGovernancePercent(governanceVoteSummary(activeDetailRecord).requiredParticipationRate) }}</strong>
            </div>
            <div class="governance-detail-item">
              <span>赞同 / 反对</span>
              <strong>
                {{ Number(governanceVoteSummary(activeDetailRecord).agreeVotes) || 0 }}
                /
                {{ Number(governanceVoteSummary(activeDetailRecord).disagreeVotes) || 0 }}
              </strong>
            </div>
          </div>
        </div>

        <a-descriptions size="small" bordered :column="2">
          <a-descriptions-item label="类型">{{ broadcastCategoryLabel(activeDetailRecord) }}</a-descriptions-item>
          <a-descriptions-item label="评论">{{ Number(activeDetailRecord.commentCount) || 0 }}</a-descriptions-item>
          <a-descriptions-item label="点赞">{{ Number(activeDetailRecord.likeCount) || 0 }}</a-descriptions-item>
          <a-descriptions-item label="位置" :span="2">
            {{ activeDetailRecord.locationText || activeDetailRecord.address || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="位置精度" :span="2">
            {{ formatLocationVisibility(activeDetailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="FeatureCode" :span="2">
            {{ activeDetailRecord.authorFeatureCode || '-' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-section">
          <div class="detail-section-title">评论</div>
          <a-spin :spinning="commentsLoading">
            <div v-if="!commentRows.length" class="comment-empty">暂无评论</div>
            <div v-else class="comment-list">
              <div v-for="comment in commentRows" :key="comment.id" class="comment-row">
                <div class="comment-main">
                  <div class="comment-author">{{ commentAuthorLabel(comment) }}</div>
                  <div class="comment-content">{{ comment.content || '-' }}</div>
                  <div class="comment-time">{{ formatTime(comment.createdAt) }}</div>
                </div>
                <a-button size="small" danger @click="confirmDeleteComment(comment)">删除</a-button>
              </div>
            </div>
          </a-spin>
        </div>
      </div>
    </a-modal>

  </section>
</template>

<style scoped>
.planet-broadcast-admin {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.broadcast-admin-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.broadcast-admin-header h3 {
  margin: 0;
  font-size: 20px;
}

.broadcast-admin-header p {
  margin: 6px 0 0;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.quota-switch-label {
  color: #475569;
  font-size: 13px;
}

.category-filter-select {
  width: 132px;
}

.governance-status-filter-select {
  width: 104px;
}

.publish-image-panel {
  margin: -6px 0 14px;
}

.publish-image-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  color: #64748b;
  font-size: 12px;
}

.publish-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.publish-image-item {
  position: relative;
  width: 76px;
  height: 76px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.publish-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.publish-image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  line-height: 20px;
  cursor: pointer;
}

.broadcast-reward-panel {
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.reward-panel-title {
  margin-bottom: 12px;
  font-weight: 700;
  color: #0f172a;
}

.reward-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.reward-form-row :deep(.ant-form-item) {
  margin-bottom: 0;
}

.reward-updated {
  margin-top: 10px;
  color: #64748b;
  font-size: 12px;
}

.broadcast-copy-row {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 620px;
  min-width: 0;
}

.broadcast-copy {
  flex: 1;
  min-width: 0;
  max-width: 620px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.detail-link {
  flex: 0 0 auto;
  padding: 0;
}

.broadcast-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-author-main {
  min-width: 0;
}

.detail-author-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #0f172a;
}

.detail-meta {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}

.detail-content {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #0f172a;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.governance-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.governance-detail-item {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.governance-detail-item span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.governance-detail-item strong {
  display: block;
  margin-top: 4px;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.35;
  word-break: break-word;
}

.author-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
  min-width: 0;
}

.author-cell span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  max-width: 620px;
}

.media-list--detail {
  margin-top: 0;
  max-width: none;
}

.media-row {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.media-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: #475569;
  font-size: 12px;
}

.media-duration {
  color: #94a3b8;
}

.media-audio {
  display: block;
  width: 280px;
  max-width: 100%;
  height: 32px;
}

.media-preview-link {
  display: inline-flex;
}

.media-image {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #eef2f7;
}

.media-image--detail {
  width: 128px;
  height: 128px;
}

.media-video {
  display: block;
  width: 220px;
  max-width: 100%;
  height: 124px;
  border-radius: 6px;
  background: #0f172a;
}

.media-video--detail {
  width: 360px;
  height: 202px;
}

.media-transcript {
  margin-top: 6px;
  color: #334155;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.media-link {
  color: #2563eb;
  font-size: 13px;
}

.comment-empty {
  padding: 24px 0;
  color: #64748b;
  text-align: center;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comment-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e2e8f0;
}

.comment-main {
  min-width: 0;
  flex: 1;
}

.comment-author {
  font-size: 12px;
  color: #64748b;
}

.comment-content {
  margin-top: 4px;
  color: #0f172a;
  word-break: break-word;
}

.comment-time {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}
</style>
