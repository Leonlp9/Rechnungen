import { Receipt, Sparkles, ArrowRight, X } from 'lucide-react';
import { useTutorialStore } from '@/store/tutorialStore';

export function WelcomeScreen() {
  const hasSeenTutorial = useTutorialStore((s) => s.hasSeenTutorial);
  const isActive = useTutorialStore((s) => s.isActive);
  const startTutorial = useTutorialStore((s) => s.startTutorial);
  const skipTutorial = useTutorialStore((s) => s.skipTutorial);

  if (hasSeenTutorial || isActive) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={skipTutorial}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Überspringen"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Receipt className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Willkommen beim Klevr! 🎉
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Dein persönliches Tool zum Erstellen, Verwalten und Versenden von Rechnungen.
            Lass uns die wichtigsten Funktionen gemeinsam entdecken.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { icon: '📊', text: 'Umsatz-Dashboard & Statistiken' },
            { icon: '✏️', text: 'Rechnungen erstellen & versenden' },
            { icon: '🎨', text: 'Vorlagen individuell gestalten' },
            { icon: '📧', text: 'E-Mail-Integration & Autoerkennung' },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-lg">{f.icon}</span>
              <span className="text-xs font-medium text-foreground/80">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={startTutorial}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Geführte Tour starten
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={skipTutorial}
            className="w-full rounded-xl border border-border px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Überspringen – ich kenne mich schon aus
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Das Tutorial kann jederzeit unter <strong>Hilfe</strong> neu gestartet werden.
        </p>
      </div>
    </div>
  );
}

