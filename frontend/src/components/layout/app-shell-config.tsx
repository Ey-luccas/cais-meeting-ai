'use client';

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

export type AppShellProject = {
  id: string;
  name?: string;
  color?: string | null;
};

export type AppShellConfig = {
  title?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  project?: AppShellProject;
};

const defaultConfig: AppShellConfig = {};

type AppShellConfigContextValue = {
  config: AppShellConfig;
  setConfig: (config: AppShellConfig) => void;
  resetConfig: () => void;
};

const AppShellConfigContext = createContext<AppShellConfigContextValue | null>(null);

export const AppShellConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const [config, setConfigState] = useState<AppShellConfig>(defaultConfig);

  const setConfig = useCallback((nextConfig: AppShellConfig) => {
    setConfigState({
      ...defaultConfig,
      ...nextConfig
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(defaultConfig);
  }, []);

  const value = useMemo(
    () => ({ config, setConfig, resetConfig }),
    [config, resetConfig, setConfig]
  );

  return <AppShellConfigContext.Provider value={value}>{children}</AppShellConfigContext.Provider>;
};

const useAppShellConfigContext = (): AppShellConfigContextValue => {
  const context = useContext(AppShellConfigContext);

  if (!context) {
    throw new Error('useAppShellConfigContext deve ser usado dentro de AppShellConfigProvider.');
  }

  return context;
};

export const useAppShellConfig = (): AppShellConfig => useAppShellConfigContext().config;

export const useConfigureAppShell = (nextConfig: AppShellConfig) => {
  const { setConfig, resetConfig } = useAppShellConfigContext();
  const title = nextConfig.title;
  const searchValue = nextConfig.searchValue;
  const searchPlaceholder = nextConfig.searchPlaceholder;
  const onSearchChange = nextConfig.onSearchChange;
  const projectId = nextConfig.project?.id;
  const projectName = nextConfig.project?.name;
  const projectColor = nextConfig.project?.color;

  useLayoutEffect(() => {
    setConfig({
      title,
      searchValue,
      searchPlaceholder,
      onSearchChange,
      project: projectId
        ? {
            id: projectId,
            name: projectName,
            color: projectColor
          }
        : undefined
    });

    return () => {
      resetConfig();
    };
  }, [
    onSearchChange,
    projectColor,
    projectId,
    projectName,
    searchPlaceholder,
    searchValue,
    title,
    resetConfig,
    setConfig
  ]);
};
