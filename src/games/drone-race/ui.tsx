import { createContext, useContext, useEffect, useId, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';

// Only the four UI primitives actually used by this game are included.
export function Button({ variant = 'default', size = 'default', className = '', ...props }: ComponentProps<'button'> & { variant?: string; size?: string }) {
  return <button type="button" data-slot="button" data-variant={variant} data-size={size} className={`game-button ${className}`} {...props} />;
}
export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`game-input ${className}`} {...props} />;
}
export function Progress({ value = 0, ...props }: ComponentProps<'div'> & { value?: number }) {
  const progress = Math.max(0, Math.min(100, value));
  return <div data-slot="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} {...props}><div data-slot="progress-indicator" style={{ width: `${progress}%` }} /></div>;
}
type DialogState = { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string };
const DialogContext = createContext<DialogState | null>(null);
function useDialog() {
  const state = useContext(DialogContext);
  if (!state) throw new Error('Dialog content must be inside Dialog');
  return state;
}
export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  const id = useId();
  return <DialogContext.Provider value={{ open, onOpenChange, title: `${id}-title`, description: `${id}-description` }}>{children}</DialogContext.Provider>;
}
export function DialogContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  const state = useDialog();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (state.open && !dialog.open) dialog.showModal();
    if (!state.open && dialog.open) dialog.close();
    if (!state.open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [state.open]);
  return <dialog ref={ref} className={`game-dialog ${className}`} aria-labelledby={state.title} aria-describedby={state.description} onCancel={event => { event.preventDefault(); state.onOpenChange(false); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) state.onOpenChange(false);
  }}>
    {state.open && children}
    <button type="button" className="game-dialog-close" aria-label="关闭" onClick={() => state.onOpenChange(false)}>×</button>
  </dialog>;
}
export function DialogTitle(props: ComponentProps<'h2'>) { return <h2 id={useDialog().title} data-slot="dialog-title" {...props} />; }
export function DialogDescription(props: ComponentProps<'p'>) { return <p id={useDialog().description} data-slot="dialog-description" {...props} />; }
