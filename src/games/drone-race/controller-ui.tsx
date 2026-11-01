import { useEffect, useState } from 'react';
import { Gamepad2, RefreshCw, Unplug } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from './ui';
import { controllerCommand, controllerSettings, controllerSnapshot, setControllerSettings } from './controller';
import './controller.css';

export function ControllerButton() {
  const [open, setOpen] = useState(false), [state, setState] = useState(controllerSnapshot);
  const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [settings, setSettings] = useState(controllerSettings);
  useEffect(() => { const timer = setInterval(() => setState(controllerSnapshot()), open ? 100 : 500); return () => clearInterval(timer); }, [open]);
  const run = async (action: Parameters<typeof controllerCommand>[0], payload = {}) => {
    setBusy(true); setError('');
    try { setState(await controllerCommand(action, payload)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (open) void run('controllerStatus'); }, [open]);
  useEffect(() => {
    if (!state.devices.some(d => String(d.id) === selected)) setSelected(String(state.devices.find(d => d.cdc)?.id ?? ''));
  }, [state.devices, selected]);
  const connectionPending = state.status === 'connecting' || state.status === 'permission';
  return <>
    <button type="button" className={`controller-entry ${state.fresh ? 'is-connected' : ''}`} aria-label="手柄连接" aria-expanded={open} onClick={() => setOpen(true)}><Gamepad2 size={19}/><i/></button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="controller-dialog">
      <DialogTitle><Gamepad2 size={22}/>手柄连接</DialogTitle>
      <DialogDescription>RC-N3 底部 USB-C → 数据线 → 手机 OTG。连接后推动摇杆，确认下方读数。</DialogDescription>
      <div className={`controller-status ${state.fresh ? 'is-connected' : ''}`} role="status"><i/>{state.fresh ? '已连接 · 正在读取' : state.message}</div>
      <div className="controller-connect-row">
        <select aria-label="USB 设备" value={selected} disabled={busy || connectionPending} onChange={e => setSelected(e.target.value)}>
          {!state.devices.length && <option value="">未发现 USB 设备</option>}
          {state.devices.map(d => <option key={d.id} value={d.id} disabled={!d.cdc}>{d.name} · {d.cdc ? `CDC ${d.ports} 接口` : '非 CDC 设备'}</option>)}
        </select>
        <Button variant="outline" aria-label="刷新设备" disabled={busy} onClick={() => void run('controllerStatus')}><RefreshCw size={16}/></Button>
        {state.fresh || connectionPending ? <Button variant="outline" disabled={busy} onClick={() => void run('controllerDisconnect')}><Unplug size={15}/>断开</Button>
          : <Button disabled={busy || !selected || !state.devices.some(d => String(d.id) === selected && d.cdc)} onClick={() => void run('controllerConnect', { deviceId: Number(selected) })}>{busy ? '处理中…' : '连接'}</Button>}
      </div>
      {!state.devices.length && <p className="controller-note">未枚举到设备时，请检查手机 OTG 开关、遥控器电源及数据线；使用底部接口。</p>}
      <div className="controller-readings">
        {['左杆横向', '左杆纵向', '右杆横向', '右杆纵向', '相机拨轮'].map((label, i) => <div className="controller-axis" key={label}><span>{label}</span><div className="controller-axis-track"><i style={{ left: `${50 + (state.axes[i] || 0) * 50}%` }}/></div><output>{state.raw[i] ?? '—'}<small>{(state.axes[i] || 0).toFixed(2)}</small></output></div>)}
        <div className="controller-buttons">{[['拍摄', 0x1060], ['返航', 0x1080], ['相机', 0x1004], ['Fn', 0x1002]].map(([label, mask]) => <span key={label} className={state.fresh && (state.buttons & Number(mask)) === mask ? 'pressed' : ''}>{label}</span>)}</div>
      </div>
      <div className="controller-config"><strong>右杆：转向 / 升降　左杆：上推加速 / 下拉减速</strong>
        <div>{([['invertSteer', '转向反向'], ['invertLift', '升降反向'], ['invertThrottle', '油门反向']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={settings[key]} onChange={e => { const next = { ...settings, [key]: e.target.checked }; setSettings(next); setControllerSettings(next); }}/>{label}</label>)}</div>
      </div>
      <div className="controller-actions"><Button variant="outline" disabled={!state.fresh || busy} onClick={() => void run('controllerCalibrate')}>摇杆回中校准</Button><Button disabled={!state.fresh || busy} onClick={() => void run('controllerEnable', { enabled: !state.takeover })}>{state.takeover ? '恢复触屏控制' : '使用手柄控制'}</Button></div>
      <p className="controller-note">接管前请松开摇杆。拔线或数据中断时自动恢复触屏，重新连接后需再次开启接管。</p>
      {error && <p className="controller-error" role="alert">{error}</p>}
      <details className="controller-debug"><summary>读取详情 · {state.frames} 帧 · {state.rate.toFixed(0)} Hz · 接口 {state.port < 0 ? '—' : state.port + 1}</summary><p>最近数据：{state.sampleAgeMs < 0 ? '尚未收到' : `${state.sampleAgeMs} ms 前`} · 校验丢弃 {state.rejected} 帧</p><code>{state.hex || '等待 DUML 数据…'}</code></details>
    </DialogContent></Dialog>
  </>;
}
