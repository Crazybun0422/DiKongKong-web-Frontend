const fs = require('node:fs');
const root = 'E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const edits = [];
function replace(source, before, after) {
  if (!source.includes(before)) throw new Error(`Missing expected source: ${before}`);
  return source.replace(before, after);
}
for (const pkg of ['uom', 'uom5']) {
  const path = `${root}/packages/${pkg}/components/uom-plugin/index.js`;
  let source = fs.readFileSync(path, 'utf8');
  source = replace(source, 'const { nextUomOverlayId } = require("../../../../utils/uom-overlay-id");\n', '');
  source = replace(source, '      this._wmsOverlayZoom = null;\n', '      this._wmsOverlaySeed = 0;\n      this._wmsOverlayZoom = null;\n');
  source = replace(source, '      const currentHandles = this._wmsOverlayMap;', '      this._wmsOverlaySeed = this._wmsOverlaySeed || 0;\n      const currentHandles = this._wmsOverlayMap;');
  source = replace(source, 'const overlayId = nextUomOverlayId();', 'const overlayId = ++this._wmsOverlaySeed;');
  edits.push([path, source]);
}
const path = `${root}/pages/map/utils/map-plugins.js`;
let source = fs.readFileSync(path, 'utf8');
source = replace(source,
  '  // Switching back reuses the component, including its in-flight native cleanup.\n' +
  '  // Only a new component instance needs initialization.\n' +
  '  const shouldInit = page._uomPluginInitState?.[source] !== plugin;',
  '  const shouldInit = sourceChanged || !page._uomPluginInitState?.[source];');
source = replace(source, '    page._uomPluginInitState[source] = plugin;', '    page._uomPluginInitState[source] = true;');
edits.push([path, source]);
// Validate all replacements before writing, preserving all earlier unrelated changes.
for (const [path, source] of edits) fs.writeFileSync(path, source);
fs.unlinkSync(`${root}/utils/uom-overlay-id.js`);
console.log('Restored the three source files to their state before the last change; removed the new allocator.');
