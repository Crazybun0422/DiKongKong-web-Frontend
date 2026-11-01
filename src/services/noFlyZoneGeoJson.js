import http from './http'
const unwrap = ({ data }) => {
  if (!data?.success) throw new Error('GeoJSON request failed')
  return data.data
}
const base = '/admin/geojson-assets'
export const listGeoJsonAssets = async (page = 1) => unwrap(await http.get(base, { params: { page: page - 1, size: 10 } }))
export const getNoFlyZoneGeoJson = async (id) => unwrap(await http.get(base + '/' + encodeURIComponent(id)))
export const deleteGeoJsonAsset = async (id) => unwrap(await http.delete(base + '/' + encodeURIComponent(id)))
export const publishGeoJsonAsset = async (id, draft) => unwrap(await http.post(base + '/' + encodeURIComponent(id) + '/publish', draft))
export const saveNoFlyZoneGeoJson = async (id, payload) => unwrap(await (id
  ? http.put(base + '/' + encodeURIComponent(id), payload) : http.post(base, payload)))
