import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {formatDjiTime,formatDjiEffectiveTimes} from '../src/utils/djiEffectiveTimes.js'
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/dji/components/dji-no-fly-layer/'
const mod={exports:{}}
vm.runInNewContext(fs.readFileSync(root+'effective-times.js','utf8'),{module:mod})
const area={name:'临时禁飞区-szqy-4',level:2,begin_at:1794326400,end_at:1795363200}
const expected='2026-11-11 00:00至2026-11-23 00:00'
for(const format of [formatDjiEffectiveTimes,mod.exports.formatDjiEffectiveTimes]){
 assert.equal(format(area),expected)
 assert.equal(format({...area,end_at:1795363201}),'2026-11-11 00:00至2026-11-23 00:00')
 assert.equal(format({...area,begin_at:1794326401}),'2026-11-11 00:00至2026-11-23 00:00')
 assert.equal(format({begin_at:1794326401,end_at:1795363202}),'2026-11-11 00:00至2026-11-23 00:00')
 assert.equal(format({},area),expected,'subarea inherits parent times')
 assert.equal(format({begin_at:'1794326401'}),'2026-11-11 00:00')
 assert.equal(format({begin_at:null,end_at:0}), '')
 assert.equal(format({begin_at:'bad',end_at:-1}), '')
}
assert.equal(formatDjiTime(1794326400000),'','do not interpret invalid milliseconds as seconds')
let def
vm.runInNewContext(fs.readFileSync(root+'index.js','utf8'),{Component:d=>def=d,require:p=>p==='./effective-times'?mod.exports:p.endsWith('/coords')?{gcj02ToWgs84:()=>({lat:22.62,lng:114.16})}:{}})
const c={...def.methods,_enabled:true,areaContainsWgsPoint:()=>true}
const result=c.describeDjiStatus([area]);assert.equal(result.djiStatusExtra,area.name+'\n'+expected)
const inherited=c.describeDjiStatus([{...area,sub_areas:[{level:2}]}]);assert.equal(inherited.djiStatusExtra,area.name+'\n'+expected)
console.log('PASS: web/mini DJI minute precision, midnight retained, Beijing timezone, optional bounds, inherited subareas, no blank lines, actual board status.')
