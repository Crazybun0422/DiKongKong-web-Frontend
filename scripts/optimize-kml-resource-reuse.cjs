const fs=require('node:fs');
const root='E:/source_code/wechat/DiKongKong-wechat-mini';
const file=`${root}/miniprogram/packages/uom4/components/uom-plugin/index.js`;
let s=fs.readFileSync(file,'utf8');
function rep(a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));s=s.replace(a,b);}
rep('      this._activeRequestTasks = new Set();','      this._activeRequestTasks = new Set();\n      this._tileRequestTasks = new Map();');
const a=s.indexOf('    trackRequest(request) {'),b=s.indexOf('    emitGraphics() {',a);
s=s.slice(0,a)+`    trackRequest(request, tileKey = "") {
      if (!request || !request.promise) return Promise.resolve(null);
      if (typeof request.abort === "function") {
        if (tileKey) this._tileRequestTasks.set(tileKey, request);
        else this._activeRequestTasks.add(request);
      }
      return request.promise.finally(() => {
        if (tileKey) {
          if (this._tileRequestTasks.get(tileKey) === request) this._tileRequestTasks.delete(tileKey);
        } else this._activeRequestTasks.delete(request);
      });
    },

    abortActiveRequests() {
      for (const request of Array.from(this._activeRequestTasks || [])) {
        try { request.abort(); } catch (_) {}
      }
      this._activeRequestTasks?.clear();
      // Viewport queries are obsolete immediately; static tiles may serve the next viewport.
      if (this._destroyed || this._enabled === false) this.retainTileRequests([]);
    },

    tileResourceKey(tile) {
      return tile?.key && tile?.url ? tile.key + "|" + tile.url : "";
    },

    retainTileRequests(tiles) {
      const wanted = new Set(tiles.map(tile => this.tileResourceKey(tile)));
      for (const [key, request] of this._tileRequestTasks || []) {
        if (wanted.has(key)) continue;
        this._tileRequestTasks.delete(key);
        this._tileResourcePromiseCache.delete(key);
        try { request.abort(); } catch (_) {}
      }
    },

`+s.slice(b);
rep('      const tileKey = tile?.key || "";','      const tileKey = this.tileResourceKey(tile);');
rep('          responseType: "arraybuffer"\n        }));','          responseType: "arraybuffer"\n        }), tileKey);');
rep('        const tileKeys = tiles.map((tile) => tile.key).sort().join("|");','        this.retainTileRequests(tiles);\n        const tileKeys = tiles.map((tile) => this.tileResourceKey(tile)).sort().join("|");');
fs.writeFileSync(file,s);
// Keep the existing independent-layer regression test wired to the real controller.
const check=`${root}/scripts/check-layer-setting-independence.cjs`;
let test=fs.readFileSync(check,'utf8');
test=test.replace("require:id=>id.endsWith('map-layer-settings')?", "require:id=>id==='./map-plugins'?require('../miniprogram/pages/map/utils/map-plugins'):id.endsWith('map-layer-settings')?");
fs.writeFileSync(check,test);
const source=fs.readFileSync('scripts/check-map-layer-flow.cjs','utf8').replace("const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';","const root=require('node:path').resolve(__dirname,'../miniprogram');");
fs.writeFileSync(`${root}/scripts/check-map-layer-flow.cjs`,source);
