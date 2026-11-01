declare global {
  interface Window {
    DroneGameNative?: { postMessage: (message: string) => void };
    __droneGameNativeReply?: (reply: string | { id: string; data?: unknown; error?: string }) => void;
  }
}
export const isNativeGame = typeof window.DroneGameNative?.postMessage === 'function';
const pending = new Map<string, { resolve: (data: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let serial = 0;
window.__droneGameNativeReply = raw => {
  let reply;
  try { reply = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
  const request = pending.get(reply.id);
  if (!request) return;
  clearTimeout(request.timer); pending.delete(reply.id);
  if (reply.error) request.reject(new Error(String(reply.error)));
  else request.resolve(reply.data);
};
export function nativeRequest<T = any>(action: 'achievement' | 'leaderboard' | 'myRank' | 'close' | 'controllerStatus' | 'controllerConnect' | 'controllerDisconnect' | 'controllerEnable' | 'controllerCalibrate', payload: object = {}): Promise<T> {
  if (!isNativeGame) return Promise.reject(new Error('请在低空星球 App 内使用此功能。'));
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${++serial}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(action.startsWith('controller')?'手柄响应超时，请重新连接 USB。':'连接超时，请检查网络后重试。')); }, 15000);
    pending.set(id, { resolve, reject, timer });
    try { window.DroneGameNative!.postMessage(JSON.stringify({ id, action, payload })); }
    catch { clearTimeout(timer); pending.delete(id); reject(new Error('暂时无法连接 App，请返回后重新进入。')); }
  });
}
