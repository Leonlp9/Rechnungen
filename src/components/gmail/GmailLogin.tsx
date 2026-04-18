import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startOAuthFlow, fetchUserEmail } from '@/lib/gmail';
import { useGmailStore } from '@/store/gmailStore';
import { toast } from 'sonner';
import { useState } from 'react';

export function GmailLogin() {
  const addOrUpdateAccount = useGmailStore((s) => s.addOrUpdateAccount);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const token = await startOAuthFlow();
      const email = await fetchUserEmail(token.access_token);
      addOrUpdateAccount({ email, token, emails: [] });
      toast.success(`${email} erfolgreich verbunden!`);
    } catch (e: any) {
      toast.error('Anmeldung fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Gmail verbinden</CardTitle>
          <CardDescription>
            Melde dich mit deinem Google-Konto an, um deine E-Mails zu sehen und PDF-Anhänge direkt
            als Rechnungen zu importieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Warte auf Browser…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Mit Google anmelden
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Es werden nur Lesezugriffe auf dein Gmail-Postfach angefordert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
