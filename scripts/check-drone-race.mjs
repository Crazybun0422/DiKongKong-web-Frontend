import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { build } from 'esbuild';

// Node is a development/build tool only. Production gameplay runs in the existing Java JAR.
const context = createContext({});
const generated = await readFile('.game-build/java-engine/engine-v21.js', 'utf8');
const manifest = JSON.parse(await readFile('.game-build/java-engine/manifest.json', 'utf8'));
assert.equal(createHash('sha256').update(generated).digest('hex'), manifest.sha256);
runInContext(generated, context, { timeout: 5000 });
const engine = context.DroneRaceEngine;
const invoke = (method, value) => JSON.parse(engine[method](JSON.stringify(value)));
const reference = await build({ stdin: { contents: `export * from './src/games/drone-race/lib/airframes'; export {initialFlight,stepFlight,COLORS} from './src/games/drone-race/lib/drone'; export {COURSES} from './src/games/drone-race/lib/courses';`, resolveDir: process.cwd(), loader: 'ts' }, write: false, bundle: true, platform: 'neutral', format: 'iife', globalName: 'ReferenceV21', target: 'es2020' });
runInContext(reference.outputFiles[0].text, context, { timeout: 5000 });
const source = context.ReferenceV21;
const plain = value => JSON.parse(JSON.stringify(value));
assert.equal(invoke('metadata', {}).airframeCount, 277);
for (const aircraft of source.AIRFRAMES) {
  const input = { catalogId: aircraft.id, color: '#7adca4' };
  assert.deepEqual(invoke('buildDrone', input), plain(source.buildFromSketch(source.airframeSketch(aircraft.id), input.color, aircraft.id)), aircraft.id);
}
const controls = [
  { steer: 0, lift: 0, boost: false, brake: false },
  { steer: .32, lift: .68, boost: true, brake: false },
  { steer: -.7, lift: -.42, boost: true, brake: true },
];
for (const course of source.COURSES) {
  for (const id of [source.AIRFRAMES[0].id, 'camera-2', 'racing-1']) {
    const drone = source.createAirframe(id);
    let expected = source.initialFlight(course.id, 42), actual = invoke('initialFlight', { courseId: course.id, crashSeed: 42 });
    for (let i = 0; i < 180; i++) {
      const input = controls[Math.floor(i / 60)], dt = .1;
      expected = source.stepFlight(expected, drone, input.steer, input.boost, dt, input.lift, input.brake);
      actual = invoke('stepFlight', { state: actual, drone, input, dt });
      assert.deepEqual(actual, plain(expected), `${course.id}/${id} step ${i}`);
    }
  }
}
assert.throws(() => invoke('initialFlight', { courseId: 'bad' }), /赛场/);
assert.throws(() => invoke('buildDrone', { catalogId: 'bad' }), /机型/);
assert.throws(() => invoke('buildDrone', { strokes: [[{ x: -1, y: 0 }, { x: 2, y: 3 }]] }), /坐标/);
const drone = invoke('buildDrone', { catalogId: 'camera-2' }), state = invoke('initialFlight', { courseId: 'coast' });
assert.throws(() => invoke('stepFlight', { state, drone, input: { ...controls[0], steer: 3 }, dt: .1 }), /控制/);
assert.throws(() => invoke('stepFlight', { state, drone, input: controls[0], dt: 99 }), /控制/);
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(packageJson.scripts['race-server'], undefined);
assert.equal(packageJson.scripts['build:race-server'], undefined);
assert.equal((await readFile('vite.config.js', 'utf8')).includes('7011'), false);
assert.equal((await readFile('src/games/drone-race/drone-lab.tsx', 'utf8')).includes('nativeRequest("ticket")'), false);
console.log('PASS: Java embedded V21 engine hash, 277 aircraft, six-course numerical parity, input bounds and no standalone Node service');
