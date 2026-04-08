import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Início' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/meetings', label: 'Reuniões' },
  { href: '/meetings/new', label: 'Nova Reunião' }
] as const;

type SiteHeaderProps = {
  className?: string;
};

export const SiteHeader = ({ className }: SiteHeaderProps): JSX.Element => {
  return (
    <header
      className={cn(
        'cais-glass px-4 py-3 md:px-6',
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.16)] px-3 py-2 text-xs tracking-[0.14em] text-white uppercase"
        >
          <Sparkles size={14} />
          CAIS Meeting AI
        </Link>

        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold tracking-[0.05em] text-white/86 uppercase transition hover:border-[rgba(255,255,255,0.26)] hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};
