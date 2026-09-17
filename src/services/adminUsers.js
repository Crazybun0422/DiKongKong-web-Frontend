import http from './http'

const toPageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

export const fetchAdminUsers = async ({
  page = 1,
  size = 10,
  keyword = '',
  sortOrder,
  flp,
  member,
} = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (flp) {
    params.flp = flp
  } else {
    params.sortOrder = sortOrder ?? 'DESC'
  }

  const hasKeyword = keyword && keyword.trim()
  const url = hasKeyword ? '/admin/users/search' : '/admin/users'

  if (hasKeyword) {
    params.keyword = keyword.trim()
  }
  if (typeof member === 'boolean') {
    params.member = member
  }

  const response = await http.get(url, { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export const fetchAdminOnlineUsers = async ({ page = 1, size = 20, keyword = '', signal } = {}) => {
  const response = await http.get('/admin/users/online', {
    params: { page: Math.max(page - 1, 0), size, keyword: keyword.trim() },
    signal,
  })
  const payload = response?.data?.data
  if (!response?.data?.success || !payload) throw new Error('Online users response unavailable')
  return { ...payload, ...toPageResult(payload, { page, size }) }
}

export const fetchAdminOnlineUserDetail = async (featureCode, signal) => {
  const response = await http.get(`/admin/users/online/${encodeURIComponent(featureCode)}`, { signal })
  if (!response?.data?.success || !response?.data?.data) throw new Error('Online user detail unavailable')
  return response.data.data
}

export const fetchAdminUserCheckins = async ({ page = 1, size = 10, sortOrder } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
    sortOrder: sortOrder ?? 'DESC',
  }

  const response = await http.get('/admin/users/checkins', { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export const fetchAdminUserNewbieTasks = async ({ page = 1, size = 10, sortOrder } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
    sortOrder: sortOrder ?? 'DESC',
  }

  const response = await http.get('/admin/users/newbie-tasks', { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export const fetchMemberAircraftModelStats = async () => {
  const response = await http.get('/admin/users/aircraft-model-stats')
  const data = response?.data?.data ?? {}
  const items = Array.isArray(data?.items) ? data.items : []
  return {
    totalUsers: Number(data?.totalUsers ?? data?.totalMembers ?? 0),
    items: items.map((item) => ({
      ...item,
      userCount: Number(item?.userCount ?? item?.memberCount ?? 0),
    })),
  }
}

export const refreshAdminUsersDefaultAvatar = async () => {
  const response = await http.post('/admin/users/avatar/default/refresh')
  return response?.data?.data ?? response?.data ?? {}
}

export default {
  fetchAdminOnlineUsers,
  fetchAdminOnlineUserDetail,
  fetchAdminUsers,
  fetchAdminUserCheckins,
  fetchAdminUserNewbieTasks,
  fetchMemberAircraftModelStats,
  refreshAdminUsersDefaultAvatar,
}
