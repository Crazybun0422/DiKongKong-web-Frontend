import { fetchDjiAreas, buildAreaGraphics } from './airspaceDji'
import { gcj02ToWgs84 } from './coords'

// Same source, GCJ/WGS conversion and graphics palette as the home airspace map.
export function createDjiReferenceLayer({ maps, map, onState, request = fetchDjiAreas }) {
  let enabled = true, drone = 'dji-mavic-3', disposed = false
  let timer, controller, generation = 0, lastKey = '', lastState = 'empty', overlays = []
  const clear = () => { overlays.forEach(o => o.setMap(null)); overlays = [] }
  const color = (value, fallback) => {
    const hex = (value || '#DE4329').replace('#', '')
    const opacity = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : fallback
    return { value: new maps.Color(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), opacity), opacity }
  }
  const style = (stroke, fill, width) => {
    const s = color(stroke, .95), f = color(fill, .4)
    return { map, strokeColor: s.value, fillColor: f.value, strokeOpacity: s.opacity,
      fillOpacity: f.opacity, strokeWeight: width || 1, zIndex: 1, clickable: false }
  }
  const load = async () => {
    if (disposed || !enabled) return
    const bounds = map.getBounds?.(), ne = bounds?.getNorthEast(), sw = bounds?.getSouthWest()
    if (!ne || !sw) return // First map idle/bounds event supplies the real viewport.
    const lt = gcj02ToWgs84(sw.getLng(), ne.getLat()), rb = gcj02ToWgs84(ne.getLng(), sw.getLat())
    const rect = { ltlat: lt.lat, ltlng: lt.lng, rblat: rb.lat, rblng: rb.lng }
    const key = JSON.stringify({ rect, drone })
    if (key === lastKey) { onState(lastState); return }
    const token = ++generation
    controller?.abort(); controller = new AbortController()
    onState('loading')
    try {
      const areas = await request({ rect, drone, levels: '2,6,1,4,3,7,8,10', signal: controller.signal })
      if (disposed || !enabled || token !== generation) return
      const graphics = buildAreaGraphics(areas)
      clear()
      graphics.polygons.forEach(p => overlays.push(new maps.Polygon({ ...style(p.strokeColor, p.fillColor, p.strokeWidth), path: p.points.map(p => new maps.LatLng(p.latitude, p.longitude)) })))
      graphics.circles.forEach(c => overlays.push(new maps.Circle({ ...style(c.color, c.fillColor, c.strokeWidth), center: new maps.LatLng(c.latitude, c.longitude), radius: c.radius })))
      lastKey = key
      lastState = overlays.length ? 'ready' : 'empty'
      onState(lastState)
    } catch (error) {
      if (disposed || token !== generation || error.name === 'AbortError') return
      clear(); lastKey = ''; onState('error')
    }
  }
  const schedule = () => {
    clearTimeout(timer)
    ++generation; controller?.abort()
    if (enabled && !disposed) timer = setTimeout(load, 350)
  }
  const listeners = ['bounds_changed', 'idle'].map(event => maps.event.addListener(map, event, schedule))
  schedule()
  return {
    configure(nextEnabled, nextDrone) {
      enabled = nextEnabled; drone = nextDrone; lastKey = ''
      if (!enabled) { clear(); onState('off') }
      schedule()
    },
    refresh() { lastKey = ''; schedule() },
    destroy() {
      disposed = true; ++generation; clearTimeout(timer); controller?.abort()
      listeners.forEach(t => maps.event.removeListener(t)); clear()
    },
  }
}
