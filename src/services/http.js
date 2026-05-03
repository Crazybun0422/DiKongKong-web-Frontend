import axios from 'axios'

const resolveProdBaseUrl = () => {
  if (typeof window === 'undefined') return '/api'
  return `${window.location.origin}/api`
}

const resolveDevBaseUrl = () => import.meta.env.VITE_API_BASE_URL || '/api'

export const API_BASE_URL = import.meta.env.DEV ? resolveDevBaseUrl() : resolveProdBaseUrl()

export const AUTH_TOKEN_KEY = 'dikongkong_token'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export default http
