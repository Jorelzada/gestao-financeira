import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  render() {
    if (this.state.hasError) {
      let parsedMsg = this.state.message;
      try {
        const obj = JSON.parse(this.state.message) as { error?: string; path?: string };
        if (obj.error) {
          parsedMsg = `Erro de acesso aos dados (${obj.path ?? 'Firestore'}): ${obj.error}`;
        }
      } catch {
        // plain text error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] dark:bg-[#0B1120] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Não foi possível carregar esta operação
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {parsedMsg}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
