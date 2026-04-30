import type { MemberRole } from '@/types/domain';

import { StatusBadge } from '@/components/ui/status-badge';

type RoleBadgeProps = {
  role: MemberRole;
};

const roleTone: Record<MemberRole, 'info' | 'success' | 'warning' | 'neutral'> = {
  OWNER: 'info',
  ADMIN: 'warning',
  MEMBER: 'success',
  VIEWER: 'neutral'
};

const roleLabel: Record<MemberRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  VIEWER: 'Visualizador'
};

export const RoleBadge = ({ role }: RoleBadgeProps) => (
  <StatusBadge label={roleLabel[role]} tone={roleTone[role]} />
);
