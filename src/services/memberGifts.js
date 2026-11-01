import http from './http'
const unwrap = response => {
  const body = response?.data
  if (!body?.success) throw new Error(body?.message?.zh || '操作失败')
  return body.data
}
export const grantMemberGift = async payload => unwrap(await http.post('/admin/users/member/gifts', payload))
export const fetchMemberGifts = async ({ page = 1, size = 10, featureCode = '' } = {}) =>
  unwrap(await http.get('/admin/users/member/gifts', { params: { page: page - 1, size, featureCode: featureCode.trim() } }))
