import { wgs84ToGcj02 } from './coords'

const QQMAP_KEY = 'BSTBZ-7EECN-MQEFW-S4VWD-SDM3J-GVBQW'

const jsonp = ({ url, callbackParam = 'callback', timeout = 12000 }) =>
  new Promise((resolve, reject) => {
    const callbackName = `qqmap_jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    let timeoutId

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (window[callbackName]) delete window[callbackName]
      if (script && script.parentNode) script.parentNode.removeChild(script)
    }

    window[callbackName] = (data) => {
      cleanup()
      resolve(data)
    }

    const separator = url.includes('?') ? '&' : '?'
    script.src = `${url}${separator}${callbackParam}=${callbackName}`
    script.onerror = (err) => {
      cleanup()
      reject(err instanceof Error ? err : new Error('JSONP request failed'))
    }

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('JSONP request timed out'))
      }, timeout)
    }

    document.body.appendChild(script)
  })

export const searchPlaces = async (keyword, location) => {
  const trimmed = typeof keyword === 'string' ? keyword.trim() : ''
  if (!trimmed) return []
  if (!QQMAP_KEY) throw new Error('Missing Tencent Map key')

  let locationParam
  if (location) {
    const lat = Number(location.lat ?? location.latitude)
    const lng = Number(location.lng ?? location.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const gcj = wgs84ToGcj02(lng, lat)
      locationParam = `${gcj.lat},${gcj.lng}`
    }
  }

  const base = new URL('https://apis.map.qq.com/ws/place/v1/suggestion')
  base.searchParams.set('key', QQMAP_KEY)
  base.searchParams.set('keyword', trimmed)
  base.searchParams.set('output', 'jsonp')
  base.searchParams.set('page_size', '10')
  if (locationParam) base.searchParams.set('location', locationParam)

  const data = await jsonp({ url: base.toString(), callbackParam: 'callback' })
  if (data?.status !== 0 || !Array.isArray(data?.data)) {
    return []
  }

  return data.data.map((item, index) => {
    const loc = item.location || item.latlng || item.latLng
    const lat = Number(loc?.lat ?? loc?.latitude)
    const lng = Number(loc?.lng ?? loc?.longitude)
    const location =
      Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null
    const fallbackId = location
      ? `${location.longitude}-${location.latitude}`
      : `poi-${Date.now()}-${index}`

    return {
      id: item.id || fallbackId,
      title: item.title || '',
      address: item.address || '',
      location,
    }
  })
}

export default { searchPlaces }
