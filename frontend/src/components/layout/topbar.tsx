'use client';

import Image from 'next/image';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarClock,
  CircleCheck,
  Clock3,
  FileText,
  Kanban,
  Menu,
  MessageSquareText,
  Search,
  TriangleAlert,
  Users,
  X
} from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import { ApiError, api } from '@/lib/api';
import { useAppSession } from '@/lib/app-session';
import { getStoredSession, saveSession } from '@/lib/session';
import { useNotifications } from '@/lib/use-notifications';
import { cn } from '@/lib/utils';
import type { NotificationRecord } from '@/types/domain';

type TopbarProps = {
  title: string;
  userName: string;
  userEmail: string;
  userAvatarUrl?: string | null;
  userPhone?: string | null;
  onMenuClick: () => void;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
};

type ActiveToast = NotificationRecord;

const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', {
  numeric: 'auto'
});

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'C';
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const formatRelativeTime = (dateIso: string): string => {
  const date = new Date(dateIso);

  if (Number.isNaN(date.getTime())) {
    return 'agora';
  }

  const diffMs = date.getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;

  if (absDiffMs < minuteMs) {
    return 'agora';
  }

  if (absDiffMs < hourMs) {
    return relativeTimeFormatter.format(Math.round(diffMs / minuteMs), 'minute');
  }

  if (absDiffMs < dayMs) {
    return relativeTimeFormatter.format(Math.round(diffMs / hourMs), 'hour');
  }

  if (absDiffMs < weekMs) {
    return relativeTimeFormatter.format(Math.round(diffMs / dayMs), 'day');
  }

  return relativeTimeFormatter.format(Math.round(diffMs / weekMs), 'week');
};

const notificationIcon = (type: NotificationRecord['type']) => {
  const className = 'h-4 w-4';

  switch (type) {
    case 'CARD_ASSIGNED':
      return <Kanban className={`${className} text-[#0f5ab0]`} />;
    case 'CARD_DUE_DATE_SET':
      return <CalendarClock className={`${className} text-[#0f5ab0]`} />;
    case 'CARD_DUE_SOON':
      return <Clock3 className={`${className} text-[#d97706]`} />;
    case 'CARD_OVERDUE':
      return <TriangleAlert className={`${className} text-[#dc2626]`} />;
    case 'CARD_COMMENTED':
      return <MessageSquareText className={`${className} text-[#1d4ed8]`} />;
    case 'MEETING_TRANSCRIPTION_READY':
    case 'MEETING_NOTES_READY':
      return <FileText className={`${className} text-[#0f766e]`} />;
    case 'FILE_UPLOADED':
      return <FileText className={`${className} text-[#0369a1]`} />;
    case 'PROJECT_MEMBER_ADDED':
      return <Users className={`${className} text-[#7c3aed]`} />;
    case 'SYSTEM':
      return <CircleCheck className={`${className} text-[#0f766e]`} />;
    default:
      return <BellRing className={`${className} text-[#0f5ab0]`} />;
  }
};

