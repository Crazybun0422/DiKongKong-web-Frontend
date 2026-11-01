import http from './http'

const unwrap = (response) => {
  if (!response.data?.success || !response.data.data) throw new Error('External map configuration request failed')
  return response.data.data
}

export const fetchExternalMapConfig = async () => unwrap(await http.get('/admin/external-map/config'))
export const saveExternalMapConfig = async (payload) => unwrap(await http.put('/admin/external-map/config', payload))
