import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface Props {
  filename: string;
  base64: string;
  mimeType: string;
  onClose: () => void;
}

export function AttachmentPreview({ filename, base64, mimeType, onClose }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    // Convert base64 → Blob → object URL
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [base64, mimeType]);

  const isPdf =
    mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-xl border border-border bg-background shadow-2xl">
        {/* Titlebar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="truncate text-sm font-medium">{filename}</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {!objectUrl ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Lade Vorschau…
            </div>
          ) : isPdf ? (
            <iframe
              src={objectUrl}
              className="h-full w-full border-0"
              title={filename}
            />
          ) : isImage ? (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              <img src={objectUrl} alt={filename} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
              <p className="text-sm">Keine Vorschau für diesen Dateityp verfügbar.</p>
              <a
                href={objectUrl}
                download={filename}
                className="text-sm text-primary underline"
              >
                Datei herunterladen
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

