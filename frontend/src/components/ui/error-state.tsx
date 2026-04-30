import { AlertTriangle } from 'lucide-react';

type ErrorStateProps = {
  title?: string;
  message: string;
  action?: React.ReactNode;
};

export const ErrorState = ({ title = 'Erro ao carregar dados', message, action }: ErrorStateProps) => (
  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-sm">{message}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  </div>
);
