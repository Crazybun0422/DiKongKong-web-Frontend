import http from './http'

const normalizePagePayload = (response, fallback = {}) => {
  const data = response?.data?.data ?? response?.data ?? fallback
  return data
}

export const fetchInviteConfig = async () => {
  const response = await http.get('/config/invite')
  return normalizePagePayload(response, {})
}

export const saveInviteConfig = async (payload) => {
  const response = await http.put('/config/invite', payload)
  return normalizePagePayload(response, {})
}

export const fetchMapSettlementConfig = async () => {
  const response = await http.get('/config/map-settlement')
  return normalizePagePayload(response, {})
}

export const saveMapSettlementConfig = async (payload) => {
  const response = await http.put('/config/map-settlement', payload)
  return normalizePagePayload(response, {})
}

export const fetchMerchantIntroLongImageConfig = async () => {
  const response = await http.get('/config/merchant-intro-long-image')
  return normalizePagePayload(response, { imageUrl: '' })
}

export const saveMerchantIntroLongImageConfig = async (payload) => {
  const response = await http.put('/config/merchant-intro-long-image', payload)
  return normalizePagePayload(response, {})
}

export const fetchOpenPlatformCopy = async () => {
  const response = await http.get('/config/open-platform-copy')
  return normalizePagePayload(response, { content: '' })
}

export const saveOpenPlatformCopy = async (payload) => {
  const response = await http.put('/config/open-platform-copy', payload)
  return normalizePagePayload(response, {})
}

export const fetchPlanetMerchantAdvancedGuideCopy = async () => {
  const response = await http.get('/config/planet-merchant-advanced-guide')
  return normalizePagePayload(response, { content: '' })
}

export const savePlanetMerchantAdvancedGuideCopy = async (payload) => {
  const response = await http.put('/config/planet-merchant-advanced-guide', payload)
  return normalizePagePayload(response, {})
}

export const fetchPlanetCreationAdvancedGuideCopy = async () => {
  const response = await http.get('/config/planet-creation-advanced-guide')
  return normalizePagePayload(response, { content: '' })
}

export const savePlanetCreationAdvancedGuideCopy = async (payload) => {
  const response = await http.put('/config/planet-creation-advanced-guide', payload)
  return normalizePagePayload(response, {})
}

export const fetchShareToPlatformCopy = async () => {
  const response = await http.get('/config/share-to-platform-copy')
  return normalizePagePayload(response, { content: '' })
}

export const saveShareToPlatformCopy = async (payload) => {
  const response = await http.put('/config/share-to-platform-copy', payload)
  return normalizePagePayload(response, {})
}

export const fetchFlpRewardHelpCopy = async () => {
  const response = await http.get('/config/flp-reward-help')
  return normalizePagePayload(response, { content: '' })
}

export const saveFlpRewardHelpCopy = async (payload) => {
  const response = await http.put('/config/flp-reward-help', payload)
  return normalizePagePayload(response, {})
}

export const fetchInviteGuideCopy = async () => {
  const response = await http.get('/config/invite-guide')
  return normalizePagePayload(response, { content: '' })
}

export const saveInviteGuideCopy = async (payload) => {
  const response = await http.put('/config/invite-guide', payload)
  return normalizePagePayload(response, {})
}

export const fetchFlpNoAdsThresholdConfig = async () => {
  const response = await http.get('/config/flp-no-ads-threshold')
  return normalizePagePayload(response, { threshold: 0 })
}

export const saveFlpNoAdsThresholdConfig = async (payload) => {
  const response = await http.put('/config/flp-no-ads-threshold', payload)
  return normalizePagePayload(response, {})
}

export const syncFlpNoAdsCrowdNow = async () => {
  const response = await http.post('/config/flp-no-ads-threshold/sync-now')
  return normalizePagePayload(response, {})
}

export const fetchFlpNoAdsLastCrowd = async () => {
  const response = await http.get('/config/flp-no-ads-threshold/last-crowd')
  return normalizePagePayload(response, {})
}

export const fetchCoordinateLongPressGuideCopy = async () => {
  const response = await http.get('/config/coordinate-long-press-guide')
  return normalizePagePayload(response, { content: '' })
}

export const saveCoordinateLongPressGuideCopy = async (payload) => {
  const response = await http.put('/config/coordinate-long-press-guide', payload)
  return normalizePagePayload(response, {})
}

export const fetchCoordinateSystemDescriptionCopy = async () => {
  const response = await http.get('/config/coordinate-system-description')
  return normalizePagePayload(response, { content: '' })
}

export const saveCoordinateSystemDescriptionCopy = async (payload) => {
  const response = await http.put('/config/coordinate-system-description', payload)
  return normalizePagePayload(response, {})
}

export const fetchGuideUrls = async () => {
  const response = await http.get('/config/guide-urls')
  return normalizePagePayload(response, { urls: [], updatedAt: null })
}

export const saveGuideUrls = async (payload) => {
  const response = await http.put('/config/guide-urls', payload)
  return normalizePagePayload(response, {})
}

export const fetchTencentCosConfig = async () => {
  const response = await http.get('/tencent-cos/config')
  return normalizePagePayload(response, {
    secretId: '',
    region: '',
    roleArn: '',
    roleSessionName: '',
    buckets: [],
    durationSeconds: 0,
    configured: false,
  })
}

export const saveTencentCosConfig = async (payload) => {
  const response = await http.put('/tencent-cos/config', payload)
  return normalizePagePayload(response, {})
}

