import http from './http'

const normalizePageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

const normalizeData = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback

export const fetchLadderGameAdminLeaderboard = async ({ page = 1, size = 10 } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  const response = await http.get('/ladder-game/admin/leaderboard', { params })
  const data = normalizeData(response, {})
  return normalizePageResult(data, { page, size })
}

export default {
  fetchLadderGameAdminLeaderboard,
}
