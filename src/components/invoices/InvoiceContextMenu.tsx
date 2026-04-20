import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2, Eye, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { deleteInvoice, getAllInvoices } from '@/lib/db';
import { getAbsolutePdfPath } from '@/lib/pdf';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useAppStore } from '@/store';
import type { Invoice } from '@/types';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  invoice: Invoice;
  x: number;
  y: number;
  onClose: () => void;
}

export function InvoiceContextMenu({ invoice, x, y, onClose }: Props) {
  const navigate = useNavigate();
  const setInvoices = useAppStore((s) => s.setInvoices);
  const ref = useRef<HTMLDivElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Adjust position so menu doesn't overflow screen
  const menuW = 220;
  const menuH = 200;
  const left = x + menuW > window.innerWidth ? x - menuW : x;
  const top = y + menuH > window.innerHeight ? y - menuH : y;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const action = (fn: () => Promise<void> | void) => async () => {
    onClose();
    await fn();
  };

  const handleOpen = action(() => navigate(`/invoices/${invoice.id}`));

  const handleReveal = action(async () => {
    if (!invoice.pdf_path) { toast.error('Kein PDF hinterlegt.'); return; }
    try {
      const abs = await getAbsolutePdfPath(invoice.pdf_path);
      await revealItemInDir(abs);
    } catch (e) {
      toast.error('Konnte Datei nicht öffnen: ' + String(e));
    }
  });

  const handleCopyPartner = action(() => {
    navigator.clipboard.writeText(invoice.partner);
    toast.success(`"${invoice.partner}" kopiert`);
  });

  const handleDelete = action(() => {
    setDeleteOpen(true);
  });

  const confirmDelete = async () => {
    try {
      await deleteInvoice(invoice.id);
      const updated = await getAllInvoices();
      setInvoices(updated);
      toast.success('Rechnung gelöscht.');
    } catch (e) {
      toast.error('Fehler beim Löschen: ' + String(e));
    } finally {
      setDeleteOpen(false);
    }
  };

  const items = [
    { icon: Eye, label: 'Details öffnen', onClick: handleOpen },
    invoice.pdf_path
      ? { icon: ExternalLink, label: 'Im Explorer anzeigen', onClick: handleReveal }
      : null,
    { icon: Copy, label: 'Partner kopieren', onClick: handleCopyPartner },
    null, // divider
    { icon: Trash2, label: 'Löschen', onClick: handleDelete, danger: true },
  ];

  return (
    <>
      <div
        ref={ref}
        className="fixed z-[9999] min-w-[200px] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1 text-sm"
        style={{ left, top }}
      >
        {items.map((item, i) =>
          item === null ? (
            <div key={i} className="my-1 border-t border-border" />
          ) : (
            <button
              key={i}
              onClick={item.onClick}
              className={`flex w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-muted ${
                item.danger ? 'text-red-600 dark:text-red-400' : ''
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          )
        )}
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Rechnung &ldquo;{invoice.description}&rdquo; von &ldquo;{invoice.partner}&rdquo; wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