export const Topbar = ({
  title,
  userName,
  userEmail,
  userAvatarUrl,
  userPhone,
  onMenuClick,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  className
}: TopbarProps) => {
  const router = useRouter();
  const session = useAppSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [persistedPhone, setPersistedPhone] = useState(userPhone ?? '');
  const [persistedAvatarUrl, setPersistedAvatarUrl] = useState<string | null>(userAvatarUrl ?? null);
  const [phone, setPhone] = useState(userPhone ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isAvatarRemoved, setIsAvatarRemoved] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((notificationId: string) => {
    const timeout = toastTimeoutsRef.current.get(notificationId);

    if (timeout) {
      clearTimeout(timeout);
      toastTimeoutsRef.current.delete(notificationId);
    }

    setToasts((current) => current.filter((entry) => entry.id !== notificationId));
  }, []);

  const showToast = useCallback(
    (notification: NotificationRecord) => {
      setToasts((current) => {
        if (current.some((entry) => entry.id === notification.id)) {
          return current;
        }

        return [...current, notification];
      });

      const existingTimeout = toastTimeoutsRef.current.get(notification.id);

      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = window.setTimeout(() => {
        dismissToast(notification.id);
      }, 6_500);

      toastTimeoutsRef.current.set(notification.id, timeout);
    },
    [dismissToast]
  );

  const {
    notifications,
    unreadCount,
    isLoading,
    error: notificationsError,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
  } = useNotifications({
    token: session.token,
    organizationId: session.activeOrganization.id,
    userId: session.user.id,
    listLimit: 20,
    pollIntervalMs: 45_000,
    onNewNotification: showToast
  });

  useEffect(() => {
    const timeoutMap = toastTimeoutsRef.current;

    return () => {
      for (const timeout of timeoutMap.values()) {
        clearTimeout(timeout);
      }

      timeoutMap.clear();
    };
  }, []);

  useEffect(() => {
    setPersistedPhone(userPhone ?? '');
    setPersistedAvatarUrl(userAvatarUrl ?? null);
  }, [userAvatarUrl, userPhone]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (!notificationsPanelRef.current?.contains(target)) {
        setIsNotificationsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationsOpen]);

  const clearAvatarSelection = () => {
    setAvatarFile(null);
    setAvatarPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
  };

  const openProfileModal = () => {
    setPhone(persistedPhone);
    setIsAvatarRemoved(false);
    setProfileError(null);
    clearAvatarSelection();
    setIsProfileOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileOpen(false);
    setProfileError(null);
    clearAvatarSelection();
    setIsAvatarRemoved(false);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setAvatarPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });

    setAvatarFile(file);
    setIsAvatarRemoved(false);
    setProfileError(null);
    event.target.value = '';
  };

  const handleRemovePhoto = () => {
    clearAvatarSelection();
    setIsAvatarRemoved(true);
    setProfileError(null);
  };

  const handleSaveProfile = async () => {
    const storedSession = getStoredSession();

    if (!storedSession?.token) {
      setProfileError('Sessão expirada. Faça login novamente.');
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      const updatedSession = await api.updateProfile(storedSession.token, {
        phone: phone.trim(),
        avatar: avatarFile ?? undefined,
        removeAvatar: isAvatarRemoved && !avatarFile
      });

      saveSession(updatedSession);

      const nextPhone = updatedSession.user.phone ?? '';
      const nextAvatarUrl = updatedSession.user.avatarUrl;

      setPersistedPhone(nextPhone);
      setPersistedAvatarUrl(nextAvatarUrl);
      setPhone(nextPhone);
      setIsAvatarRemoved(false);
      clearAvatarSelection();
      setIsProfileOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Não foi possível salvar o perfil.';
      setProfileError(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleNotificationClick = async (notification: NotificationRecord, closeDropdown = true) => {
    try {
      if (!notification.isRead) {
        setMarkingNotificationId(notification.id);
        await markNotificationAsRead(notification.id);
      }
    } catch {
      // Não interrompe a navegação ao abrir a origem da notificação.
    } finally {
      setMarkingNotificationId(null);

      if (closeDropdown) {
        setIsNotificationsOpen(false);
      }

      dismissToast(notification.id);

      if (notification.targetHref) {
        router.push(notification.targetHref as Route);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsMarkingAllAsRead(true);
      await markAllNotificationsAsRead();
    } finally {
      setIsMarkingAllAsRead(false);
    }
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen((current) => {
      const next = !current;

      if (next) {
        void refreshNotifications({ silent: true });
      }

      return next;
    });
  };

  const topbarAvatar = avatarPreviewUrl ?? (isAvatarRemoved ? null : persistedAvatarUrl);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between border-b border-app bg-white px-4 lg:px-8',
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-app-muted transition-colors hover:bg-app-active hover:text-brand lg:hidden"
            aria-label="Abrir navegação"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-sm font-bold text-[#111827]">{title}</h1>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative hidden w-[min(320px,32vw)] min-w-[180px] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" />
            <input
              value={searchValue ?? ''}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder ?? 'Buscar na organização'}
              className="h-9 w-full rounded-[10px] border border-app bg-[#F7F9FC] pl-10 pr-4 text-sm text-[#111827] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
          </div>

          <div className="relative" ref={notificationsPanelRef}>
            <button
              type="button"
              onClick={toggleNotifications}
              className={cn(
                'relative rounded-[10px] p-2 text-app-muted transition-colors hover:bg-app-active hover:text-brand',
                unreadCount > 0 && 'text-brand'
              )}
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] max-w-[90vw] overflow-hidden rounded-xl border border-app bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-app px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0f172a]">Notificações</p>
                    <p className="text-xs text-[#64748b]">
                      {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleMarkAllAsRead();
                    }}
                    disabled={unreadCount === 0 || isMarkingAllAsRead}
                    className="text-xs font-semibold text-brand transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isMarkingAllAsRead ? 'Marcando...' : 'Marcar todas como lidas'}
                  </button>
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {isLoading ? (
                    <div className="space-y-3 p-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="animate-pulse space-y-2 rounded-lg border border-app px-3 py-2">
                          <div className="h-3 w-2/3 rounded bg-[#e2e8f0]" />
                          <div className="h-3 w-full rounded bg-[#e2e8f0]" />
                          <div className="h-3 w-1/3 rounded bg-[#e2e8f0]" />
                        </div>
                      ))}
                    </div>
                  ) : notificationsError ? (
                    <div className="p-4 text-sm text-[#b91c1c]">Não foi possível carregar as notificações.</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-4 text-sm text-[#64748b]">Nenhuma notificação no momento.</div>
                  ) : (
                    <ul className="divide-y divide-app">
                      {notifications.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            onClick={() => {
                              void handleNotificationClick(notification);
                            }}
                            disabled={markingNotificationId === notification.id}
                            className={cn(
                              'w-full px-4 py-3 text-left transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-70',
                              !notification.isRead && 'bg-[#f8fbff]'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{notificationIcon(notification.type)}</div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-[#0f172a]">{notification.title}</p>
                                  {!notification.isRead ? (
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0f5ab0]" aria-hidden="true" />
                                  ) : null}
                                </div>
                                <p className="truncate text-xs text-[#475569]">{notification.message}</p>
                                <p className="mt-1 text-[11px] text-[#94a3b8]">{formatRelativeTime(notification.createdAt)}</p>
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={openProfileModal}
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-app bg-app-active text-xs font-semibold text-brand"
            aria-label="Abrir perfil"
            title={`Perfil • ${userName}`}
          >
            {topbarAvatar ? (
              <Image
                src={topbarAvatar}
                alt={`Foto de ${userName}`}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(userName)
            )}
          </button>
        </div>
      </header>

      <Modal
        open={isProfileOpen}
        title="Meu perfil"
        description="Atualize suas informações de contato e foto."
        onClose={closeProfileModal}
        className="max-w-lg"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[10px] border border-app bg-app-active text-sm font-semibold text-brand">
              {topbarAvatar ? (
                <Image
                  src={topbarAvatar}
                  alt={`Foto de ${userName}`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(userName)
              )}
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-[10px] border border-app px-3 py-2 text-sm font-semibold text-[#334155] transition-colors hover:bg-app-active">
                Trocar foto
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} />
              </label>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="rounded-[10px] border border-app px-3 py-2 text-sm font-semibold text-[#64748b] transition-colors hover:bg-app-active"
              >
                Remover foto
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">Nome</p>
              <div className="h-10 rounded-[10px] border border-app bg-[#f8fafc] px-3 py-2 text-sm text-[#334155]">
                {userName}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]">E-mail</p>
              <div className="h-10 rounded-[10px] border border-app bg-[#f8fafc] px-3 py-2 text-sm text-[#334155]">
                {userEmail}
              </div>
            </div>
            <div>
              <label
                htmlFor="profile_phone"
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-[#475569]"
              >
                Telefone
              </label>
              <input
                id="profile_phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(00) 00000-0000"
                className="h-10 w-full rounded-[10px] border border-app bg-white px-3 text-sm text-[#111827] outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
            </div>
          </div>

          {profileError ? <p className="text-sm font-medium text-red-700">{profileError}</p> : null}

          <div className="flex items-center justify-end gap-2 border-t border-app pt-4">
            <button
              type="button"
              onClick={closeProfileModal}
              className="rounded-[10px] border border-app px-3 py-2 text-sm font-semibold text-[#64748b] transition-colors hover:bg-app-active"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="rounded-[10px] bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0f5ab0] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSavingProfile ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="pointer-events-none fixed bottom-4 left-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-xl border border-app bg-white p-3 shadow-lg"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5">{notificationIcon(toast.type)}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0f172a]">{toast.title}</p>
                <p className="truncate text-xs text-[#475569]">{toast.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  {toast.targetHref ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleNotificationClick(toast, false);
                      }}
                      className="rounded-md bg-[#0f5ab0] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#0c4b92]"
                    >
                      Abrir
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#475569] transition-colors hover:bg-[#f1f5f9]"
                  >
                    <X className="h-3.5 w-3.5" />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
