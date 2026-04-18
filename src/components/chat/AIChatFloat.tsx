import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Minus } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { ChatPanel } from './ChatPanel';
import { useChatContext, useCurrentInvoiceHasPdf, useIsInvoiceList } from '@/hooks/useChatContext';
import { useAppStore } from '@/store';

const DEFAULT_W = 380;
const DEFAULT_H = 520;
const MIN_W = 280;
const MIN_H = 340;
const BTN_SIZE = 56;
const MARGIN = 24;

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.85 };

type ResizeDir = 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';

export function AIChatFloat() {
  const { isOpen, setOpen, position, setPosition } = useChatStore();
  const theme = useAppStore((s) => s.theme);
  const darkMode = useAppStore((s) => s.darkMode);
  const pageContext = useChatContext();
  const hasPdf = useCurrentInvoiceHasPdf();
  const isInvoiceList = useIsInvoiceList();
  const isGlass = theme === 'liquid-glass';

  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [pos, setPos] = useState(() => {
    if (position.x !== 0 || position.y !== 0) return position;
    return { x: window.innerWidth - DEFAULT_W - MARGIN, y: window.innerHeight - DEFAULT_H - MARGIN };
  });

  // Re-render on window resize + clamp open window back into viewport
  const [, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => {
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
      setSize((prev) => ({
        w: Math.min(prev.w, window.innerWidth),
        h: Math.min(prev.h, window.innerHeight),
      }));
      setPos((prev) => ({
        x: Math.max(0, Math.min(prev.x, window.innerWidth  - size.w)),
        y: Math.max(0, Math.min(prev.y, window.innerHeight - size.h)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size.w, size.h]);

  // ── Drag ──────────────────────────────────────────
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - size.w, dragRef.current.ox + ev.clientX - dragRef.current.sx)),
        y: Math.max(0, Math.min(window.innerHeight - size.h, dragRef.current.oy + ev.clientY - dragRef.current.sy)),
      });
    };
    const onUp = () => {
      if (dragRef.current) setPosition(pos);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size]);

  // ── Resize ────────────────────────────────────────
  const resizeRef = useRef<{ dir: ResizeDir; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const onResizeMouseDown = useCallback((e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { dir, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, ow: size.w, oh: size.h };
    const onMove = (ev: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dx = ev.clientX - r.sx;
      const dy = ev.clientY - r.sy;
      let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh;
      const maxW = window.innerWidth  - nx;
      const maxH = window.innerHeight - ny;
      if (r.dir.includes('e')) nw = Math.min(maxW, Math.max(MIN_W, r.ow + dx));
      if (r.dir.includes('s')) nh = Math.min(maxH, Math.max(MIN_H, r.oh + dy));
      if (r.dir.includes('w')) {
        nw = Math.max(MIN_W, Math.min(r.ox + r.ow, r.ow - dx));
        nx = Math.max(0, r.ox + r.ow - nw);
        nw = r.ox + r.ow - nx;
      }
      if (r.dir.includes('n')) {
        nh = Math.max(MIN_H, Math.min(r.oy + r.oh, r.oh - dy));
        ny = Math.max(0, r.oy + r.oh - nh);
        nh = r.oy + r.oh - ny;
      }
      setSize({ w: nw, h: nh });
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size]);

  const handleMinimize = () => { setOpen(false); setPosition({ x: 0, y: 0 }); };
  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    const w = DEFAULT_W, h = DEFAULT_H;
    const x = window.innerWidth  - w - MARGIN;
    const y = window.innerHeight - h - MARGIN;
    setSize({ w, h });
    setPos({ x, y });
    setPosition({ x, y });
  };

  // ── Positions ─────────────────────────────────────
  const btnX = window.innerWidth  - BTN_SIZE - MARGIN;
  const btnY = window.innerHeight - BTN_SIZE - MARGIN;

  const openAnim  = { left: pos.x, top: pos.y, width: size.w, height: size.h, borderRadius: 16 };
  const closeAnim = { left: btnX,  top: btnY,  width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2 };

  // ── Glass styles ──────────────────────────────────
  const glassWindow = isGlass ? {
    backdropFilter: 'blur(20px) saturate(160%) brightness(1.08)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%) brightness(1.08)',
    background: darkMode ? 'oklch(1 0 0 / 9%)' : 'oklch(1 0 0 / 45%)',
    border: darkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.42)',
    boxShadow: darkMode
      ? '0 8px 32px rgba(0,0,0,0.45), inset 1px 1px 0 rgba(255,255,255,0.15)'
      : '0 8px 32px rgba(0,0,0,0.14), inset 1px 1px 0 rgba(255,255,255,0.80)',
  } : {};
  const glassFab = isGlass ? {
    backdropFilter: 'blur(16px) saturate(160%) brightness(1.1)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%) brightness(1.1)',
    background: darkMode ? 'oklch(1 0 0 / 14%)' : 'oklch(1 0 0 / 55%)',
    border: darkMode ? '1px solid rgba(255,255,255,0.20)' : '1px solid rgba(255,255,255,0.70)',
    boxShadow: darkMode
      ? '0 4px 20px rgba(0,0,0,0.40), inset 1px 1px 0 rgba(255,255,255,0.20)'
      : '0 4px 18px rgba(0,0,0,0.12), inset 1px 1px 0 rgba(255,255,255,0.90)',
    color: darkMode ? 'rgba(255,255,255,0.90)' : 'rgba(60,60,120,0.85)',
  } : {};
  const glassHeader = isGlass ? {
    background: darkMode ? 'oklch(1 0 0 / 8%)' : 'oklch(1 0 0 / 22%)',
    borderBottom: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.30)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  } : {};

  // ── Resize handle helper ──────────────────────────
  const H = ({ dir, className }: { dir: ResizeDir; className: string }) => (
    <div
      className={`absolute z-10 ${className}`}
      onMouseDown={(e) => onResizeMouseDown(e, dir)}
    />
  );

  return (
    <motion.div
      animate={isOpen ? openAnim : closeAnim}
      transition={SPRING}
      className="fixed z-50 overflow-hidden border bg-card text-foreground shadow-2xl"
      style={isOpen ? glassWindow : {}}
    >
      {/* ── Closed state: FAB icon ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="icon"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(true)}
            className="absolute inset-0 flex items-center justify-center bg-primary text-primary-foreground cursor-pointer hover:brightness-110 transition-[filter] w-full h-full rounded-full"
            style={glassFab}
            title="KI-Assistent öffnen"
          >
            <Bot className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Open state: chat window ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, delay: 0.1 }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Drag handle */}
            <div
              onMouseDown={onHeaderMouseDown}
              className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/60 cursor-grab active:cursor-grabbing select-none shrink-0"
              style={glassHeader}
            >
              <Bot className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold flex-1">KI-Assistent</span>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleReset}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Größe & Position zurücksetzen"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleMinimize}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Minimieren"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Chat */}
            <div className="flex-1 min-h-0">
              <ChatPanel pageContext={pageContext} hasPdf={hasPdf} isInvoiceList={isInvoiceList} />
            </div>

            {/* Resize handles */}
            <H dir="n"  className="top-0 left-2 right-2 h-1.5 cursor-n-resize" />
            <H dir="s"  className="bottom-0 left-2 right-2 h-1.5 cursor-s-resize" />
            <H dir="e"  className="right-0 top-2 bottom-2 w-1.5 cursor-e-resize" />
            <H dir="w"  className="left-0 top-2 bottom-2 w-1.5 cursor-w-resize" />
            <H dir="ne" className="top-0 right-0 w-3 h-3 cursor-ne-resize" />
            <H dir="nw" className="top-0 left-0 w-3 h-3 cursor-nw-resize" />
            <H dir="se" className="bottom-0 right-0 w-3 h-3 cursor-se-resize" />
            <H dir="sw" className="bottom-0 left-0 w-3 h-3 cursor-sw-resize" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

