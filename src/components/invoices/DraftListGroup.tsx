// Entwurfsliste als Gruppenliste.
//
// Entwürfe tauchen an zwei Stellen auf: auf der Scan-Seite und im
// Entwürfe-Blatt. Vorher waren das zwei getrennte Bauweisen mit
// unterschiedlichen Abständen und Knöpfen – hier ist es eine.
//
// Aufbau wie in iOS: Die Zeile selbst öffnet den Entwurf, das Löschen sitzt
// rechts als eigene Trefferfläche. Zwei Knöpfe nebeneinander (Öffnen-Pfeil
// UND Papierkorb) waren einer zu viel – die Zeile ist der Öffnen-Knopf.

import { FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ListGroup } from '@/components/ui/list-group';
import type { InvoiceDraft } from '@/store';

interface Props {
  drafts: InvoiceDraft[];
  onOpen: (draft: InvoiceDraft) => void;
  onDelete: (draft: InvoiceDraft) => void;
  title?: string;
  footer?: string;
}

export function DraftListGroup({ drafts, onOpen, onDelete, title, footer }: Props) {
  return (
    <ListGroup title={title} footer={footer}>
      {drafts.map((draft) => (
        <div key={draft.id} className="flex w-full items-stretch">
          <button
            type="button"
            onClick={() => onOpen(draft)}
            className="flex min-w-0 flex-1 items-stretch text-left active:bg-accent"
          >
            <span
              data-tint="blue"
              className="my-[7px] ml-4 flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground"
            >
              <FileText className="h-4 w-4 stroke-[1.9]" />
            </span>
            <span data-row-body className="ml-3 flex min-h-[44px] min-w-0 flex-1 flex-col justify-center border-b border-border py-2 pr-3">
              <span className="truncate text-[17px] leading-tight">{draft.fileName}</span>
              <span className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {format(new Date(draft.addedAt), 'dd.MM.yyyy, HH:mm', { locale: de })}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(draft)}
            aria-label={`${draft.fileName} löschen`}
            className="flex shrink-0 items-center active:opacity-60"
          >
            <span data-row-body className="flex h-full items-center border-b border-border pr-4 pl-1 text-destructive">
              <Trash2 className="h-[18px] w-[18px]" />
            </span>
          </button>
        </div>
      ))}
    </ListGroup>
  );
}
