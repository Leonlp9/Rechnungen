import { Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddMailboxDialog } from './AddMailboxDialog';
import { useState } from 'react';

export function GmailLogin() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Postfach verbinden</CardTitle>
          <CardDescription>
            Verbinde dein E-Mail-Konto, um Nachrichten zu lesen und PDF-Anhänge als Rechnungen zu importieren.
            Unterstützt Gmail (OAuth), Outlook, iCloud, Yahoo und jeden eigenen IMAP-Server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)} className="w-full" size="lg">
            <Mail className="mr-2 h-4 w-4" />
            Postfach hinzufügen
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Für IMAP-Konten werden deine Zugangsdaten nur lokal auf deinem Gerät gespeichert.
          </p>
        </CardContent>
      </Card>
      <AddMailboxDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
