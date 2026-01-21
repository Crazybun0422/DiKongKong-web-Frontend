import http from './http'

const normalizeData = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback

export const fetchNewbieTaskTemplate = async () => {
  const response = await http.get('/admin/newbie-tasks/template')
  return normalizeData(response, { tasks: [], updatedAt: null })
}

export const saveNewbieTaskTemplate = async (payload) => {
  const response = await http.put('/admin/newbie-tasks/template', payload)
  return normalizeData(response, {})
}

export const deleteNewbieTaskTemplate = async () => {
  const response = await http.delete('/admin/newbie-tasks/template')
  return normalizeData(response, {})
}

export const fetchNetdiskGiftConfig = async () => {
  const response = await http.get('/admin/newbie-tasks/netdisk-gift')
  return normalizeData(response, { links: [], updatedAt: null })
}

export const saveNetdiskGiftConfig = async (payload) => {
  const response = await http.put('/admin/newbie-tasks/netdisk-gift', payload)
  return normalizeData(response, {})
}

export const deleteNetdiskGiftConfig = async () => {
  const response = await http.delete('/admin/newbie-tasks/netdisk-gift')
  return normalizeData(response, {})
}

export default {
  fetchNewbieTaskTemplate,
  saveNewbieTaskTemplate,
  deleteNewbieTaskTemplate,
  fetchNetdiskGiftConfig,
  saveNetdiskGiftConfig,
  deleteNetdiskGiftConfig,
}
