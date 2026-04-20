import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onConsent: () => void;
  onCancel: () => void;
}

export function GeminiConsentDialog({ open, onConsent, onCancel }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Datenschutzhinweis – KI-Nutzung
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Beim Verwenden der KI-Funktionen werden Daten (z.&nbsp;B. PDF-Inhalte, Rechnungstexte)
                an <strong>Google Gemini</strong> (generativelanguage.googleapis.com) übermittelt.
              </p>
              <p>
                Googles Server befinden sich in den USA. Die Übermittlung erfolgt auf Grundlage des
                EU-US Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission, Juli 2023).
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Rechnungsdaten können personenbezogene Informationen enthalten (Name, Adresse, Beträge).</li>
                <li>Google verarbeitet diese Daten gemäß der <a href="https://ai.google.dev/terms" target="_blank" rel="noopener noreferrer" className="underline">Gemini API Terms of Service</a>.</li>
                <li>API-Eingaben werden laut Google nicht zum Trainieren der Modelle verwendet.</li>
              </ul>
              <p className="font-medium text-foreground">
                Mit „Einverstanden" bestätigst du, dass du die KI-Funktionen nutzen möchtest und
                der Datenübermittlung an Google zustimmst.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConsent}>Einverstanden</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

