// Pure V21 calculations embedded in the existing Java backend. No web/Node APIs.
import { AIRFRAMES, airframeSketch, buildFromSketch, getAirframe } from './lib/airframes';
import { COLORS, initialFlight, stepFlight, type Stroke } from './lib/drone';
import { COURSES, validCourse } from './lib/courses';
import { MAX_SKETCH_POINTS, MAX_SKETCH_STROKES } from './lib/sketch-shape';

function parse(raw: string): Record<string, any> {
  if (typeof raw !== 'string' || raw.length > 4_000_000) throw new Error('请求内容过大');
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求格式不正确');
  return value;
}
function checkedStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_SKETCH_STROKES) throw new Error('请先选择机型或绘制无人机');
  let total = 0;
  return value.map(stroke => {
    if (!Array.isArray(stroke) || stroke.length < 2 || stroke.length > 2000) throw new Error('画稿格式不正确');
    total += stroke.length;
    if (total > MAX_SKETCH_POINTS) throw new Error('画稿过于复杂，请减少笔画');
    return stroke.map(point => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 500 || point.y < 0 || point.y > 500) throw new Error('画稿坐标不正确');
      return { x: point.x, y: point.y };
    });
  });
}
const engine = {
  metadata: (_raw: string) => JSON.stringify({ version: 21, airframeCount: AIRFRAMES.length, courses: COURSES.map(c => c.id), maxSketchStrokes: MAX_SKETCH_STROKES, maxSketchPoints: MAX_SKETCH_POINTS }),
  buildDrone(raw: string) {
    const p = parse(raw);
    if (p.catalogId !== undefined && (typeof p.catalogId !== 'string' || !getAirframe(p.catalogId))) throw new Error('机型不存在，请重新选择');
    if (p.sketchMode !== undefined && !['structure', 'silhouette'].includes(p.sketchMode)) throw new Error('生成方式不正确');
    const strokes = p.strokes === undefined && p.catalogId ? airframeSketch(p.catalogId) : checkedStrokes(p.strokes);
    const color = typeof p.color === 'string' && /^#[a-f0-9]{6}$/i.test(p.color) ? p.color : COLORS[0];
    return JSON.stringify(buildFromSketch(strokes, color, p.catalogId, p.sketchMode));
  },
  initialFlight(raw: string) {
    const p = parse(raw), id = p.courseId ?? 'valley';
    if (!validCourse(id)) throw new Error('赛场不存在，请重新选择');
    if (p.crashSeed !== undefined && (!Number.isInteger(p.crashSeed) || p.crashSeed < 0 || p.crashSeed > 4294967295)) throw new Error('机体随机种子无效');
    if (p.controlMode !== undefined && !['fpv', 'stabilized'].includes(p.controlMode)) throw new Error('飞行模式无效');
    return JSON.stringify(initialFlight(id, p.crashSeed, p.controlMode));
  },
  stepFlight(raw: string) {
    const p = parse(raw), input = p.input;
    if (!input || !Number.isFinite(input.steer) || Math.abs(input.steer) > 1 || !Number.isFinite(input.lift) || Math.abs(input.lift) > 1 || typeof input.boost !== 'boolean' || typeof input.brake !== 'boolean' || !Number.isFinite(p.dt) || p.dt < 0 || p.dt > 1.5) throw new Error('飞行控制格式不正确');
    if (!p.state || !p.drone || !validCourse(p.state.courseId)) throw new Error('飞行状态无效');
    if (p.controlMode !== undefined && !['fpv', 'stabilized'].includes(p.controlMode)) throw new Error('飞行模式无效');
    return JSON.stringify(stepFlight(p.state, p.drone, input.steer, input.boost, p.dt, input.lift, input.brake, p.controlMode));
  },
};
(globalThis as typeof globalThis & { DroneRaceEngine: typeof engine }).DroneRaceEngine = Object.freeze(engine);
