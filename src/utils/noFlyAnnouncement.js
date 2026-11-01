import http, { API_BASE_URL } from '../services/http'
export const emptyAnnouncement = () => ({ title:'', publisher:'', publishedAt:'', content:'', sourceUrl:'', attachments:[] })
const filePattern = /^\/api\/no-fly-zone-announcement-files\/[a-f0-9]{32}\.(png|jpe?g|gif|webp|pdf|docx?|xlsx?|pptx?)$/i
export const isAnnouncementFile = value => filePattern.test(value || '')
export const publicAnnouncementUrl = value => {
  if (!value) return ''
  if (isAnnouncementFile(value)) return API_BASE_URL.replace(/\/api\/?$/, '') + value
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : '' } catch { return '' }
}
const tags = new Set('p br h2 h3 h4 strong b em i u s ul ol li blockquote table thead tbody tr th td hr img a span div'.split(' '))
export function cleanAnnouncementHtml(html, display = false) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,svg,math,form,button,input,video,audio').forEach(n => n.remove())
  Array.from(doc.body.querySelectorAll('*')).forEach(n => {
    if (!tags.has(n.tagName.toLowerCase())) { n.replaceWith(...n.childNodes); return }
    const attrs = Object.fromEntries(Array.from(n.attributes).map(a => [a.name,a.value]))
    Array.from(n.attributes).forEach(a => n.removeAttribute(a.name))
    if (n.tagName === 'IMG') {
      let src = attrs.src || attrs['data-src'] || ''
      const base = API_BASE_URL.replace(/\/api\/?$/, '')
      if (base && src.startsWith(base+'/api/no-fly-zone-announcement-files/')) src = src.slice(base.length)
      if (publicAnnouncementUrl(src)) n.setAttribute('src', display ? publicAnnouncementUrl(src) : src)
      n.setAttribute('alt',attrs.alt || '公告配图')
    }
    if (n.tagName === 'A' && publicAnnouncementUrl(attrs.href)) {
      n.setAttribute('href', display ? publicAnnouncementUrl(attrs.href) : attrs.href)
      n.setAttribute('rel','noopener noreferrer'); n.setAttribute('target','_blank')
    }
    for (const a of ['colspan','rowspan']) if (/^[1-9]\d?$/.test(attrs[a] || '')) n.setAttribute(a,attrs[a])
  })
  return doc.body.innerHTML
}
export async function uploadAnnouncementFile(file) {
  if (!file || file.size > 20*1024*1024) throw new Error('文件不得超过20 MiB')
  const form = new FormData(); form.append('file',file)
  const {data} = await http.post('/admin/no-fly-zones/announcement-files',form,{timeout:120000})
  if (!data?.success || !isAnnouncementFile(data.data?.url)) throw new Error('附件上传失败')
  return data.data
}
