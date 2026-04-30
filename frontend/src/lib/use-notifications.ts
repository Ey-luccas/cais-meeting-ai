'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, api } from '@/lib/api';
import type { NotificationRecord } from '@/types/domain';

const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_POLL_INTERVAL_MS = 45_000;

type UseNotificationsOptions = {
  token: string;
  organizationId: string;
  userId: string;
  listLimit?: number;
  pollIntervalMs?: number;
  onNewNotification?: (notification: NotificationRecord) => void;
};

type RefreshNotificationsOptions = {
  silent?: boolean;
  initialLoad?: boolean;
};

const getLastSeenStorageKey = (organizationId: string, userId: string): string =>
  `cais_teams_notifications_last_seen_${organizationId}_${userId}`;

export const useNotifications = (options: UseNotificationsOptions) => {
  const {
    token,
    organizationId,
    userId,
    listLimit,
    pollIntervalMs,
    onNewNotification
  } = options;
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);
  const loadingRef = useRef(false);
  const shownToastIdsRef = useRef<Set<string>>(new Set());

  const normalizedLimit = useMemo(() => {
    if (!listLimit || listLimit <= 0) {
      return DEFAULT_LIST_LIMIT;
    }

    return Math.min(100, Math.floor(listLimit));
  }, [listLimit]);

  const resolveErrorMessage = (value: unknown): string => {
    if (value instanceof ApiError) {
      return value.message;
    }

    return 'Não foi possível carregar as notificações.';
  };

  const processNewNotifications = useCallback(
    (nextNotifications: NotificationRecord[], refreshOptions?: RefreshNotificationsOptions) => {
      if (typeof window === 'undefined' || !onNewNotification || nextNotifications.length === 0) {
        return;
      }

      const storageKey = getLastSeenStorageKey(organizationId, userId);
      const latestNotificationId = nextNotifications[0]?.id;

      if (!latestNotificationId) {
        return;
      }

      const lastSeenNotificationId = window.localStorage.getItem(storageKey);

      if (!lastSeenNotificationId) {
        window.localStorage.setItem(storageKey, latestNotificationId);
        return;
      }

      if (lastSeenNotificationId === latestNotificationId) {
        return;
      }

      if (refreshOptions?.initialLoad) {
        window.localStorage.setItem(storageKey, latestNotificationId);
        return;
      }

      const boundaryIndex = nextNotifications.findIndex((entry) => entry.id === lastSeenNotificationId);

      if (boundaryIndex <= 0) {
        window.localStorage.setItem(storageKey, latestNotificationId);
        return;
      }

      const newNotifications = nextNotifications
        .slice(0, boundaryIndex)
        .reverse()
        .filter((entry) => !entry.isRead);

      for (const notification of newNotifications) {
        if (shownToastIdsRef.current.has(notification.id)) {
          continue;
        }

        shownToastIdsRef.current.add(notification.id);
        onNewNotification(notification);
      }

      window.localStorage.setItem(storageKey, latestNotificationId);
    },
    [onNewNotification, organizationId, userId]
  );

  const refreshNotifications = useCallback(
    async (refreshOptions?: RefreshNotificationsOptions): Promise<void> => {
      if (!token) {
        return;
      }

      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      if (!refreshOptions?.silent && mountedRef.current) {
        setIsLoading(true);
      }

      try {
        const [listResponse, unreadResponse] = await Promise.all([
          api.listNotifications(token, {
            limit: normalizedLimit
          }),
          api.getUnreadNotificationsCount(token)
        ]);

        if (!mountedRef.current) {
          return;
        }

        processNewNotifications(listResponse.notifications, refreshOptions);
        setNotifications(listResponse.notifications);
        setUnreadCount(unreadResponse.count);
        setError(null);
      } catch (fetchError) {
        if (!mountedRef.current) {
          return;
        }

        setError(resolveErrorMessage(fetchError));
      } finally {
        loadingRef.current = false;

        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [normalizedLimit, processNewNotifications, token]
  );

  const markNotificationAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!token) {
        return;
      }

      const updated = await api.markNotificationAsRead(token, notificationId);

      setNotifications((current) =>
        current.map((entry) => (entry.id === notificationId ? updated : entry))
      );

      await refreshNotifications({ silent: true });
    },
    [refreshNotifications, token]
  );

  const markAllNotificationsAsRead = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }

    await api.markAllNotificationsAsRead(token);

    setNotifications((current) =>
      current.map((entry) => ({
        ...entry,
        isRead: true,
        readAt: entry.readAt ?? new Date().toISOString()
      }))
    );

    setUnreadCount(0);
    await refreshNotifications({ silent: true });
  }, [refreshNotifications, token]);

  const deleteNotification = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!token) {
        return;
      }

      await api.deleteNotification(token, notificationId);

      setNotifications((current) => current.filter((entry) => entry.id !== notificationId));
      await refreshNotifications({ silent: true });
    },
    [refreshNotifications, token]
  );

  useEffect(() => {
    mountedRef.current = true;
    void refreshNotifications({ initialLoad: true });

    const intervalMs =
      typeof pollIntervalMs === 'number' && pollIntervalMs >= 15_000
        ? pollIntervalMs
        : DEFAULT_POLL_INTERVAL_MS;

    pollingRef.current = setInterval(() => {
      void refreshNotifications({ silent: true });
    }, intervalMs);

    return () => {
      mountedRef.current = false;

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [pollIntervalMs, refreshNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
  };
};
