import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  showDetails: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, showDetails: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { error, showDetails } = this.state;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6">
        <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Unerwarteter Fehler</p>
              <p className="text-xs text-muted-foreground">Die App ist auf ein Problem gestoßen</p>
            </div>
          </div>

          {/* Error message */}
          <div className="px-5 py-4 space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
              <p className="text-sm font-mono text-destructive break-words leading-relaxed">
                {error.message || 'Unbekannter Fehler'}
              </p>
            </div>

            {/* Stack trace toggle */}
            <button
              type="button"
              onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showDetails ? 'Details ausblenden' : 'Technische Details anzeigen'}
            </button>

            {showDetails && (
              <pre className="rounded-lg bg-muted/60 border border-border p-3 text-[10px] font-mono leading-relaxed overflow-auto max-h-48 text-muted-foreground whitespace-pre-wrap break-all">
                {error.stack}
              </pre>
            )}

            <p className="text-xs text-muted-foreground">
              Dieser Fehler wurde in der Konsole protokolliert. Ein Neuladen der App behebt ihn meistens.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border bg-muted/30 px-5 py-3">
            <Button
              className="flex-1"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              App neu laden
            </Button>
            <Button
              variant="outline"
              onClick={() => this.setState({ error: null, showDetails: false })}
            >
              Ignorieren
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

