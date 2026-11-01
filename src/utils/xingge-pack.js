import JSZip from 'jszip'

const TEST_VERSION = 'lowaltitude-star-v2-20261028'
const IMAGE_COUNT = 50
const describe = (value) => value === undefined ? '缺失' : JSON.stringify(value).slice(0, 120)

export async function inspectXinggePack(file) {
  if (!file.name.toLowerCase().endsWith('.zip') || file.size > 256 * 1024 * 1024) {
    throw new Error('请选择 256 MiB 以内的 ZIP 图包。')
  }
  const zip = await JSZip.loadAsync(file)
  const entry = zip.file('manifest.json')
  if (!entry || entry._data?.uncompressedSize > 65536) throw new Error('ZIP 根目录缺少有效的 manifest.json。')
  let manifest
  try { manifest = JSON.parse(await entry.async('string')) }
  catch (_) { throw new Error('manifest.json 不是有效的 JSON 文件。') }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('manifest.json 必须为 JSON 对象。')
  if (manifest.schemaVersion !== 2) throw new Error(`清单格式版本错误：schemaVersion 为 ${describe(manifest.schemaVersion)}，应为数字 2。`)
  if (manifest.testVersion !== TEST_VERSION) throw new Error(`测试版本不匹配：testVersion 为 ${describe(manifest.testVersion)}，应为 ${TEST_VERSION}。`)
  if (typeof manifest.resourceVersion !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(manifest.resourceVersion)) {
    throw new Error(`资源版本格式错误：resourceVersion 为 ${describe(manifest.resourceVersion)}，须为 1–100 位字母、数字、点、横线或下划线，并以字母或数字开头。`)
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== IMAGE_COUNT) {
    throw new Error(`清单图片数量不符：entries 为 ${Array.isArray(manifest.entries) ? manifest.entries.length + ' 条' : '非数组'}，应为 ${IMAGE_COUNT} 条。`)
  }
  const images = Object.values(zip.files).filter(item => !item.dir && item.name.endsWith('.png'))
  if (images.length !== IMAGE_COUNT) throw new Error(`ZIP 实际包含 ${images.length} 张 PNG，应为 ${IMAGE_COUNT} 张。`)
  for (const item of manifest.entries) {
    if (!item || typeof item.file !== 'string' || item.file.includes('/') || item.file.includes('\\') || !zip.file(item.file)) {
      throw new Error(`清单图片在 ZIP 根目录中不存在：${describe(item?.file)}。`)
    }
  }
  return manifest
}
