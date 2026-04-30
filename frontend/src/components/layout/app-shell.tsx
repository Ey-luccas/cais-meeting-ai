'use client';

import { useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import type { Route } from 'next';

import { useAppShellConfig } from '@/components/layout/app-shell-config';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import { ProjectSubnav } from '@/components/layout/project-subnav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

type AppShellProps = {
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  userPhone?: string | null;
  onSignOut: () => void;
  children: React.ReactNode;
};

const titleBySegment: Record<string, string> = {
  dashboard: 'Painel',
  team: 'Equipe',
  projects: 'Projetos',
  meetings: 'Reuniões',
  board: 'Quadro',
  files: 'Biblioteca',
  library: 'Biblioteca',
  reports: 'Relatórios',
  'ai-search': 'Pesquisa IA Central'
};

const inferTitle = (pathname: string): string => {
  if (pathname.includes('/meetings/new')) {
    return 'Nova reunião';
  }

  const segments = pathname.split('/').filter(Boolean);
  const lastKnown = [...segments].reverse().find((segment) => titleBySegment[segment]);

  return lastKnown ? titleBySegment[lastKnown] : 'Cais Teams';
};

const segmentLabel: Record<string, string> = {
  dashboard: 'Painel',
  team: 'Equipe',
  projects: 'Projetos',
  meetings: 'Reuniões',
  board: 'Quadro',
  files: 'Biblioteca',
  library: 'Biblioteca',
  reports: 'Relatórios',
  'ai-search': 'Pesquisa IA',
  new: 'Novo'
};

const inferDynamicLabel = (segment: string, previous?: string): string => {
  if (previous === 'projects') {
    return 'Projeto';
  }

  if (previous === 'meetings') {
    return 'Reunião';
  }

  return segment;
};

const buildBreadcrumbs = (pathname: string): Array<{ label: string; href?: Route }> => {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) {
    return [];
  }

  return segments.map((segment, index) => {
    const previous = index > 0 ? segments[index - 1] : undefined;
    const label = segmentLabel[segment] ?? inferDynamicLabel(segment, previous);
    const hrefPath = `/${segments.slice(0, index + 1).join('/')}` as Route;

    return index === segments.length - 1
      ? { label }
      : { label, href: hrefPath };
  });
};

const shouldRenderProjectSubnav = (pathname: string, projectId?: string): boolean => {
  if (!projectId) {
    return false;
  }

  const basePath = `/projects/${projectId}`;

  return [
    basePath,
    `${basePath}/meetings`,
    `${basePath}/board`,
    `${basePath}/files`,
    `${basePath}/library`,
    `${basePath}/reports`,
    `${basePath}/ai-search`
  ].includes(pathname);
};

export const AppShell = ({
  userName,
  userEmail,
  userAvatarUrl,
  userPhone,
  onSignOut,
  children
}: AppShellProps) => {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const shellConfig = useAppShellConfig();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const projectIdFromPath = typeof params?.projectId === 'string' ? params.projectId : undefined;
  const activeProjectId = shellConfig.project?.id ?? projectIdFromPath;
  const topbarTitle = useMemo(() => shellConfig.title ?? inferTitle(pathname), [pathname, shellConfig.title]);
  const showProjectSubnav = shouldRenderProjectSubnav(pathname, activeProjectId);
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const showFullBleedContent = activeProjectId ? pathname === `/projects/${activeProjectId}/board` : false;

  return (
    <div className="min-h-screen overflow-x-hidden bg-app text-[#111827]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMinimized={sidebarMinimized}
        onToggleMinimized={() => setSidebarMinimized((current) => !current)}
        onSignOut={onSignOut}
      />

      <div className={sidebarMinimized ? 'min-w-0 lg:pl-[88px]' : 'min-w-0 lg:pl-60'}>
        <Topbar
          title={topbarTitle}
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          userPhone={userPhone}
          onMenuClick={() => setSidebarOpen(true)}
          searchValue={shellConfig.searchValue}
          searchPlaceholder={shellConfig.searchPlaceholder}
          onSearchChange={shellConfig.onSearchChange}
        />

        {showProjectSubnav && activeProjectId ? (
          <ProjectSubnav
            projectId={activeProjectId}
            projectName={shellConfig.project?.name}
            projectColor={shellConfig.project?.color}
          />
        ) : null}

        <main className="scrollbar-none min-w-0 overflow-x-hidden">
          {showFullBleedContent ? (
            children
          ) : (
            <PageContainer size="wide">
              {!showProjectSubnav ? <Breadcrumbs items={breadcrumbs} /> : null}
              {children}
            </PageContainer>
          )}
        </main>
      </div>
    </div>
  );
};
