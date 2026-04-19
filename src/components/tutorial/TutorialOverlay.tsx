import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, X, MapPin } from 'lucide-react';
import { useTutorialStore } from '@/store/tutorialStore';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { TUTORIAL_STEPS } from '@/tutorial/tutorialSteps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // spotlight padding around target

export function TutorialOverlay() {
  const isActive = useTutorialStore((s) => s.isActive);
  const currentStep = useTutorialStore((s) => s.currentStep);
  const nextStep = useTutorialStore((s) => s.nextStep);
  const endTutorial = useTutorialStore((s) => s.endTutorial);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const animFrameRef = useRef<number>(0);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const setChatOpen = useChatStore((s) => s.setOpen);

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep >= TUTORIAL_STEPS.length - 1;

  // Navigate to correct route when step changes.
  // Only auto-navigate for 'observe' steps – for 'click' steps the user
  // navigates themselves by clicking the highlighted nav item.
  useEffect(() => {
    if (!isActive || !step) return;
    // Ensure sidebar is expanded so nav items are visible
    if (sidebarCollapsed) toggleSidebar();
    if (step.action === 'observe' && pathname !== step.route) {
      navigate(step.route);
    }
  }, [isActive, currentStep, step?.route]);

  // Auto-open the chat when on the ai-chat-window step, close when leaving
  useEffect(() => {
    if (!isActive || !step) return;
    if (step.id === 'ai-chat-window') {
      // Small delay so the route/render is settled first
      const t = setTimeout(() => setChatOpen(true), 400);
      return () => {
        clearTimeout(t);
        setChatOpen(false);
      };
    }
  }, [isActive, currentStep]);

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // Scroll target element into view when step changes
  useEffect(() => {
    if (!isActive || !step) return;
    // Wait for navigation + render, then scroll
    const t = setTimeout(() => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 350);
    return () => clearTimeout(t);
  }, [isActive, currentStep]);

  // Continuously measure (for layout shifts, route changes)
  useEffect(() => {
    if (!isActive) return;
    let active = true;
    const loop = () => {
      if (!active) return;
      measureTarget();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    // Give the page time to render after navigation
    const timeout = setTimeout(() => {
      animFrameRef.current = requestAnimationFrame(loop);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isActive, currentStep, measureTarget]);

  const [tooltipHeight, setTooltipHeight] = useState(220);

  // Measure actual tooltip height via ResizeObserver
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.offsetHeight > 0) setTooltipHeight(el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isActive, currentStep]);

  // Compute tooltip position based on placement + target rect
  useEffect(() => {
    if (!targetRect || !step) return;
    const TOOLTIP_W = 320;
    const TOOLTIP_H = tooltipHeight;
    const GAP = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = 0, left = 0;

    switch (step.placement) {
      case 'right':
        top = targetRect.top + targetRect.height / 2 - TOOLTIP_H / 2;
        left = targetRect.left + targetRect.width + GAP;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - TOOLTIP_H / 2;
        left = targetRect.left - TOOLTIP_W - GAP;
        break;
      case 'bottom':
        top = targetRect.top + targetRect.height + GAP;
        left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
        break;
      case 'top':
        top = targetRect.top - TOOLTIP_H - GAP;
        left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
        break;
    }

    // Clamp to viewport
    top = Math.max(12, Math.min(top, vh - TOOLTIP_H - 12));
    left = Math.max(12, Math.min(left, vw - TOOLTIP_W - 12));
    setTooltipPos({ top, left });
  }, [targetRect, step, tooltipHeight]);

  // Listen for clicks on target element
  useEffect(() => {
    if (!isActive || !step || step.action !== 'click') return;

    // Poll until element is in DOM (route may not have rendered yet)
    let cleanedUp = false;
    let removeListener: (() => void) | null = null;

    const attach = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) return false;

      const handler = () => {
        // Delay so the natural click action (e.g. navigation) fires first
        setTimeout(() => {
          if (cleanedUp) return;
          if (isLastStep) {
            endTutorial();
          } else {
            nextStep();
          }
        }, 180);
      };

      // Use bubble phase – do NOT stopPropagation so NavLinks still navigate
      el.addEventListener('click', handler);
      removeListener = () => el.removeEventListener('click', handler);
      return true;
    };

    // Try immediately, then retry via interval until found
    if (!attach()) {
      const interval = setInterval(() => {
        if (attach()) clearInterval(interval);
      }, 100);
      return () => {
        cleanedUp = true;
        clearInterval(interval);
        removeListener?.();
      };
    }

    return () => {
      cleanedUp = true;
      removeListener?.();
    };
  }, [isActive, currentStep, step?.target, isLastStep]);

  if (!isActive || !step) return null;

  const s = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
      }
    : null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <>
      {/* SVG Spotlight Overlay */}
      <svg
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 90, width: vw, height: vh }}
      >
        <defs>
          <mask id="tutorial-spotlight-mask">
            {/* White = visible (dark overlay shows) */}
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {/* Black cutout = spotlight (dark overlay hides) */}
            {s && (
              <rect
                x={s.left}
                y={s.top}
                width={s.width}
                height={s.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.65)"
          mask="url(#tutorial-spotlight-mask)"
        />
        {/* Spotlight border glow */}
        {s && (
          <rect
            x={s.left}
            y={s.top}
            width={s.width}
            height={s.height}
            rx="8"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            opacity="0.9"
          />
        )}
      </svg>

      {/* Click blocker: blocks everything EXCEPT target element.
          For 'observe' steps the target itself is also blocked. */}
      {s && (
        <>
          {/* top */}
          <div
            className="fixed"
            style={{ zIndex: 91, top: 0, left: 0, width: vw, height: s.top, pointerEvents: 'all', cursor: 'not-allowed' }}
          />
          {/* bottom */}
          <div
            className="fixed"
            style={{ zIndex: 91, top: s.top + s.height, left: 0, width: vw, height: vh - s.top - s.height, pointerEvents: 'all', cursor: 'not-allowed' }}
          />
          {/* left */}
          <div
            className="fixed"
            style={{ zIndex: 91, top: s.top, left: 0, width: s.left, height: s.height, pointerEvents: 'all', cursor: 'not-allowed' }}
          />
          {/* right */}
          <div
            className="fixed"
            style={{ zIndex: 91, top: s.top, left: s.left + s.width, width: vw - s.left - s.width, height: s.height, pointerEvents: 'all', cursor: 'not-allowed' }}
          />
          {/* For observe steps: also block the target itself so nothing happens on click */}
          {step.action === 'observe' && (
            <div
              className="fixed"
              style={{ zIndex: 92, top: s.top, left: s.left, width: s.width, height: s.height, pointerEvents: 'all', cursor: 'default' }}
            />
          )}
        </>
      )}

      {/* Tooltip Card */}
      <div
        ref={tooltipRef}
        className="fixed bg-background border border-border rounded-xl shadow-2xl p-5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ zIndex: 95, width: 320, top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Step indicator + close */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Schritt {currentStep + 1} von {TUTORIAL_STEPS.length}
          </span>
          <button
            onClick={endTutorial}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Tutorial beenden"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div>
          <h3 className="font-semibold text-sm leading-tight mb-1">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
        </div>

        {/* Action hint */}
        {step.action === 'click' && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-primary font-medium">
              👆 Klicke das hervorgehobene Element
            </span>
          </div>
        )}

        {/* Observe: Weiter-Button + kurzer Hinweis */}
        {step.action === 'observe' && (
          <div className="space-y-2">
            <button
              onClick={() => (isLastStep ? endTutorial() : nextStep())}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
            >
              {isLastStep ? 'Tutorial abschließen 🎉' : <>Weiter <ChevronRight className="h-4 w-4" /></>}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              👀 Schau dir den hervorgehobenen Bereich an
            </p>
          </div>
        )}

        {/* Skip link */}
        <button
          onClick={endTutorial}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Tutorial beenden
        </button>
      </div>
    </>
  );
}








