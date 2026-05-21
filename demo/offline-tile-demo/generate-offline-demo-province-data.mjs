import { mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')
const sourceRoot = path.join(repoRoot, 'demo', 'china_city_kml_by_province_with_province_outline')
const outputRoot = __dirname
const outputKmlDir = path.join(outputRoot, 'province-kml')
const outputDataFile = path.join(outputRoot, 'provinceData.js')

const PI = Math.PI
const A = 6378245.0
const EE = 0.00669342162296594323

const PROVINCE_META = {
  '北京市': { id: 'CN-11', slug: 'beijing' },
  '天津市': { id: 'CN-12', slug: 'tianjin' },
  '河北省': { id: 'CN-13', slug: 'hebei' },
  '山西省': { id: 'CN-14', slug: 'shanxi' },
  '内蒙古自治区': { id: 'CN-15', slug: 'inner-mongolia' },
  '辽宁省': { id: 'CN-21', slug: 'liaoning' },
  '吉林省': { id: 'CN-22', slug: 'jilin' },
  '黑龙江省': { id: 'CN-23', slug: 'heilongjiang' },
  '上海市': { id: 'CN-31', slug: 'shanghai' },
  '江苏省': { id: 'CN-32', slug: 'jiangsu' },
  '浙江省': { id: 'CN-33', slug: 'zhejiang' },
  '安徽省': { id: 'CN-34', slug: 'anhui' },
  '福建省': { id: 'CN-35', slug: 'fujian' },
  '江西省': { id: 'CN-36', slug: 'jiangxi' },
  '山东省': { id: 'CN-37', slug: 'shandong' },
  '河南省': { id: 'CN-41', slug: 'henan' },
  '湖北省': { id: 'CN-42', slug: 'hubei' },
  '湖南省': { id: 'CN-43', slug: 'hunan' },
  '广东省': { id: 'CN-44', slug: 'guangdong' },
  '广西壮族自治区': { id: 'CN-45', slug: 'guangxi' },
  '海南省': { id: 'CN-46', slug: 'hainan' },
  '重庆市': { id: 'CN-50', slug: 'chongqing' },
  '四川省': { id: 'CN-51', slug: 'sichuan' },
  '贵州省': { id: 'CN-52', slug: 'guizhou' },
  '云南省': { id: 'CN-53', slug: 'yunnan' },
  '西藏自治区': { id: 'CN-54', slug: 'tibet' },
  '陕西省': { id: 'CN-61', slug: 'shaanxi' },
  '甘肃省': { id: 'CN-62', slug: 'gansu' },
  '青海省': { id: 'CN-63', slug: 'qinghai' },
  '宁夏回族自治区': { id: 'CN-64', slug: 'ningxia' },
  '新疆维吾尔自治区': { id: 'CN-65', slug: 'xinjiang' },
  '台湾省': { id: 'CN-71', slug: 'taiwan' },
  '香港特别行政区': { id: 'CN-81', slug: 'hong-kong' },
  '澳门特别行政区': { id: 'CN-82', slug: 'macao' },
}

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI)) + (20.0 * Math.sin(2.0 * x * PI))) * 2.0 / 3.0
  ret += ((20.0 * Math.sin(y * PI)) + (40.0 * Math.sin(y / 3.0 * PI))) * 2.0 / 3.0
  ret += ((160.0 * Math.sin(y / 12.0 * PI)) + (320 * Math.sin(y * PI / 30.0))) * 2.0 / 3.0
  return ret
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * PI)) + (20.0 * Math.sin(2.0 * x * PI))) * 2.0 / 3.0
  ret += ((20.0 * Math.sin(x * PI)) + (40.0 * Math.sin(x / 3.0 * PI))) * 2.0 / 3.0
  ret += ((150.0 * Math.sin(x / 12.0 * PI)) + (300.0 * Math.sin(x / 30.0 * PI))) * 2.0 / 3.0
  return ret
}

function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lat, lng)) {
    return { lng, lat }
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)
  return {
    lng: lng + dLng,
    lat: lat + dLat,
  }
}

function roundCoord(value) {
  return Number(Number(value).toFixed(6))
}

function normalizeRing(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return null
  }

  const ring = []
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) {
      continue
    }
    const lng = Number(point[0])
    const lat = Number(point[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue
    }
    const last = ring[ring.length - 1]
    if (!last || last[0] !== lng || last[1] !== lat) {
      ring.push([lng, lat])
    }
  }

  if (ring.length < 3) {
    return null
  }

  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }

  return ring.length >= 4 ? ring : null
}

