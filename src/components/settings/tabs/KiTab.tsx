import { Bot, Eye, EyeOff, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormGroup, FormRow, FormFullRow, FIELD } from '@/components/ui/form-list';
import { useIsMobile } from '@/hooks/useIsMobile';

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
  const isMobile = useIsMobile();

  // ── Handy: drei Gruppen statt drei Karten ──
  // Der Schalter gehört in eine Zeile, der Schlüssel in eine zweite, und die
  // Anweisungen brauchen die volle Breite. Die Erklärungen stehen als
  // Fußnote unter der Gruppe – im Kartenkopf nahmen sie oben Platz weg,
  // bevor man überhaupt etwas bedienen konnte.
  if (isMobile) {
    return (
      <div className="space-y-8">
        <FormGroup
          title="KI-Chat"
          footer="Zeigt oder versteckt den schwebenden Knopf unten rechts im Bildschirm."
        >
          <FormRow label="Chat-Knopf">
            <Switch checked={showAiChat} onCheckedChange={setShowAiChat} aria-label="KI-Chat-Knopf anzeigen" />
          </FormRow>
        </FormGroup>

        <div className="space-y-3">
          <FormGroup
            title="Gemini API-Key"
            footer="Wird sicher im Schlüsselbund des Systems gespeichert."
          >
            <FormRow label="Schlüssel">
              <input
                className={FIELD}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza…"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
                className="ml-2 shrink-0 text-muted-foreground active:opacity-60"
              >
                {showKey ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </FormRow>
          </FormGroup>
          <Button variant="secondary" className="h-11 w-full text-[17px]" onClick={saveApiKey}>
            <Save className="mr-2 h-4 w-4" />Schlüssel speichern
          </Button>
        </div>

        <div className="space-y-3">
          <FormGroup
            title="KI-Anweisungen"
            footer="Freitext – die KI liest diese Anweisungen bei jeder Rechnungsanalyse mit."
          >
            <FormFullRow>
              <textarea
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder={'Beispiele:\n- Rechnungen von "Amazon" sind immer Ausgaben, Kategorie "buerobedarf"\n- Wenn der Partner "Finanzamt" heißt, ist es immer type="info"'}
                rows={7}
                className="w-full resize-y bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
              />
            </FormFullRow>
          </FormGroup>
          <Button
            variant="secondary"
            className="h-11 w-full text-[17px]"
            onClick={saveAiInstructions}
            disabled={aiInstructionsSaving}
          >
            <Save className="mr-2 h-4 w-4" />Anweisungen speichern
          </Button>
        </div>
      </div>
    );
  }

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
            <Switch
              checked={showAiChat}
              onCheckedChange={setShowAiChat}
              aria-label="KI-Chat-Knopf anzeigen"
            />
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

