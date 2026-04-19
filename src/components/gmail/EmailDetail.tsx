import { useEffect, useState, useRef } from 'react';
import { useGmailStore, selectActiveAccount } from '@/store/gmailStore';
import { fetchEmailDetail, fetchAttachmentData, getValidToken } from '@/lib/gmail';
import { imapFetchEmailDetail } from '@/lib/imap';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';
import { Loader2, FileText, Download, Eye, Reply, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFull } from '@/lib/emailDate';
import { AttachmentPreview } from './AttachmentPreview';
import { NewInvoiceDialog } from '@/components/invoices/NewInvoiceDialog';
import { ComposeDialog } from './ComposeDialog';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailDetail({ onReply: _onReply }: { onReply?: () => void }) {
  const activeAccount = useGmailStore(selectActiveAccount);
  const accounts = useGmailStore((s) => s.accounts);
  const detailAccountEmail = useGmailStore((s) => s.detailAccountEmail);
  const updateAccountToken = useGmailStore((s) => s.updateAccountToken);
  const selectedEmail = useGmailStore((s) => s.selectedEmail);
  const setSelectedEmail = useGmailStore((s) => s.setSelectedEmail);
  const isFetchingDetail = useGmailStore((s) => s.isFetchingDetail);
  const setFetchingDetail = useGmailStore((s) => s.setFetchingDetail);

  // In "Alle Postfächer"-Modus nutzen wir das Konto der angeklickten E-Mail
  const effectiveAccount = detailAccountEmail
    ? (accounts.find((a) => a.email === detailAccountEmail) ?? activeAccount)
    : activeAccount;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [previewAttachment, setPreviewAttachment] = useState<{
    filename: string; base64: string; mimeType: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState<{
    pdfPath: string; pdfName: string; isTemp?: boolean;
  } | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [convertingPdf, setConvertingPdf] = useState(false);

  // When selectedEmail changes and has no body yet → fetch detail
  useEffect(() => {
    if (!selectedEmail || !isFetchingDetail || !effectiveAccount) return;
    let cancelled = false;
    (async () => {
      try {
        let detail;
        if (effectiveAccount.type === 'imap' && effectiveAccount.imapConfig) {
          detail = await imapFetchEmailDetail(effectiveAccount.imapConfig, effectiveAccount.email, selectedEmail.id);
        } else {
          const at = await getValidToken(effectiveAccount.token!, (t) =>
            updateAccountToken(effectiveAccount.email, t)
          );
          detail = await fetchEmailDetail(at, selectedEmail.id);
        }
        if (!cancelled) { setSelectedEmail(detail); setFetchingDetail(false); }
      } catch (e: any) {
        if (!cancelled) {
          toast.error('E-Mail konnte nicht geladen werden: ' + (e?.message ?? String(e)));
          setFetchingDetail(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedEmail?.id, isFetchingDetail]);

  const getToken = async () => {
    if (!effectiveAccount) throw new Error('Kein aktives Konto');
    return getValidToken(effectiveAccount.token!, (t) =>
      updateAccountToken(effectiveAccount.email, t)
    );
  };

  const getAttachmentBase64 = async (attachmentId: string): Promise<string> => {
    // IMAP: attachment data is already embedded in the message
    const att = selectedEmail?.attachments.find((a) => a.id === attachmentId);
    if (att?.dataBase64) return att.dataBase64;
    // Gmail: fetch from API
    const at = await getToken();
    return fetchAttachmentData(at, selectedEmail!.id, attachmentId);
  };

  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    // Allow text selection inside the iframe
    const style = doc.createElement('style');
    style.textContent = '* { user-select: text !important; -webkit-user-select: text !important; cursor: auto; }';
    doc.head.appendChild(style);
    doc.querySelectorAll('a[href]').forEach((el) => {
      const a = el as HTMLAnchorElement;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const href = a.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          openUrl(href).catch(() => {});
        }
      });
    });
  };

  const openPreview = async (attachmentId: string, filename: string, mimeType: string) => {
    setPreviewLoading(attachmentId);
    try {
      const base64 = await getAttachmentBase64(attachmentId);
      setPreviewAttachment({ filename, base64, mimeType });
    } catch (e: any) {
      toast.error('Vorschau fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setPreviewLoading(null);
    }
  };

  const importPdf = async (attachmentId: string, filename: string) => {
    const id = toast.loading(`Importiere ${filename}…`);
    try {
      const base64 = await getAttachmentBase64(attachmentId);
      const path = await invoke<string>('save_pdf_attachment', { filename, dataBase64: base64 });
      toast.dismiss(id);
      toast.success(`${filename} gespeichert!`);
      setImportDialog({ pdfPath: path, pdfName: filename });
    } catch (e: any) {
      toast.dismiss(id);
      toast.error('Import fehlgeschlagen: ' + (e?.message ?? String(e)));
    }
  };

  const convertEmailToPdf = async () => {
    if (!selectedEmail) return;
    setConvertingPdf(true);
    const toastId = toast.loading('E-Mail wird als PDF erstellt…');
    try {
      // Build a full HTML document that looks like the email
      const html = selectedEmail.bodyHtml || `<pre style="font-family:sans-serif;white-space:pre-wrap">${selectedEmail.bodyText || selectedEmail.snippet}</pre>`;

      // Create an off-screen container isolated from the app's CSS variables
      const container = document.createElement('div');
      container.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:794px',
        'background:#ffffff',
        'color:#111827',
        'font-family:Arial,Helvetica,sans-serif',
        'font-size:13px',
        'line-height:1.5',
        'padding:32px',
        'box-sizing:border-box',
      ].join(';');

      // Header + body – NO <style> tag here (would affect global DOM)
      container.innerHTML = `
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;color:#111827;background:#ffffff">
          <h1 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;font-family:Arial,sans-serif">${selectedEmail.subject || '(kein Betreff)'}</h1>
          <p style="margin:2px 0;font-size:12px;color:#6b7280;font-family:Arial,sans-serif"><strong>Von:</strong> ${selectedEmail.from}</p>
          <p style="margin:2px 0;font-size:12px;color:#6b7280;font-family:Arial,sans-serif"><strong>Datum:</strong> ${formatFull(selectedEmail.date)}</p>
        </div>
        <div style="color:#111827;font-family:Arial,sans-serif">${html}</div>
      `;
      document.body.appendChild(container);

      // Wait one frame for rendering
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        onclone: (_clonedDoc, clonedEl) => {
          // Patch oklch CSS variables only in the clone – never touches the real DOM
          const style = clonedEl.ownerDocument.createElement('style');
          style.textContent = `
            *, *::before, *::after {
              --background: #ffffff !important;
              --foreground: #111827 !important;
              --card: #ffffff !important;
              --card-foreground: #111827 !important;
              --popover: #ffffff !important;
              --popover-foreground: #111827 !important;
              --primary: #2563eb !important;
              --primary-foreground: #ffffff !important;
              --secondary: #f3f4f6 !important;
              --secondary-foreground: #111827 !important;
              --muted: #f3f4f6 !important;
              --muted-foreground: #6b7280 !important;
              --accent: #f3f4f6 !important;
              --accent-foreground: #111827 !important;
              --destructive: #ef4444 !important;
              --border: #e5e7eb !important;
              --input: #e5e7eb !important;
              --ring: #2563eb !important;
              color-scheme: light !important;
            }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; }
          `;
          clonedEl.ownerDocument.head.appendChild(style);
        },
      });

      document.body.removeChild(container);

      // A4 dimensions in mm
      const pageW = 210;
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height / canvas.width) * imgW;

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      if (imgH <= pageH) {
        doc.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
      } else {
        // Multi-page: slice the canvas into page-height segments
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        const pxPerPage = Math.floor(canvas.width * (pageH / pageW));
        let srcY = 0;
        let firstPage = true;
        while (srcY < canvas.height) {
          const sliceH = Math.min(pxPerPage, canvas.height - srcY);
          pageCanvas.height = sliceH;
          const ctx = pageCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, sliceH);
          ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceData = pageCanvas.toDataURL('image/jpeg', 0.92);
          const sliceHMm = (sliceH / canvas.width) * pageW;
          if (!firstPage) doc.addPage();
          doc.addImage(sliceData, 'JPEG', 0, 0, pageW, sliceHMm);
          srcY += sliceH;
          firstPage = false;
        }
      }

      const pdfName = `${(selectedEmail.subject || 'email').replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_').slice(0, 60)}.pdf`;
      const arrayBuffer = doc.output('arraybuffer');
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const base64 = btoa(bytes.map((b) => String.fromCharCode(b)).join(''));
      const path = await invoke<string>('save_pdf_attachment', { filename: pdfName, dataBase64: base64 });
      toast.dismiss(toastId);
      toast.success('PDF erstellt!');
      setImportDialog({ pdfPath: path, pdfName, isTemp: true });
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error('PDF-Erstellung fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setConvertingPdf(false);
    }
  };

  if (!selectedEmail) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Wähle eine E-Mail aus der Liste</p>
      </div>
    );
  }

  const pdfAttachments = selectedEmail.attachments.filter(
    (a) => a.mimeType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')
  );
  const otherAttachments = selectedEmail.attachments.filter((a) => !pdfAttachments.includes(a));

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 select-text">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold leading-tight cursor-text">
              {selectedEmail.subject || '(kein Betreff)'}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={convertEmailToPdf}
                disabled={convertingPdf || isFetchingDetail}
                title="E-Mail als PDF importieren"
              >
                {convertingPdf
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileDown className="h-3.5 w-3.5" />}
                Als PDF importieren
              </Button>
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setReplyOpen(true)}>
                <Reply className="h-3.5 w-3.5" />
                Antworten
              </Button>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground cursor-text">
            <span><span className="font-medium text-foreground">Von:</span> {selectedEmail.from}</span>
            <span>{formatFull(selectedEmail.date)}</span>
          </div>

          {/* PDF attachments */}
          {pdfAttachments.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {pdfAttachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{a.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(a.size)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPreview(a.id, a.filename, a.mimeType)}
                    disabled={previewLoading === a.id}
                  >
                    {previewLoading === a.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Eye className="mr-1 h-3 w-3" />Vorschau</>}
                  </Button>
                  <Button size="sm" onClick={() => importPdf(a.id, a.filename)}>
                    <Download className="mr-1 h-3 w-3" />
                    Importieren
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Other attachments */}
          {otherAttachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {otherAttachments.map((a) => (
                <Button
                  key={a.id}
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => openPreview(a.id, a.filename, a.mimeType)}
                  disabled={previewLoading === a.id}
                >
                  {previewLoading === a.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <><FileText className="h-3 w-3" />{a.filename}</>}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {isFetchingDetail ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedEmail.bodyHtml ? (
            <iframe
              ref={iframeRef}
              srcDoc={selectedEmail.bodyHtml}
              sandbox="allow-same-origin"
              className="h-full w-full border-0"
              title="E-Mail Inhalt"
              onLoad={handleIframeLoad}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80 select-text cursor-text">
              {selectedEmail.bodyText || selectedEmail.snippet || '(kein Inhalt)'}
            </pre>
          )}
        </div>
      </div>

      {previewAttachment && (
        <AttachmentPreview
          filename={previewAttachment.filename}
          base64={previewAttachment.base64}
          mimeType={previewAttachment.mimeType}
          onClose={() => setPreviewAttachment(null)}
        />
      )}

      {importDialog && (
        <NewInvoiceDialog
          open={true}
          onClose={(saved) => {
            // If user cancelled and this was a temp conversion PDF, delete it
            if (!saved && importDialog.isTemp) {
              invoke('delete_invoice_file', { filename: importDialog.pdfName }).catch(() => {});
            }
            setImportDialog(null);
          }}
          initialPdfPath={importDialog.pdfPath}
          initialPdfName={importDialog.pdfName}
        />
      )}

      {replyOpen && selectedEmail && (
        <ComposeDialog
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          replyTo={{
            to: selectedEmail.from,
            subject: selectedEmail.subject,
            messageId: selectedEmail.id,
            threadId: selectedEmail.threadId,
          }}
        />
      )}
    </>
  );
}