export const fetchTencentCosSts = async () => {
  const response = await http.get('/tencent-cos/sts')
  return normalizePagePayload(response, {
    tmpSecretId: '',
    tmpSecretKey: '',
    sessionToken: '',
    expiredTime: 0,
    startTime: '',
    expiration: '',
    region: '',
    buckets: [],
    durationSeconds: 0,
  })
}

export const fetchFontFileConfig = async () => {
  const response = await http.get('/config/font-file')
  return normalizePagePayload(response, {})
}

export const uploadFontFileConfig = async (file, version) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('version', version)

  const response = await http.post('/config/font-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return normalizePagePayload(response, {})
}

export const fetchEasterEggResourceConfig = async () => {
  const response = await http.get('/config/easter-egg-resource')
  return normalizePagePayload(response, {})
}

export const uploadEasterEggResourceConfig = async (file, version) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('version', version)

  const response = await http.post('/config/easter-egg-resource', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return normalizePagePayload(response, {})
}

export const fetchProvinceCityKmlZipConfig = async () => {
  const response = await http.get('/config/province-city-kml-zip')
  return normalizePagePayload(response, {})
}

export const uploadProvinceCityKmlZipConfig = async (file, version) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('version', version)

  const response = await http.post('/config/province-city-kml-zip', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return normalizePagePayload(response, {})
}

export const fetchPosterServiceVersion = async () => {
  const response = await http.get('/config/poster-service-version')
  return normalizePagePayload(response, {})
}

export const refreshPosterServiceVersion = async () => {
  const response = await http.post('/config/poster-service-version/refresh')
  return normalizePagePayload(response, {})
}

export const fetchPinReviewRewardConfig = async () => {
  const response = await http.get('/config/pin-review-reward')
  return normalizePagePayload(response, { approvedARewardFlp: 0, approvedBRewardFlp: 0 })
}

export const savePinReviewRewardConfig = async (payload) => {
  const response = await http.put('/config/pin-review-reward', payload)
  return normalizePagePayload(response, {})
}

export const fetchPinVideoUploadFlpLimitConfig = async () => {
  const response = await http.get('/config/pin-video-upload-flp-limit')
  return normalizePagePayload(response, { threshold: 0, updatedAt: null })
}

export const savePinVideoUploadFlpLimitConfig = async (payload) => {
  const response = await http.put('/config/pin-video-upload-flp-limit', payload)
  return normalizePagePayload(response, {})
}

export const fetchTemplateSettings = async () => {
  const response = await http.get('/config/template-settings')
  return normalizePagePayload(response, { templates: {}, updatedAt: null })
}

export const saveTemplateSetting = async (payload) => {
  const response = await http.post('/config/template-settings', payload)
  return normalizePagePayload(response, {})
}

export const saveTemplateSettingsBatch = async (items = []) => {
  let latest = null
  for (const item of items) {
    if (!item?.templateName || !item?.templateId) continue
    latest = await saveTemplateSetting({
      templateName: item.templateName,
      templateId: item.templateId,
      details: Array.isArray(item.details) ? item.details : [],
      page: item.page,
    })
  }
  return latest
}

export const updateTemplateSetting = async (templateName, payload) => {
  const response = await http.put(`/config/template-settings/${encodeURIComponent(templateName)}`, payload)
  return normalizePagePayload(response, {})
}

export const deleteTemplateSetting = async (templateName) => {
  const response = await http.delete(`/config/template-settings/${encodeURIComponent(templateName)}`)
  return normalizePagePayload(response, {})
}

export default {
  fetchInviteConfig,
  saveInviteConfig,
  fetchMapSettlementConfig,
  saveMapSettlementConfig,
  fetchMerchantIntroLongImageConfig,
  saveMerchantIntroLongImageConfig,
  fetchOpenPlatformCopy,
  saveOpenPlatformCopy,
  fetchPlanetMerchantAdvancedGuideCopy,
  savePlanetMerchantAdvancedGuideCopy,
  fetchPlanetCreationAdvancedGuideCopy,
  savePlanetCreationAdvancedGuideCopy,
  fetchShareToPlatformCopy,
  saveShareToPlatformCopy,
  fetchFlpRewardHelpCopy,
  saveFlpRewardHelpCopy,
  fetchInviteGuideCopy,
  saveInviteGuideCopy,
  fetchFlpNoAdsThresholdConfig,
  saveFlpNoAdsThresholdConfig,
  syncFlpNoAdsCrowdNow,
  fetchFlpNoAdsLastCrowd,
  fetchCoordinateLongPressGuideCopy,
  saveCoordinateLongPressGuideCopy,
  fetchCoordinateSystemDescriptionCopy,
  saveCoordinateSystemDescriptionCopy,
  fetchGuideUrls,
  saveGuideUrls,
  fetchTencentCosConfig,
  saveTencentCosConfig,
  fetchTencentCosSts,
  fetchFontFileConfig,
  uploadFontFileConfig,
  fetchEasterEggResourceConfig,
  uploadEasterEggResourceConfig,
  fetchProvinceCityKmlZipConfig,
  uploadProvinceCityKmlZipConfig,
  fetchPosterServiceVersion,
  refreshPosterServiceVersion,
  fetchPinReviewRewardConfig,
  savePinReviewRewardConfig,
  fetchPinVideoUploadFlpLimitConfig,
  savePinVideoUploadFlpLimitConfig,
  fetchTemplateSettings,
  saveTemplateSetting,
  saveTemplateSettingsBatch,
  updateTemplateSetting,
  deleteTemplateSetting,
}
