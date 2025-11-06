import http from './http'

const WECHAT_PAY_CONFIG_ENDPOINT = '/config/wechat-pay'

export const fetchWechatPayConfig = async () => {
  try {
    const response = await http.get(WECHAT_PAY_CONFIG_ENDPOINT)
    return response.data?.data || response.data || {}
  } catch (error) {
    if (error?.response?.status === 404) {
      return {}
    }
    throw error
  }
}

export const saveWechatPayConfig = async (payload) => {
  const response = await http.put(WECHAT_PAY_CONFIG_ENDPOINT, payload)
  return response.data?.data || response.data || {}
}

export default {
  fetchWechatPayConfig,
  saveWechatPayConfig,
}
