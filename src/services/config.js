import http from './http'
import { extractObjectName } from './files'

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

export const fetchFlightQualificationAssessmentRichText = async () => {
  const response = await http.get('/config/flight-qualification-assessment-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveFlightQualificationAssessmentRichText = async (payload) => {
  const response = await http.put('/config/flight-qualification-assessment-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchInsuranceCoverageRichText = async () => {
  const response = await http.get('/config/insurance-coverage-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveInsuranceCoverageRichText = async (payload) => {
  const response = await http.put('/config/insurance-coverage-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchCaacLicenseRegistrationSubsidyRichText = async () => {
  const response = await http.get('/config/caac-license-registration-subsidy-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveCaacLicenseRegistrationSubsidyRichText = async (payload) => {
  const response = await http.put('/config/caac-license-registration-subsidy-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchTheoryCertificateRichText = async () => {
  const response = await http.get('/config/theory-certificate-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveTheoryCertificateRichText = async (payload) => {
  const response = await http.put('/config/theory-certificate-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchOperationCertificateRichText = async () => {
  const response = await http.get('/config/operation-certificate-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveOperationCertificateRichText = async (payload) => {
  const response = await http.put('/config/operation-certificate-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetch120mFlightRichText = async () => {
  const response = await http.get('/config/120m-flight-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const save120mFlightRichText = async (payload) => {
  const response = await http.put('/config/120m-flight-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchNoSpecialFlightScenarioRichText = async () => {
  const response = await http.get('/config/no-special-flight-scenario-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveNoSpecialFlightScenarioRichText = async (payload) => {
  const response = await http.put('/config/no-special-flight-scenario-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchReportAndUnlockGuideRichText = async () => {
  const response = await http.get('/config/report-and-unlock-guide-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveReportAndUnlockGuideRichText = async (payload) => {
  const response = await http.put('/config/report-and-unlock-guide-rich-text', payload)
  return normalizePagePayload(response, {})
}

export const fetchAirspaceDescriptionRichText = async () => {
  const response = await http.get('/config/airspace-description-rich-text')
  return normalizePagePayload(response, { content: '' })
}

export const saveAirspaceDescriptionRichText = async (payload) => {
  const response = await http.put('/config/airspace-description-rich-text', payload)
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

export const fetchLowAltitudeCircleGuideCopy = async () => {
  const response = await http.get('/config/low-altitude-circle-guide')
  return normalizePagePayload(response, { content: '' })
}

export const saveLowAltitudeCircleGuideCopy = async (payload) => {
  const response = await http.put('/config/low-altitude-circle-guide', payload)
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

export const fetchMemberNoAdsConfig = async () => {
  const response = await http.get('/config/member-no-ads')
  return normalizePagePayload(response, { threshold: 0 })
}

export const saveMemberNoAdsConfig = async (payload) => {
  const response = await http.put('/config/member-no-ads', payload)
  return normalizePagePayload(response, {})
}

export const syncMemberNoAdsCrowdNow = async () => {
  const response = await http.post('/config/member-no-ads/sync-now')
  return normalizePagePayload(response, {})
}

export const fetchMemberNoAdsLastCrowd = async () => {
  const response = await http.get('/config/member-no-ads/last-crowd')
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

const COUNTY_KML_ZIP_ENDPOINTS = [
  '/config/county-kml-zip',
  '/config/counties-kml-zip',
  '/config/province-city-county-kml-zip',
]

const requestCountyKmlZipWithFallback = async (executor) => {
  let lastError = null
  for (const endpoint of COUNTY_KML_ZIP_ENDPOINTS) {
    try {
      return await executor(endpoint)
    } catch (error) {
      lastError = error
      if (error?.response?.status === 404) {
        continue
      }
      throw error
    }
  }
  throw lastError || new Error('County KML zip endpoint is unavailable')
}

export const fetchCountyKmlZipConfig = async () =>
  requestCountyKmlZipWithFallback(async (endpoint) => {
    const response = await http.get(endpoint)
    return normalizePagePayload(response, {})
  })

export const uploadCountyKmlZipConfig = async (file, version) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('version', version)

  return requestCountyKmlZipWithFallback(async (endpoint) => {
    const response = await http.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return normalizePagePayload(response, {})
  })
}

export const fetchKmlDecryptAesKeyConfig = async () => {
  const response = await http.get('/config/kml-decrypt-aes-key')
  return normalizePagePayload(response, { aesKey: '' })
}

export const saveKmlDecryptAesKeyConfig = async (payload) => {
  const response = await http.put('/config/kml-decrypt-aes-key', payload)
  return normalizePagePayload(response, {})
}

const resolveDownloadObjectName = (input) => {
  if (!input) return ''
  if (typeof input === 'string') {
    return extractObjectName(input.trim())
  }
  if (typeof input === 'object') {
    const candidate = input.objectName || input.fileName || input.name || input.url || input.data?.fileName || ''
    return extractObjectName(String(candidate).trim())
  }
  return extractObjectName(String(input).trim())
}

export const downloadCountyKmlZipLatest = async (objectNameOrFileName, config = {}) => {
  const objectName = resolveDownloadObjectName(objectNameOrFileName)
  if (!objectName) {
    throw new Error('County KML zip objectName is required')
  }

  const response = await http.get(`/files/download/${encodeURIComponent(objectName)}`, {
    responseType: 'blob',
    ...config,
  })

  return {
    blob: response?.data,
    fileName: response?.headers?.['content-disposition'] || objectName,
    contentLength: Number(response?.headers?.['content-length'] || 0),
  }
}

export const fetchPosterServiceVersion = async () => {
  const response = await http.get('/config/poster-service-version')
  return normalizePagePayload(response, {})
}

export const refreshPosterServiceVersion = async () => {
  const response = await http.post('/config/poster-service-version/refresh')
  return normalizePagePayload(response, {})
}

export const fetchUomLayerConfig = async () => {
  const response = await http.get('/config/uom-layer')
  return normalizePagePayload(response, {
    useUomOriginalLayer: false,
    token: '',
    updatedAt: null,
  })
}

export const saveUomLayerConfig = async (payload) => {
  const response = await http.put('/config/uom-layer', payload)
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
  fetchFlightQualificationAssessmentRichText,
  saveFlightQualificationAssessmentRichText,
  fetchInsuranceCoverageRichText,
  saveInsuranceCoverageRichText,
  fetchCaacLicenseRegistrationSubsidyRichText,
  saveCaacLicenseRegistrationSubsidyRichText,
  fetchTheoryCertificateRichText,
  saveTheoryCertificateRichText,
  fetchOperationCertificateRichText,
  saveOperationCertificateRichText,
  fetch120mFlightRichText,
  save120mFlightRichText,
  fetchNoSpecialFlightScenarioRichText,
  saveNoSpecialFlightScenarioRichText,
  fetchReportAndUnlockGuideRichText,
  saveReportAndUnlockGuideRichText,
  fetchAirspaceDescriptionRichText,
  saveAirspaceDescriptionRichText,
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
  fetchMemberNoAdsConfig,
  saveMemberNoAdsConfig,
  syncMemberNoAdsCrowdNow,
  fetchMemberNoAdsLastCrowd,
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
  fetchCountyKmlZipConfig,
  uploadCountyKmlZipConfig,
  fetchKmlDecryptAesKeyConfig,
  saveKmlDecryptAesKeyConfig,
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
