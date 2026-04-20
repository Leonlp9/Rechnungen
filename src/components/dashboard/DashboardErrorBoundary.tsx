import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary für einzelne Dashboard-Widgets.
 * Verhindert, dass ein fehlerhaftes Widget das gesamte Dashboard zum Absturz bringt.
 */
export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Dashboard Widget Error] ${this.props.widgetName ?? 'Unknown'}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground rounded-lg border border-destructive/20 bg-destructive/5 min-h-[80px]">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-xs text-center">
            Widget-Fehler{this.props.widgetName ? `: ${this.props.widgetName}` : ''}
          </p>
          <button
            className="text-xs underline hover:text-foreground"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

