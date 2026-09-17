export function extractGuideMedia(value) {
  const text = String(value || '').trim()
  // Extract media only; do not render HTML or execute its scripts.
  let source = text.startsWith('<') ? text.match(/\bsrc\s*=\s*["'](data:(?:video|image)\/[^"']+)["']/i)?.[1] : text
  if (source && !/^data:/i.test(source)) {
    if (source.length > 3000000 || !/^[a-z0-9+/=\s]+$/i.test(source)) throw new Error('invalid-guide-media')
    const data = source.replace(/\s/g, '')
    const bytes = atob(data)
    const starts = (...values) => values.every((value, index) => bytes.charCodeAt(index) === value)
    let mime = ''
    if (bytes.slice(4, 8) === 'ftyp') mime = 'video/mp4'
    else if (starts(0x1a, 0x45, 0xdf, 0xa3) && bytes.slice(0, 4096).includes('webm')) mime = 'video/webm'
    else if (bytes.startsWith('GIF87a') || bytes.startsWith('GIF89a')) mime = 'image/gif'
    else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) mime = 'image/png'
    else if (starts(0xff, 0xd8, 0xff)) mime = 'image/jpeg'
    else if (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP') mime = 'image/webp'
    if (!mime) throw new Error('invalid-guide-media')
    source = `data:${mime};base64,${data}`
  }
  if (!source || source.length > 3000000 || !/^data:(video\/(mp4|webm)|image\/(gif|png|jpeg|webp));base64,[a-z0-9+/=\s]+$/i.test(source)) throw new Error('invalid-guide-media')
  const comma = source.indexOf(',')
  const data = source.slice(comma + 1).replace(/\s/g, '')
  if (!atob(data).length) throw new Error('invalid-guide-media')
  return source.slice(0, comma + 1) + data
}

export const isGuideVideo = (url = '') => /^data:video\//i.test(url) || /\.(mp4|webm)(?:[?#]|$)/i.test(url)
