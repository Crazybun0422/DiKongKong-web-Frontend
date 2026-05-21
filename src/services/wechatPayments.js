import http from './http'

const normalizeWechatPaymentStatus = (payload = {}) => ({
  paid: Boolean(payload?.paid),
  status: typeof payload?.status === 'string' ? payload.status : 'WAITING_PAYMENT',
})

export const fetchWechatPaymentStatus = async (orderId) => {
  if (!orderId) {
    throw new Error('orderId is required')
  }

  const { data } = await http.get(`/payments/wechat/status/${encodeURIComponent(orderId)}`)
  return normalizeWechatPaymentStatus(data?.data || {})
}

// The status query endpoint is also the server-side reconciliation entry.
export const repairWechatPaymentOrder = async (orderId) => fetchWechatPaymentStatus(orderId)

export default {
  fetchWechatPaymentStatus,
  repairWechatPaymentOrder,
}
