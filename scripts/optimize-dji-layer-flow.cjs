const fs=require('node:fs'),path=require('node:path');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const files=new Map();
const read=f=>fs.readFileSync(`${root}/${f}`,'utf8').replace(/\r\n/g,'\n');
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,90));return s.replace(a,b);}
let f='packages/dji/components/dji-no-fly-layer/index.js',s=read(f);
s=rep(s,'    detached() {\n      this._activeRequestId = 0;','    detached() {\n      this.cancelDjiRequest();');
s=rep(s,'        this._activeRequestId = 0;\n        this._ready = false;', '        this.cancelDjiRequest();\n        this._ready = false;');
s=rep(s,'    fetchDjiZones(options = {}) {',`    cancelDjiRequest() {
      this._activeRequestId = 0;
      this._pendingRequestKey = "";
      const task = this._requestTask;
      this._requestTask = null;
      if (task && typeof task.abort === "function") task.abort();
    },

    fetchDjiZones(options = {}) {`);
s=rep(s,'      if (!force && !moved && !radiusDiff && !rectChanged) {',`      const requestKey = JSON.stringify([gcjRect, this._levels, this._drone]);
      if (this._activeRequestId && this._pendingRequestKey === requestKey) return;
      if (!force && !moved && !radiusDiff && !rectChanged && Array.isArray(this._lastAreas) &&
          prev.levels === this._levels && prev.drone === this._drone) {
        this.cancelDjiRequest();`);
s=rep(s,'      const requestId = ++this._requestSeq;', '      this.cancelDjiRequest();\n      const requestId = ++this._requestSeq;\n      this._pendingRequestKey = requestKey;');
s=rep(s,'        drone: this._drone || ""\n      })',`        drone: this._drone || "",
        onRequestTask: task => {
          if (this._activeRequestId === requestId) this._requestTask = task;
          else task?.abort();
        }
      })`);
s=rep(s,'            rect: gcjRect\n', '            rect: gcjRect,\n            levels: this._levels,\n            drone: this._drone\n');
s=rep(s,'            this._activeRequestId = 0;\n          }\n        });', '            this._activeRequestId = 0;\n            this._pendingRequestKey = "";\n            this._requestTask = null;\n          }\n        });');
files.set(f,s);
f='packages/dji/utils/dji.js';s=read(f);
s=rep(s,'function fetchDjiAreas({ rect, levels, drone }) {','function fetchDjiAreas({ rect, levels, drone, onRequestTask }) {');
s=rep(s,'    wx.request({','    const task = wx.request({');
s=rep(s,'          body.data?.zones ||\n          [];\n        resolve(Array.isArray(areas) ? areas : []);','          body.data?.zones;\n        if (!Array.isArray(areas)) {\n          reject(new Error("Invalid DJI areas response"));\n          return;\n        }\n        resolve(areas);');
s=rep(s,'    });\n  });\n}', '    });\n    if (typeof onRequestTask === "function") onRequestTask(task);\n  });\n}');files.set(f,s);
for(const [f,s] of files){const dest=path.resolve('artifacts/map-layer-flow-before',f);if(fs.existsSync(dest))throw Error('Backup exists');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(`${root}/${f}`,dest);fs.writeFileSync(`${root}/${f}`,s);console.log(f);}
