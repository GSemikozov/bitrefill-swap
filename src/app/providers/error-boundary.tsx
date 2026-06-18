import { captureError } from '@shared/lib/monitoring';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defense: a render crash anywhere (including inside wallet UI
 * libraries) must never leave the user staring at a black screen.
 * Deliberately styled with plain classes — it must render even if providers died.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
    captureError(error, { source: 'react-error-boundary', componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-semibold text-lg">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          The page hit an unexpected error. Your funds are safe — any purchase in progress can be
          resumed after reloading.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
        >
          Reload page
        </button>
        <p className="max-w-full break-all font-mono text-muted-foreground text-xs">
          {this.state.error.message}
        </p>
      </main>
    );
  }
}
