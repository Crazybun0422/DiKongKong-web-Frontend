import http from './http'

const WEAPP_CONFIG_ENDPOINT = '/auth/weapp/config'

export const fetchWeappConfig = async () => {
  try {
    const response = await http.get(WEAPP_CONFIG_ENDPOINT)
    return response.data?.data || response.data || {}
  } catch (error) {
    if (error?.response?.status === 404) {
      return {}
    }
    throw error
  }
}

export const saveWeappConfig = async (payload) => {
  const response = await http.post(WEAPP_CONFIG_ENDPOINT, payload)
  return response.data?.data || response.data || {}
}

export default {
  fetchWeappConfig,
  saveWeappConfig,
}
