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

export const resetNewbieTaskUserFlags = async () => {
  const response = await http.post('/admin/newbie-tasks/reset-user-task-flags')
  return normalizeData(response, {})
}

export default {
  fetchNewbieTaskTemplate,
  saveNewbieTaskTemplate,
  deleteNewbieTaskTemplate,
  resetNewbieTaskUserFlags,
}
