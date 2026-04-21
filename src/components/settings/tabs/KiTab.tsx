import { Bot, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface KiTabProps {
  apiKey: string;
  setApiKey: (v: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  saveApiKey: () => void;
  aiInstructions: string;
  setAiInstructions: (v: string) => void;
  aiInstructionsSaving: boolean;
  saveAiInstructions: () => void;
  showAiChat: boolean;
  setShowAiChat: (v: boolean) => void;
}

export function KiTab({
  apiKey, setApiKey, showKey, setShowKey, saveApiKey,
  aiInstructions, setAiInstructions, aiInstructionsSaving, saveAiInstructions,
  showAiChat, setShowAiChat,
}: KiTabProps) {
  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">KI-Chat</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">KI-Chat-Button anzeigen</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Zeigt oder versteckt den schwebenden KI-Chat-Button unten rechts im Bildschirm.
              </p>
            </div>
            <Button
              variant={showAiChat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAiChat(!showAiChat)}
              className="min-w-24"
            >
              {showAiChat ? 'Aktiv' : 'Versteckt'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Gemini API-Key</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Wird sicher im OS-Schlüsselbund gespeichert (Windows Credential Manager / macOS Keychain).</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>API-Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={saveApiKey}><Save className="mr-2 h-4 w-4" />Speichern</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">KI-Anweisungen</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gib der KI eigene Regeln und Hinweise vor, die sie beim Analysieren von Rechnungen berücksichtigen soll –
            z.&nbsp;B. Sonderregeln für bestimmte Partner, bevorzugte Kategorien oder individuelle Hinweise.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-instructions">Anweisungen</Label>
            <textarea
              id="ai-instructions"
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              placeholder={`Beispiele:\n- Rechnungen von "Amazon" sind immer Ausgaben, Kategorie "buerobedarf"\n- Wenn der Partner "Finanzamt" heißt, ist es immer type="info"\n- Zahlungen an mich selbst mit dem Betreff "Privatentnahme" sind type="info"\n- Nutze für alle Streaming-Einnahmen die Kategorie "einnahmen"`}
              rows={8}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-30 font-mono leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">Freitext – die KI liest diese Anweisungen bei jeder Rechnungsanalyse mit.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveAiInstructions} disabled={aiInstructionsSaving}>
              <Save className="mr-2 h-4 w-4" />Anweisungen speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

