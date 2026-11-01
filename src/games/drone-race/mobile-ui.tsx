import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Trophy, Zap } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from './ui';
import { nativeRequest } from './native';
import { joystickInput } from './lib/joystick';

export function FlightJoystick({ onMove, onHold }: { onMove: (x: number, y: number) => void; onHold: (key: string, pressed: boolean) => void }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [swapped, setSwapped] = useState(() => { try { return localStorage.getItem('drone-flight-controls-swapped') === 'true'; } catch { return false; } });
  const pointer = useRef<number | null>(null);
  const bounds = useRef<DOMRect | null>(null);
  const reset = () => { pointer.current = null; bounds.current = null; setPosition({ x: 0, y: 0 }); onMove(0, 0); };
  const move = (clientX: number, clientY: number) => {
    const box = bounds.current; if (!box) return;
    const radius = Math.min(box.width, box.height) * .32;
    if (radius <= 0) return;
    const input = joystickInput((clientX - box.left - box.width / 2) / radius, (box.top + box.height / 2 - clientY) / radius);
    setPosition({ x: input.visual.x * radius, y: input.visual.y * radius });
    onMove(input.steer, input.lift);
  };
  useEffect(() => { window.addEventListener('blur', reset); return () => window.removeEventListener('blur', reset); }, []);
  const swap = () => { reset(); onHold('boost', false); onHold('brake', false); setSwapped(value => { try { localStorage.setItem('drone-flight-controls-swapped', String(!value)); } catch {} return !value; }); };
  return <div className={`flight-touch-pad ${swapped ? 'controls-swapped' : ''}`}>
    <button type="button" className="controls-swap" aria-pressed={swapped} onClick={swap}>换边</button>
    <div className="flight-stick" role="group" aria-label="飞行摇杆，左右转向，上下升降" onPointerDown={event => {
      if (pointer.current !== null) return;
      event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
      bounds.current = event.currentTarget.getBoundingClientRect();
      move(event.clientX, event.clientY);
    }} onPointerMove={event => {
      if (pointer.current !== event.pointerId) return;
      move(event.clientX, event.clientY);
    }} onPointerUp={e => { if (pointer.current === e.pointerId) reset(); }} onPointerCancel={e => { if (pointer.current === e.pointerId) reset(); }} onLostPointerCapture={e => { if (pointer.current === e.pointerId) reset(); }}>
      <span className="stick-cross">＋</span><span className="stick-knob" style={{ transform: `translate(${position.x}px, ${-position.y}px)` }} /><small>转向 / 升降</small>
    </div>
    <div className="flight-pedals">{[['brake', '减速', ArrowDown], ['boost', '加速', Zap]].map(([key, label, Icon]) => {
      const I = Icon as typeof Zap;
      return <Button key={String(key)} className={`flight-pedal ${key}`} aria-label={String(label)} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onHold(String(key), true); }} onPointerUp={() => onHold(String(key), false)} onPointerCancel={() => onHold(String(key), false)} onLostPointerCapture={() => onHold(String(key), false)}><I size={24} />{String(label)}</Button>;
    })}</div>
  </div>;
}

function LadderAvatar({ row }: { row: any }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [row.avatarUrl]);
  return <span className={`ladder-avatar${row.member ? ' ladder-avatar--vip' : ''}`} aria-label={row.member ? '会员头像' : '头像'}>
    {row.avatarUrl && !failed ? <img src={row.avatarUrl} alt={row.name || '飞手'} onError={() => setFailed(true)} /> : <span>{Array.from(String(row.name || '飞手'))[0]}</span>}
  </span>;
}

export function LadderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<any>(null), [mine, setMine] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true; setLoading(true); setError('');
    Promise.all([nativeRequest('leaderboard', { page: 0, size: 50 }), nativeRequest('myRank')]).then(([board, rank]) => { if (alive) { setData(board); setMine(rank?.entry); } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open]);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="ladder-dialog"><DialogTitle><Trophy size={22}/>涂鸦飞行天梯</DialogTitle><DialogDescription>{data?.season || '涂鸦飞行'} · 每次飞行结束后记录个人成就，按成就积分、完赛和最佳时间排名。</DialogDescription>
    {loading ? <p role="status">正在获取天梯…</p> : error ? <p role="alert">{error}</p> : <>
      <p className="ladder-mine">{mine ? `我的排名 ${mine.rank} · ${mine.rating} 成就积分 · ${mine.completions} 次完赛` : '完成一次个人飞行，开启你的赛季成就。'}</p>
      <ol className="ladder-list">{(data?.items || []).map((row: any) => <li key={row.playerId}><b>{row.rank}</b><LadderAvatar row={row}/><span className={row.member ? 'ladder-member-name' : ''}>{row.name}<small>{row.completions} 次完赛 · 穿环 {row.gates} 次{row.bestFinishMs ? ` · 最佳 ${(row.bestFinishMs / 1000).toFixed(2)} 秒` : ''}</small></span><strong>{row.rating}</strong></li>)}</ol>
      {!data?.items?.length && <p>完成第一场个人飞行后即可上榜。</p>}
    </>}
  </DialogContent></Dialog>;
}
