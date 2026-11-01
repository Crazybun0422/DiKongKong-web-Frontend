import type { Flight } from './drone';
import { course, courseX, courseHeight } from './courses';
import { VISUAL_TRAVEL_SCALE, visualTravel, projectRacePoint, type RaceCamera } from './race-camera';
import { paintGround } from './scenery';

type Point = { x: number; y: number; depth: number };
export function onScreen(points: Point[], width: number, height: number, margin = 2) {
  return !points.every(p => p.x < -margin) && !points.every(p => p.x > width + margin)
    && !points.every(p => p.y < -margin) && !points.every(p => p.y > height + margin);
}

/** Same course geometry, fewer subpixel decorations on the native 2D bridge. */
export function drawMobileRoad(ctx: CanvasRenderingContext2D, width: number, height: number, state: Flight, camera: RaceCamera) {
  const id = state.courseId ?? 'valley', colors = course(id), unit = 12 / VISUAL_TRAVEL_SCALE;
  const current = Math.floor(state.distance / unit);
  const project = (x: number, y: number, z: number) => projectRacePoint(camera, x, y, state.distance + visualTravel(z - state.distance), width, height);
  const poly = (points: Point[], color: string) => {
    if (points.some(point => point.depth < .5) || !onScreen(points, width, height)) return;
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.fill();
  };
  const shoulder = id === 'alien' ? '#62616a' : id === 'snow' ? '#e2eeee' : id === 'canyon' ? '#c29972' : id === 'coast' ? '#667d80' : id === 'city' ? '#475168' : '#759567';
  const alternate = id === 'alien' ? '#35414c' : id === 'city' ? '#29394b' : id === 'coast' ? '#8e9d9c' : id === 'canyon' ? '#97806a' : id === 'snow' ? '#7c98a6' : '#4f5d5b';
  for (let end = 45; end > -2;) {
    // Preserve the original near-road segments. Three distant segments share
    // a strip, where their projected variation is below a few screen pixels.
    const span = end > 15 ? 3 : 1, start = end - span;
    const segment = current + start, z = segment * unit, zz = (current + end) * unit;
    end = start; if (z < 0) continue;
    const x = courseX(z, id), xx = courseX(zz, id), y = courseHeight(z, id) - 9, yy = courseHeight(zz, id) - 9;
    const road = [project(x - 24, y, z), project(xx - 24, yy, zz), project(xx + 24, yy, zz), project(x + 24, y, z)];
    if (!onScreen(road, width, height, 16)) continue;
    poly([project(x - 29, y - .25, z), project(xx - 29, yy - .25, zz), project(xx + 29, yy - .25, zz), project(x + 29, y - .25, z)], shoulder);
    poly(road, segment % 2 ? alternate : colors.road);
    // Keep the entire nearby asphalt continuous; alternate textured strips
    // create visible bands even though they are cheaper to draw.
    if (start < 6) {
      const eye: [number, number, number] = [camera.eye[0], camera.eye[1], state.distance + (camera.eye[2] - state.distance) / VISUAL_TRAVEL_SCALE];
      paintGround(ctx, [[x - 24, y + .006, z], [xx - 24, yy + .006, zz], [xx + 24, yy + .006, zz], [x + 24, y + .006, z]], point => project(...point), eye, colors.road);
    }
    for (const side of [-1, 1]) {
      poly([project(x + side * 24, y + .02, z), project(xx + side * 24, yy + .02, zz), project(xx + side * 22.5, yy + .02, zz), project(x + side * 22.5, y + .02, z)], segment % 2 ? '#cedbd6' : colors.glow);
      const rail = side * 24.5;
      if (start < 8) {
        for (const [low, high, color] of [[.70, .88, '#87979d'], [.88, 1.06, '#d0d7d5'], [1.06, 1.22, '#65767e']] as const)
          poly([project(x + rail, y + low, z), project(xx + rail, yy + low, zz), project(xx + rail, yy + high, zz), project(x + rail, y + high, z)], color);
      } else poly([project(x + rail, y + .7, z), project(xx + rail, yy + .7, zz), project(xx + rail, yy + 1.22, zz), project(x + rail, y + 1.22, z)], '#a4b3b8');
      if (start < 8 && segment % 2 === 0) {
        const base = project(x + rail, y, z), top = project(x + rail, y + 1.5, z);
        if (base.depth > .5 && onScreen([base, top], width, height)) {
          ctx.strokeStyle = '#a4b3b8'; ctx.lineWidth = Math.max(.65, base.k * .13); ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
        }
      }
    }
    // Thin distant lane dashes and roadside bolts are subpixel at this point.
    if (start < 12) for (const dz of [0, 6]) for (const lane of [-10, 10]) {
      const az = z + dz / VISUAL_TRAVEL_SCALE, ax = courseX(az, id), ay = courseHeight(az, id) - 8.95;
      const ez = az + 1.6 / VISUAL_TRAVEL_SCALE, ex = courseX(ez, id), ey = courseHeight(ez, id) - 8.95;
      poly([project(ax + lane - .1, ay, az), project(ex + lane - .1, ey, ez), project(ex + lane + .1, ey, ez), project(ax + lane + .1, ay, az)], '#c0ccc7');
    }
  }
}
