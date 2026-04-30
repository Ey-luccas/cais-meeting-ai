import { cn } from '@/lib/utils';

type DataPanelProps = {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export const DataPanel = ({ header, children, footer, className }: DataPanelProps) => (
  <section className={cn('app-panel overflow-hidden', className)}>
    {header ? <div className="app-panel-header">{header}</div> : null}
    <div className="app-panel-body">{children}</div>
    {footer ? <div className="border-t border-[#e4e9f2] px-5 py-3">{footer}</div> : null}
  </section>
);
