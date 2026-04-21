import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';

/**
 * Globale Keyboard-Shortcuts für die Navigation.
 * Nur aktiv, wenn kein Input/Textarea/Select fokussiert ist.
 *
 * Shortcuts (nur Buchstabe, kein Modifier nötig):
 *   g d → Dashboard
 *   g r → Alle Rechnungen
 *   g n → Neue Rechnung
 *   g s → Einstellungen
 *   g k → Kunden
 *   g f → Fahrtenbuch
 *   g t → Steuerbericht
 *   ? → Shortcut-Hilfe anzeigen
 */

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts(onShortcutsOpen?: () => void) {
  const navigate = useNavigate();
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);

  useEffect(() => {
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      // Ctrl/Cmd+K → Suche (bereits vorhanden, hier nur Fallback)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // g → Sequenz starten (Gmail-style navigation)
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        pendingG = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { pendingG = false; }, 1500);
        return;
      }

      if (pendingG) {
        pendingG = false;
        if (gTimer) { clearTimeout(gTimer); gTimer = null; }

        switch (e.key) {
          case 'd': navigate('/'); break;
          case 'r': navigate('/invoices'); break;
          case 'n': navigate('/write-invoice'); break;
          case 's': navigate('/settings'); break;
          case 'k': navigate('/customers'); break;
          case 'f': navigate('/fahrtenbuch'); break;
          case 't': navigate('/steuerbericht'); break;
          case 'm': navigate('/gmail'); break;
          case 'b': navigate('/bank-import'); break;
        }
        return;
      }

      // ? → Shortcut-Modal anzeigen
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        onShortcutsOpen?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, setSearchOpen, onShortcutsOpen]);
}

