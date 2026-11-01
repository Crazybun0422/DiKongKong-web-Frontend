export function safeSourceUrl(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  if (!text || text.length > 2048 || /[\s\\]/.test(text) || !/^https?:\/\//i.test(text)) return ''
  try {
    const url = new URL(text)
    return url.hostname && !url.username && !url.password ? text : ''
  } catch { return '' }
}
