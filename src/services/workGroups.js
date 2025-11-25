import http from './http'
import { normalizeFileList } from './files'

const toPageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

const normalizeGroup = (group = {}) => {
  const images = normalizeFileList(group.images)
  const memberCount = Array.isArray(group.memberFeatureCodes) ? group.memberFeatureCodes.length : 0
  const markerCount = Array.isArray(group.pinIds) ? group.pinIds.length : 0

  return {
    ...group,
    images,
    avatarUrl: images?.[0]?.url || '',
    memberCount,
    markerCount,
  }
}

export const fetchAdminWorkGroups = async ({ page = 1, size = 10, status } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (status) {
    params.status = status
  }

  const response = await http.get('/admin/work-groups', { params })
  const data = response?.data?.data ?? {}
  const pageResult = toPageResult(data, { page, size })
  return {
    ...pageResult,
    content: (pageResult.content || []).map((item) => normalizeGroup(item)),
  }
}

export const banWorkGroup = async (id, { status = 'BANNED', reason } = {}) => {
  const payload = { status }
  if (reason) {
    payload.reason = reason
  }

  const response = await http.post(`/admin/work-groups/${id}/ban`, payload)
  const data = response?.data?.data ?? response?.data
  return normalizeGroup(data)
}

export default {
  fetchAdminWorkGroups,
  banWorkGroup,
}
