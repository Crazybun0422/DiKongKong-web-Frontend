import { wgs84ToGcj02 } from './coords'

const getXmlElements = (parent, tagName) => {
  if (!parent || typeof parent.getElementsByTagNameNS !== 'function') return []
  return Array.from(parent.getElementsByTagNameNS('*', tagName))
}

const getFirstXmlText = (parent, tagName) => {
  const element = getXmlElements(parent, tagName)[0]
  return String(element?.textContent || '').trim()
}

const parseCoordinateText = (value) => {
  const chunks = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const coordinates = chunks
    .map((chunk) => {
      const [lngText, latText] = chunk.split(',')
      const lng = Number(lngText)
      const lat = Number(latText)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      const gcj = wgs84ToGcj02(lng, lat)
      return {
        latitude: Number(gcj.lat.toFixed(6)),
        longitude: Number(gcj.lng.toFixed(6)),
      }
    })
    .filter(Boolean)

  if (coordinates.length >= 2) {
    const first = coordinates[0]
    const last = coordinates[coordinates.length - 1]
    if (
      Math.abs(first.latitude - last.latitude) < 1e-9 &&
      Math.abs(first.longitude - last.longitude) < 1e-9
    ) {
      coordinates.pop()
    }
  }

  return coordinates
}

export const parseKmlRegion = (text) => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is unavailable')
  }

  const parser = new DOMParser()
  const xml = parser.parseFromString(String(text || ''), 'application/xml')
  const parserError = xml.getElementsByTagName('parsererror')[0]
  if (parserError) {
    throw new Error(parserError.textContent || 'KML parse failed')
  }

  const documentElement = getXmlElements(xml, 'Document')[0] || xml.documentElement
  const polygons = getXmlElements(documentElement, 'Polygon')
    .map((polygon) => {
      const coordinateText = getFirstXmlText(polygon, 'coordinates')
      return parseCoordinateText(coordinateText)
    })
    .filter((coordinates) => Array.isArray(coordinates) && coordinates.length >= 3)

  return {
    name: getFirstXmlText(documentElement, 'name') || getFirstXmlText(xml, 'name'),
    polygons,
  }
}
