import http from './http'

const normalizeData = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback

export const fetchDroneGameAdminLeaderboard = async ({ season = 'current', page = 1, size = 10 } = {}) => {
  const response = await http.get('/drone-game/admin/leaderboard', {
    params: { season, page: Math.max(page - 1, 0), size },
  })
  const data = normalizeData(response, {})
  return {
    season: data.season || '',
    content: data.items || [],
    page: typeof data.page === 'number' ? data.page + 1 : page,
    size: data.size ?? size,
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
  }
}

export default { fetchDroneGameAdminLeaderboard }
