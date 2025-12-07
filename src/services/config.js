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

export const fetchOpenPlatformCopy = async () => {
  const response = await http.get('/config/open-platform-copy')
  return normalizePagePayload(response, { content: '' })
}

export const saveOpenPlatformCopy = async (payload) => {
  const response = await http.put('/config/open-platform-copy', payload)
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

export const fetchPinReviewRewardConfig = async () => {
  const response = await http.get('/config/pin-review-reward')
  return normalizePagePayload(response, { approvedARewardFlp: 0, approvedBRewardFlp: 0 })
}

export const savePinReviewRewardConfig = async (payload) => {
  const response = await http.put('/config/pin-review-reward', payload)
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
    if (!item?.templateName || !item?.templateId) {
      continue
    }
    latest = await saveTemplateSetting({
      templateName: item.templateName,
      templateId: item.templateId,
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
  fetchOpenPlatformCopy,
  saveOpenPlatformCopy,
  fetchFlpRewardHelpCopy,
  saveFlpRewardHelpCopy,
  fetchInviteGuideCopy,
  saveInviteGuideCopy,
  fetchPinReviewRewardConfig,
  savePinReviewRewardConfig,
  fetchTemplateSettings,
  saveTemplateSetting,
  saveTemplateSettingsBatch,
  updateTemplateSetting,
  deleteTemplateSetting,
}
