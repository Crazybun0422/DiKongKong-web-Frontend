// Edit completed QQ Maps polygons, rectangles and open buffered paths without rebuilding a dragged handle.
const same = (a, b) => a.latitude === b.latitude && a.longitude === b.longitude
const coordinate = point => {
  const latitude = Number(point?.getLat?.() ?? point?.latitude)
  const longitude = Number(point?.getLng?.() ?? point?.longitude)
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null
}
export function polygonRing(points) {
  const coordinates = points.map(coordinate)
  if (coordinates.some(point => !point)) return null
  const closed = coordinates.length > 1 && same(coordinates[0], coordinates.at(-1))
  return { vertices: closed ? coordinates.slice(0, -1) : coordinates, closed }
}
export function polygonEdgeMidpoint(a, b) {
  // QQ Maps uses Mercator. Place the handle on the visible straight edge.
  const y = latitude => Math.log(Math.tan(Math.PI / 4 + Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 360))
  let delta = b.longitude - a.longitude
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  const longitude = ((a.longitude + delta / 2 + 540) % 360) - 180
  const latitude = (2 * Math.atan(Math.exp((y(a.latitude) + y(b.latitude)) / 2)) - Math.PI / 2) * 180 / Math.PI
  return { latitude, longitude }
}
const icon = (maps, midpoint) => {
  const svg = midpoint
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="white" stroke="#256beb" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="#256beb" stroke-width="2"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#256beb" stroke="white" stroke-width="3"/></svg>'
  return new maps.MarkerImage('data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    new maps.Size(24, 24), new maps.Point(0, 0), new maps.Point(12, 12), new maps.Size(24, 24))
}
export function createPolygonVertexEditor({ maps, map, points, onPreview, onCommit, vertexTitle, midpointTitle, mode = 'POLYGON' }) {
  const ring = polygonRing(points)
  if (ring && mode === 'PATH') { ring.vertices = points.map(coordinate); ring.closed = false }
  if (!ring || ring.vertices.length < (mode === 'CIRCLE' ? 1 : mode === 'PATH' ? 2 : 3)) return { destroy() {} }
  const { vertices, closed } = ring, markers = [], listeners = []
  let disposed = false, committed = false
  const valid = () => !disposed && !committed
  const pathFor = (index, point, insert) => {
    const next = vertices.map(p => ({ ...p }))
    if (mode === 'RECTANGLE') {
      // Keep the opposite corner fixed and both adjacent edges axis-aligned.
      const original = vertices[index]
      for (const vertex of next) {
        if (vertex.latitude === original.latitude) vertex.latitude = point.latitude
        if (vertex.longitude === original.longitude) vertex.longitude = point.longitude
      }
    } else if (insert) next.splice(index + 1, 0, point)
    else next[index] = point
    if (closed) next.push({ ...next[0] })
    return next
  }
  const vertexIcon = icon(maps, false), midpointIcon = icon(maps, true)
  const add = (point, index, insert) => {
    const marker = new maps.Marker({ map, position: new maps.LatLng(point.latitude, point.longitude),
      icon: insert ? midpointIcon : vertexIcon, draggable: true, clickable: true,
      zIndex: insert ? 10001 : 10002, cursor: 'grab', title: insert ? midpointTitle : vertexTitle })
    markers.push(marker)
    const read = event => coordinate(event?.latLng || marker.getPosition())
    const commit = position => {
      if (!valid() || !position) return
      const next = pathFor(index, position, insert)
      if (mode === 'RECTANGLE' && (new Set(next.map(p => p.latitude)).size < 2 || new Set(next.map(p => p.longitude)).size < 2)) {
        marker.setPosition?.(new maps.LatLng(point.latitude, point.longitude))
        onPreview(points.map(coordinate))
        return
      }
      committed = true
      onCommit(next)
    }
    listeners.push(maps.event.addListener(marker, 'dragging', event => {
      const position = read(event)
      if (valid() && position) onPreview(pathFor(index, position, insert))
    }))
    listeners.push(maps.event.addListener(marker, 'dragend', event => commit(read(event))))
    if (insert) listeners.push(maps.event.addListener(marker, 'click', () => commit(point)))
  }
  vertices.forEach((point, index) => {
    add(point, index, false)
    if (!['RECTANGLE', 'CIRCLE'].includes(mode) && (mode !== 'PATH' || index < vertices.length - 1))
      add(polygonEdgeMidpoint(point, vertices[(index + 1) % vertices.length]), index, true)
  })
  return {
    destroy() {
      disposed = true
      listeners.forEach(listener => maps.event.removeListener(listener))
      markers.forEach(marker => marker.setMap(null))
    },
  }
}
