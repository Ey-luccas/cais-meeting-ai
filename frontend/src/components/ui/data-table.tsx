import { cn } from '@/lib/utils';

type DataTableProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  tableClassName?: string;
};

export const DataTable = ({
  children,
  header,
  footer,
  className,
  tableClassName
}: DataTableProps) => (
  <section className={cn('overflow-hidden rounded-[10px] border border-app bg-white shadow-[0_10px_20px_-22px_rgba(17,24,39,0.45)]', className)}>
    {header ? <div className="border-b border-app bg-app/35 p-4">{header}</div> : null}
    <div className="scrollbar-none min-w-0 overflow-x-auto">
      <table className={cn('w-full min-w-0 border-collapse text-left', tableClassName)}>{children}</table>
    </div>
    {footer ? <div className="border-t border-app bg-app/30 p-4">{footer}</div> : null}
  </section>
);
