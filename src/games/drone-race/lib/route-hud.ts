import type { Flight } from './drone';
import { COURSE_LENGTH, courseX } from './courses';

/** Logical Canvas pixels. Native clients supply their safe-area-aware bounds. */
export type RouteRect = { x: number; y: number; width: number; height: number };
export type RaceHudOptions = { routeRect?: RouteRect; mobile?: boolean; leftNotifications?: boolean };
type RoutePoint = { distance: number; x: number };
const routes = new Map<string, { points: RoutePoint[]; left: number; right: number }>();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function routeGeometry(id: Flight['courseId']) {
  const key = id ?? 'valley';
  let geometry = routes.get(key);
  if (!geometry) {
    const points: RoutePoint[] = [];
    for (let distance = 0; distance <= COURSE_LENGTH; distance += 24) points.push({ distance, x: courseX(distance, id) });
    geometry = { points, left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)) };
    routes.set(key, geometry);
  }
  return geometry;
}

function roundedCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const radius = Math.min(12, width / 4, height / 4);
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
}

/** Opt-in native HUD; the browser/Android default route rendering is unchanged. */
export function drawRouteCard(ctx: CanvasRenderingContext2D, state: Flight, rect: RouteRect) {
  const { x, y, width, height } = rect;
  if (![x, y, width, height].every(Number.isFinite) || width < 72 || height < 80) return false;
  const geometry = routeGeometry(state.courseId);
  const inset = 15, trackTop = y + 38, trackBottom = y + height - 14;
  const center = (geometry.left + geometry.right) / 2;
  const scale = (width - inset * 2) / Math.max(100, geometry.right - geometry.left + 24);
  const projectX = (offset: number) => x + width / 2 + (offset - center) * scale;
  const projectY = (distance: number) => trackBottom - clamp(distance / COURSE_LENGTH, 0, 1) * (trackBottom - trackTop);
  const distance = clamp(state.distance, 0, COURSE_LENGTH);

  ctx.save();
  roundedCard(ctx, x + .5, y + .5, width - 1, height - 1);
  ctx.fillStyle = 'rgba(12, 32, 29, .9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(187, 235, 164, .28)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '600 11px sans-serif'; ctx.fillStyle = '#eff8e8'; ctx.fillText('航线', x + 12, y + 17);
  ctx.font = '600 8px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#accc9b'; ctx.fillText('ROUTE', x + width - 12, y + 17);
  ctx.strokeStyle = 'rgba(211, 255, 182, .11)'; ctx.beginPath(); ctx.moveTo(x + 12, y + 29); ctx.lineTo(x + width - 12, y + 29); ctx.stroke();

  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2;
  ctx.beginPath();
  geometry.points.forEach((point, index) => index ? ctx.lineTo(projectX(point.x), projectY(point.distance)) : ctx.moveTo(projectX(point.x), projectY(point.distance)));
  ctx.strokeStyle = 'rgba(192, 218, 198, .35)'; ctx.stroke();
  ctx.beginPath();
  for (let index = 0; index < geometry.points.length; index++) {
    const point = geometry.points[index];
    if (point.distance > distance) break;
    if (index) ctx.lineTo(projectX(point.x), projectY(point.distance));
    else ctx.moveTo(projectX(point.x), projectY(point.distance));
  }
  ctx.lineTo(projectX(courseX(distance, state.courseId)), projectY(distance));
  ctx.strokeStyle = '#d0ff4b'; ctx.stroke();
  for (let gate = 160; gate < COURSE_LENGTH; gate += 180) {
    ctx.beginPath(); ctx.arc(projectX(courseX(gate, state.courseId)), projectY(gate), 1.5, 0, Math.PI * 2);
    ctx.fillStyle = gate <= distance ? '#d0ff4b' : '#789c83'; ctx.fill();
  }
  const markerX = clamp(projectX(courseX(distance, state.courseId) + state.x * 20), x + 10, x + width - 10);
  const markerY = projectY(distance);
  ctx.fillStyle = 'rgba(208, 255, 75, .2)'; ctx.beginPath(); ctx.arc(markerX, markerY, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d0ff4b'; ctx.beginPath(); ctx.arc(markerX, markerY, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f5ffdd'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.restore();
  return true;
}
