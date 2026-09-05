import http from './http'

const unwrap = (response) => response.data?.data ?? response.data

export const fetchOfficialAccountMaterials = async (params = {}) =>
  unwrap(await http.get('/admin/official-account-materials', { params }))

export const fetchOfficialAccountPublishConfig = async () =>
  unwrap(await http.get('/admin/official-account-materials/config'))

export const updateOfficialAccountPublishConfig = async (payload) =>
  unwrap(await http.put('/admin/official-account-materials/config', payload))

export const createOfficialAccountMaterial = async (payload) =>
  unwrap(await http.post('/admin/official-account-materials', payload))

export const updateOfficialAccountMaterial = async (id, payload) =>
  unwrap(await http.put(`/admin/official-account-materials/${encodeURIComponent(id)}`, payload))

export const deleteOfficialAccountMaterial = async (id) =>
  unwrap(await http.delete(`/admin/official-account-materials/${encodeURIComponent(id)}`))
