import http from './http'

const normalizePayload = (response, fallback) => {
  const data = response?.data?.data ?? response?.data ?? fallback
  return data
}

export const fetchUserAgreements = async () => {
  const response = await http.get('/policies/user-agreements')
  return normalizePayload(response, [])
}

export const createUserAgreement = async (payload) => {
  const response = await http.post('/policies/user-agreements', payload)
  return normalizePayload(response, {})
}

export const updateUserAgreement = async (id, payload) => {
  const response = await http.put(`/policies/user-agreements/${encodeURIComponent(id)}`, payload)
  return normalizePayload(response, {})
}

export const deleteUserAgreement = async (id) => {
  const response = await http.delete(`/policies/user-agreements/${encodeURIComponent(id)}`)
  return normalizePayload(response, {})
}

export const downloadUserAgreementPdf = async (id) => {
  const response = await http.get(`/policies/user-agreements/${encodeURIComponent(id)}/pdf`, {
    responseType: 'blob',
  })
  return response
}

export const fetchPrivacyPolicies = async () => {
  const response = await http.get('/policies/privacy-policies')
  return normalizePayload(response, [])
}

export const createPrivacyPolicy = async (payload) => {
  const response = await http.post('/policies/privacy-policies', payload)
  return normalizePayload(response, {})
}

export const updatePrivacyPolicy = async (id, payload) => {
  const response = await http.put(`/policies/privacy-policies/${encodeURIComponent(id)}`, payload)
  return normalizePayload(response, {})
}

export const deletePrivacyPolicy = async (id) => {
  const response = await http.delete(`/policies/privacy-policies/${encodeURIComponent(id)}`)
  return normalizePayload(response, {})
}

export const downloadPrivacyPolicyPdf = async (id) => {
  const response = await http.get(`/policies/privacy-policies/${encodeURIComponent(id)}/pdf`, {
    responseType: 'blob',
  })
  return response
}

export default {
  fetchUserAgreements,
  createUserAgreement,
  updateUserAgreement,
  deleteUserAgreement,
  downloadUserAgreementPdf,
  fetchPrivacyPolicies,
  createPrivacyPolicy,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
  downloadPrivacyPolicyPdf,
}