function parseCoordinatesText(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(',')
      if (parts.length < 2) {
        return null
      }
      const lng = Number(parts[0])
      const lat = Number(parts[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null
      }
      return [lng, lat]
    })
    .filter(Boolean)
}

function extractMatches(text, pattern) {
  const matches = []
  let match = pattern.exec(text)
  while (match) {
    matches.push(match)
    match = pattern.exec(text)
  }
  return matches
}

function parseKmlShapes(kmlText) {
  const polygonBlocks = extractMatches(String(kmlText || ''), /<Polygon\b[\s\S]*?<\/Polygon>/gi)
  const shapes = []

  for (const polygonMatch of polygonBlocks) {
    const polygonText = polygonMatch[0]
    const outerMatch = polygonText.match(/<outerBoundaryIs\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/outerBoundaryIs>/i)
      || polygonText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i)
    if (!outerMatch) {
      continue
    }

    const outerRing = normalizeRing(parseCoordinatesText(outerMatch[1]))
    if (!outerRing) {
      continue
    }

    const innerRings = extractMatches(
      polygonText,
      /<innerBoundaryIs\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/innerBoundaryIs>/gi,
    )
      .map((innerMatch) => normalizeRing(parseCoordinatesText(innerMatch[1])))
      .filter(Boolean)

    shapes.push({
      outerRing,
      innerRings,
    })
  }

  return shapes
}

function convertRingToGcj02(ring) {
  return ring.map(([lng, lat]) => {
    const point = wgs84ToGcj02(Number(lng), Number(lat))
    return [roundCoord(point.lng), roundCoord(point.lat)]
  })
}

function buildBounds(shapes) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const shape of shapes) {
    for (const ring of [shape.outerRing, ...(shape.innerRings || [])]) {
      for (const point of ring) {
        const lng = Number(point[0])
        const lat = Number(point[1])
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          continue
        }
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }

  return Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)
    ? {
      minLng: roundCoord(minLng),
      minLat: roundCoord(minLat),
      maxLng: roundCoord(maxLng),
      maxLat: roundCoord(maxLat),
    }
    : null
}

async function main() {
  const entries = await readdir(sourceRoot, { withFileTypes: true })
  const provinceDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'kml')
    .map((entry) => entry.name)
    .sort((a, b) => {
      const aMeta = PROVINCE_META[a]
      const bMeta = PROVINCE_META[b]
      if (aMeta && bMeta) {
        return aMeta.id.localeCompare(bMeta.id)
      }
      return a.localeCompare(b, 'zh-CN')
    })

  await rm(outputKmlDir, { recursive: true, force: true })
  await mkdir(outputKmlDir, { recursive: true })

  const provinces = []

  for (const provinceName of provinceDirs) {
    const meta = PROVINCE_META[provinceName]
    if (!meta) {
      throw new Error(`Missing province metadata for ${provinceName}`)
    }

    const sourceFileName = `${provinceName}_全省轮廓.kml`
    const sourceFile = path.join(sourceRoot, provinceName, sourceFileName)
    const targetFileName = `province-${meta.id.toLowerCase()}-${meta.slug}.kml`
    const targetFile = path.join(outputKmlDir, targetFileName)

    const kmlText = await readFile(sourceFile, 'utf8')
    await copyFile(sourceFile, targetFile)

    const wgsShapes = parseKmlShapes(kmlText)
    const gcjShapes = wgsShapes.map((shape) => ({
      outerRing: convertRingToGcj02(shape.outerRing),
      innerRings: (shape.innerRings || []).map(convertRingToGcj02),
    }))

    provinces.push({
      id: meta.id,
      slug: meta.slug,
      name: provinceName,
      sourceFileName,
      fileName: targetFileName,
      coordType: 'GCJ02',
      bounds: buildBounds(gcjShapes),
      shapes: gcjShapes,
    })
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    provinceCount: provinces.length,
    provinces,
  }

  const outputText = `window.OfflineProvinceData=${JSON.stringify(payload)};\n`
  await writeFile(outputDataFile, outputText, 'utf8')

  console.log(`Generated ${provinces.length} provinces`)
  console.log(`KML output: ${outputKmlDir}`)
  console.log(`Data output: ${outputDataFile}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
