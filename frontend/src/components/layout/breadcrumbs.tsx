import Link from 'next/link';
import type { Route } from 'next';

import { cn } from '@/lib/utils';

type BreadcrumbItem = {
  label: string;
  href?: Route;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={cn('mb-4 flex flex-wrap items-center gap-2 text-xs text-app-muted', className)}>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="font-semibold hover:text-brand">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#111827]">{item.label}</span>
          )}
          {index < items.length - 1 ? <span>/</span> : null}
        </span>
      ))}
    </nav>
  );
};
