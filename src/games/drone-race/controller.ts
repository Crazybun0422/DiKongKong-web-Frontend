import { nativeRequest } from './native';

export type ControllerFrame = {
  status: string; message: string; fresh: boolean; takeover: boolean; axes: number[]; raw: number[];
  buttons: number; frames: number; rejected: number; rate: number; sampleAgeMs: number; hex: string;
  selected: number | null; port: number;
  devices: { id: number; name: string; vendorId: number; productId: number; cdc: boolean; ports: number; permission: boolean }[];
};
const idle: ControllerFrame = { status: 'idle', message: '连接 RC-N3 底部 USB-C 数据口，再点击连接', fresh: false, takeover: false,
  axes: [0, 0, 0, 0, 0], raw: [1024, 1024, 1024, 1024, 1024], buttons: 0, frames: 0, rejected: 0, rate: 0,
  sampleAgeMs: -1, hex: '', selected: null, port: -1, devices: [] };
let frame = idle, received = -Infinity;
export type ControllerSettings = { invertSteer: boolean; invertLift: boolean; invertThrottle: boolean };
let settings: ControllerSettings = { invertSteer: false, invertLift: false, invertThrottle: false };
try {
  const saved = JSON.parse(localStorage.getItem('drone-controller-settings') || '{}');
  settings = { invertSteer: saved.invertSteer === true, invertLift: saved.invertLift === true, invertThrottle: saved.invertThrottle === true };
} catch { /* defaults */ }
export const controllerSettings = () => settings;
export function setControllerSettings(value: ControllerSettings) {
  settings = value;
  try { localStorage.setItem('drone-controller-settings', JSON.stringify(value)); } catch { /* session settings still work */ }
}
function accept(next: ControllerFrame) {
  if (!next || !Array.isArray(next.axes) || next.axes.length < 4 || !next.axes.every(Number.isFinite)) return;
  frame = next; received = performance.now();
}
declare global { interface Window { __droneControllerFrame?: (frame: ControllerFrame) => void } }
window.__droneControllerFrame = accept;
window.addEventListener('blur', () => { frame = { ...frame, takeover: false, fresh: false }; received = -Infinity; });
export function controllerSnapshot(): ControllerFrame {
  if (!frame.fresh || frame.sampleAgeMs < 0 || performance.now() - received + frame.sampleAgeMs >= 300)
    return { ...frame, fresh: false, takeover: false };
  return frame;
}
export async function controllerCommand(action: 'controllerStatus' | 'controllerConnect' | 'controllerDisconnect' | 'controllerEnable' | 'controllerCalibrate', payload = {}) {
  const data = await nativeRequest<ControllerFrame>(action, payload); accept(data); return data;
}
const axis = (value: number) => Math.abs(value) <= .045 ? 0 : Math.sign(value) * Math.min(1, (Math.abs(value) - .045) / .955);
/** Called in the existing render loop. No HTTP, React update, or bridge call per frame. */
export function controllerInput() {
  const current = controllerSnapshot();
  if (!current.takeover || !current.fresh) return null;
  const throttle = current.axes[1] * (settings.invertThrottle ? -1 : 1);
  return { steer: axis(current.axes[2]) * (settings.invertSteer ? -1 : 1),
    lift: axis(current.axes[3]) * (settings.invertLift ? -1 : 1), boost: throttle > .2, brake: throttle < -.2 };
}
