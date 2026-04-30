'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { useParams, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  Plus,
  Sparkles,
  Users,
  FolderOpen
} from 'lucide-react';

import { cn } from '@/lib/utils';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimized: () => void;
  onSignOut: () => void;
};

const navItems = [
  { href: '/dashboard' as Route, label: 'Painel', icon: LayoutDashboard },
  { href: '/team' as Route, label: 'Equipe', icon: Users },
  { href: '/projects' as Route, label: 'Projetos', icon: FolderOpen },
  { href: '/ai-search' as Route, label: 'Pesquisa IA', icon: Sparkles }
];

export const Sidebar = ({
  isOpen,
  onClose,
  isMinimized,
  onToggleMinimized,
  onSignOut
}: SidebarProps) => {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const activeProjectId = typeof params?.projectId === 'string' ? params.projectId : null;
  const newMeetingHref = (activeProjectId ? `/projects/${activeProjectId}/meetings/new` : '/projects') as Route;

  const handleSidebarDoubleClick = () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.innerWidth < 1024) {
      return;
    }

    onToggleMinimized();
  };

  return (
    <>
      <aside
        onDoubleClick={handleSidebarDoubleClick}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-app bg-white py-5 transition-[width,transform] duration-200 ease-in-out',
          isMinimized ? 'w-[88px] px-2' : 'w-60 px-3',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <Link
          href="/dashboard"
          className={cn('mb-7 flex items-center px-3', isMinimized ? 'justify-center' : 'gap-3')}
          onClick={onClose}
          title="Cais Teams"
        >
          <Image
            src="/caishub-svg-fonte-preta.svg"
            alt="Logo Cais"
            width={36}
            height={36}
            className="h-9 w-auto rounded-lg"
            priority
          />
          <span className={cn('min-w-0', isMinimized && 'hidden')}>
            <span className="block truncate text-sm font-bold text-brand">Cais Teams</span>
            <span className="block truncate text-xs text-app-muted">Plataforma de equipes com IA</span>
          </span>
        </Link>

        <Link
          href={newMeetingHref}
          onClick={onClose}
          className={cn(
            'mb-6 inline-flex h-10 items-center justify-center rounded-[10px] bg-cta text-sm font-semibold text-[#191c21] transition-colors hover:bg-[#e8a914]',
            isMinimized ? 'mx-1 gap-0 px-0' : 'gap-2 px-4'
          )}
          title="Nova reunião"
        >
          <Plus className="h-4 w-4" />
          <span className={cn(isMinimized && 'hidden')}>Nova reunião</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/projects'
              ? pathname.startsWith('/projects')
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={item.label}
                className={cn(
                  'flex h-10 items-center rounded-[10px] text-sm font-medium text-app-muted transition-colors hover:bg-app-active hover:text-brand',
                  isMinimized ? 'justify-center px-1' : 'gap-3 px-3',
                  isActive && 'bg-app-active text-brand'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className={cn(isMinimized && 'hidden')}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-app pt-4">
          {/* <button
            type="button"
            title="Configurações"
            className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm font-medium text-app-muted transition-colors hover:bg-app-active hover:text-brand"
          >
            <Settings className="h-4 w-4" />
            <span className={cn(isMinimized && 'hidden')}>Configurações</span>
          </button> */}
          {/* <button
            type="button"
            title="Suporte"
            className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm font-medium text-app-muted transition-colors hover:bg-app-active hover:text-brand"
          >
            <HelpCircle className="h-4 w-4" />
            <span className={cn(isMinimized && 'hidden')}>Suporte</span>
          </button> */}
          <button
            type="button"
            onClick={onSignOut}
            title="Sair"
            className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm font-medium text-app-muted transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            <span className={cn(isMinimized && 'hidden')}>Sair</span>
          </button>
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      ) : null}
    </>
  );
};
