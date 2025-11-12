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

  const response = await http.get(url, { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export default {
  fetchAdminUsers,
}
