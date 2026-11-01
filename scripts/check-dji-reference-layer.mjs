import assert from 'node:assert/strict'
import { build } from 'esbuild'
const bundled = await build({entryPoints:['src/utils/djiReferenceLayer.js'],bundle:true,write:false,platform:'node',format:'esm'})
const {createDjiReferenceLayer} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const tokens=[],shapes=[],requests=[],states=[]
class LatLng {constructor(lat,lng){this.lat=lat;this.lng=lng} getLat(){return this.lat} getLng(){return this.lng}}
class Shape {constructor(options){Object.assign(this,options);shapes.push(this)} setMap(m){this.map=m}}
const maps={LatLng,Polygon:Shape,Circle:Shape,Color:class {constructor(...args){this.rgba=args}},event:{addListener(target,event,handler){const t={target,event,handler,active:true};tokens.push(t);return t},removeListener(t){t.active=false}}}
let lng=114
const map={getBounds:()=>({getNorthEast:()=>new LatLng(31,lng+1),getSouthWest:()=>new LatLng(30,lng)})}
const pending=[]
const request=args=>{requests.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}))}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const graphics=[{level:2,color:'#DE4329',polygon_points:[[114,30],[114.1,30],[114.1,30.1],[114,30]]},{level:1,color:'#1088F2',shape:0,lng:114.2,lat:30.2,radius:350}]
const layer=createDjiReferenceLayer({maps,map,onState:s=>states.push(s),request})
const changed=()=>tokens.filter(t=>t.active&&t.event==='bounds_changed').forEach(t=>t.handler())
await wait(400);assert.equal(requests.length,1)
assert.notEqual(requests[0].rect.ltlng,114,'GCJ viewport converted to WGS once for upstream')
assert.equal(requests[0].drone,'dji-mavic-3')
pending[0].resolve(graphics);await wait(0)
assert.equal(shapes.filter(s=>s.map).length,2)
assert(shapes.every(s=>s.clickable===false&&s.zIndex===1))
assert.notEqual(shapes[0].path[0].getLng(),114,'upstream WGS geometry converted to GCJ')
assert.equal(shapes[1].radius,350)
assert.deepEqual(shapes[0].strokeColor.rgba.slice(0,3),[222,67,41])
lng=115;changed();await wait(400)
lng=116;changed();assert(requests[1].signal.aborted);await wait(400)
pending[2].resolve([graphics[1]]);await wait(0);pending[1].resolve(graphics);await wait(0)
assert.equal(shapes.filter(s=>s.map).length,1,'stale result never replaces current viewport')
layer.configure(false,'dji-mavic-3');assert.equal(shapes.filter(s=>s.map).length,0)
changed();await wait(400);assert.equal(requests.length,3,'disabled layer does not fetch')
layer.configure(true,'spark');await wait(400);assert.equal(requests[3].drone,'spark')
pending[3].reject(new Error('fixture error'));await wait(0);assert.equal(states.at(-1),'error')
layer.refresh();await wait(400);pending[4].resolve([]);await wait(0);assert.equal(states.at(-1),'empty')
lng=117;changed();await wait(400);layer.destroy();pending[5].resolve(graphics);await wait(0)
assert(tokens.every(t=>!t.active));assert.equal(shapes.filter(s=>s.map).length,0)
console.log('PASS: DJI palette/coordinates, viewport refresh, stale responses, switch, aircraft selection, retry and cleanup.')
