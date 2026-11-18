import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '', details: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'An unexpected error occurred.';
    let details = '';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        message = `Security or Data Access Error (${parsed.operationType || 'operation'} on ${parsed.path || 'resource'})`;
        details = parsed.error;
      }
    } catch {
      // Non-JSON runtime error
    }
    return { hasError: true, message, details };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090B0E] text-gray-100 flex items-center justify-center p-6">
          <div className="glass-surface max-w-lg w-full rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Command Center Recovery</h2>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{this.state.message}</p>
            {this.state.details && (
              <pre className="text-xs font-mono bg-black/50 border border-white/10 rounded-lg p-3 text-gray-400 overflow-auto max-h-40">
                {this.state.details}
              </pre>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '', details: '' })}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-gray-950 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Portal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
