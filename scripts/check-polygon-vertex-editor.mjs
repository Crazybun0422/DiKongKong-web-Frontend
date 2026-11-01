import assert from 'node:assert/strict'
import { createPolygonVertexEditor, polygonRing, polygonEdgeMidpoint } from '../src/utils/polygonVertexEditor.js'
const points=[{latitude:30,longitude:114},{latitude:30,longitude:115},{latitude:31,longitude:115}]
const markers=[],tokens=[]
class LatLng { constructor(lat,lng){this.lat=lat;this.lng=lng} getLat(){return this.lat} getLng(){return this.lng} }
class Marker { constructor(options){Object.assign(this,options);markers.push(this)} getPosition(){return this.position} setMap(map){this.map=map} }
const maps={LatLng,Marker,MarkerImage:class{},Size:class{},Point:class{},event:{
 addListener(target,event,handler){const token={target,event,handler,active:true};tokens.push(token);return token},
 removeListener(token){token.active=false},
}}
const fire=(target,event,latLng)=>tokens.filter(t=>t.active&&t.target===target&&t.event===event).forEach(t=>t.handler({latLng}))
let preview,commits=[]
const create=ring=>createPolygonVertexEditor({maps,map:{},points:ring,onPreview:p=>preview=p,onCommit:p=>commits.push(p),vertexTitle:'vertex',midpointTitle:'midpoint'})
let editor=create([...points,points[0]])
assert.equal(markers.length,6,'closing duplicate must not create another marker')
const first=markers[0],newPoint=new LatLng(29.8,113.9)
fire(first,'dragging',newPoint)
assert.equal(commits.length,0,'preview must not rebuild handles during drag')
assert.equal(preview[0].latitude,29.8);assert.deepEqual(preview[0],preview.at(-1),'drag first preserves closing coordinate')
fire(first,'dragend',newPoint);assert.equal(commits.length,1)
editor.destroy();assert(tokens.every(t=>!t.active));assert(markers.every(m=>m.map===null))
fire(first,'dragend',new LatLng(20,100));assert.equal(commits.length,1,'destroyed editor cannot mutate another area')
markers.length=0;editor=create(points);const lastEdge=markers[5]
fire(lastEdge,'click');assert.equal(commits.at(-1).length,4)
assert.deepEqual(commits.at(-1)[3],polygonEdgeMidpoint(points[2],points[0]),'last-to-first edge insertion maintains vertex order')
editor.destroy();markers.length=0;editor=create([...points,points[0]])
fire(markers[1],'dragging',new LatLng(30.4,114.4));fire(markers[1],'dragend',new LatLng(30.4,114.4));fire(markers[1],'click')
assert.equal(commits.length,3,'dragend followed by click inserts only once')
assert.equal(commits.at(-1).length,5);assert.deepEqual(commits.at(-1)[1],{latitude:30.4,longitude:114.4})
assert.deepEqual(commits.at(-1)[0],commits.at(-1).at(-1));editor.destroy()
assert.equal(polygonRing([{latitude:NaN,longitude:0}]),null)
assert(Math.abs(polygonEdgeMidpoint({latitude:30,longitude:179},{latitude:30,longitude:-179}).longitude)===180)
console.log('PASS: live drag preview, closed/open rings, closing edge insertion, midpoint drag, exactly-once insertion and listener cleanup.')

// Rectangles keep adjacent edges aligned and reject collapsing to a line.
markers.length=0
const rectangle=[{latitude:31,longitude:114},{latitude:31,longitude:115},{latitude:30,longitude:115},{latitude:30,longitude:114}]
editor=createPolygonVertexEditor({maps,map:{},points:[...rectangle,rectangle[0]],mode:'RECTANGLE',onPreview:p=>preview=p,onCommit:p=>commits.push(p)})
assert.equal(markers.length,4)
let before=commits.length
fire(markers[0],'dragend',new LatLng(30,114))
assert.equal(commits.length,before,'collapsing a rectangle does not commit')
fire(markers[0],'dragging',new LatLng(31.2,113.8))
assert.deepEqual(preview[2],rectangle[2],'opposite corner remains fixed')
fire(markers[0],'dragend',new LatLng(31.2,113.8))
assert.equal(new Set(commits.at(-1).map(p=>p.latitude)).size,2)
assert.equal(new Set(commits.at(-1).map(p=>p.longitude)).size,2)
assert.deepEqual(commits.at(-1)[0],commits.at(-1).at(-1));editor.destroy()
markers.length=0
editor=createPolygonVertexEditor({maps,map:{},points:points.slice(0,2),mode:'PATH',onPreview:p=>preview=p,onCommit:p=>commits.push(p)})
assert.equal(markers.length,3,'a two-point buffer path has two endpoints and only one midpoint')
fire(markers[1],'click');assert.equal(commits.at(-1).length,3)
assert.deepEqual(commits.at(-1).at(-1),points[1]);editor.destroy()
console.log('PASS: rectangle resize/degenerate guard and open-path insertion.')
