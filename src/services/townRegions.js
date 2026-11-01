import http from './http'

const data = response => {
  if (!response.data?.success) throw new Error(response.data?.message?.zh || '镇级范围加载失败')
  return response.data.data
}
export const fetchTownConfig = () => http.get('/config/town-kml').then(data)
export const fetchTownChildren = (parentId = '', revision = '') => http.get('/town-regions', { params: { parentId, revision } }).then(data)
export const searchTownRegions = (keyword, revision = '', page = 0) => http.get('/town-regions/search', { params: { keyword, revision, page, size: 30 } }).then(data)
export const fetchTownGeometry = (id, revision) => http.get(`/town-regions/${encodeURIComponent(id)}/geometry`, { params: { revision } }).then(r => r.data)
export const uploadTownKml = (file, version, coordinateSystem, onUploadProgress) => {
  const form = new FormData()
  form.append('file', file); form.append('version', version); form.append('coordinateSystem', coordinateSystem)
  return http.post('/config/town-kml', form, { timeout: 1800000, onUploadProgress }).then(data)
}
