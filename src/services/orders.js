import http from './http'

const normalizeOrder = (order = {}) => {
  const amountValue = Number(order?.amount)
  return {
    ...order,
    amount: Number.isFinite(amountValue) ? amountValue : 0,
  }
}

export const fetchOrders = async ({ page = 1, size = 10 } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  const { data } = await http.get('/orders', { params })
  const payload = data?.data || {}

  return {
    content: Array.isArray(payload.content)
      ? payload.content.map((item) => normalizeOrder(item))
      : [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export default {
  fetchOrders,
}
