import type { OrganizationRole, Prisma, ProjectRole } from '@prisma/client';

import { prisma } from '../config/prisma';
import { AppError } from './app-error';

export type ProjectAccessRequirement = 'read' | 'write' | 'admin';

export type ProjectAccessContext = {
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  projectRole: ProjectRole | null;
  isOrganizationAdmin: boolean;
  canWrite: boolean;
  canAdmin: boolean;
};

export const isOrganizationAdminRole = (role: OrganizationRole): boolean => {
  return role === 'OWNER' || role === 'ADMIN';
};

export const projectVisibilityWhere = (input: {
  organizationId: string;
  userId: string;
  organizationRole: OrganizationRole;
}): Prisma.ProjectWhereInput => {
  if (isOrganizationAdminRole(input.organizationRole)) {
    return {
      organizationId: input.organizationId
    };
  }

  return {
    organizationId: input.organizationId,
    members: {
      some: {
        userId: input.userId
      }
    }
  };
};

export const resolveProjectAccess = async (input: {
  organizationId: string;
  projectId: string;
  userId: string;
  organizationRole: OrganizationRole;
  requiredAccess: ProjectAccessRequirement;
}): Promise<ProjectAccessContext> => {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      organizationId: input.organizationId
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      members: {
        where: {
          userId: input.userId
        },
        select: {
          role: true
        },
        take: 1
      }
    }
  });

  if (!project) {
    throw new AppError(404, 'Projeto não encontrado.');
  }

  const isOrganizationAdmin = isOrganizationAdminRole(input.organizationRole);
  const projectRole = project.members[0]?.role ?? null;

  if (!isOrganizationAdmin && !projectRole) {
    throw new AppError(403, 'Você não tem acesso a este projeto.');
  }

  const canWrite = isOrganizationAdmin || (projectRole !== null && projectRole !== 'VIEWER');
  const canAdmin = isOrganizationAdmin || projectRole === 'OWNER' || projectRole === 'ADMIN';

  if (input.requiredAccess === 'write' && !canWrite) {
    throw new AppError(403, 'Seu perfil não pode alterar este projeto.');
  }

  if (input.requiredAccess === 'admin' && !canAdmin) {
    throw new AppError(403, 'Seu perfil não pode gerenciar este projeto.');
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color
    },
    projectRole,
    isOrganizationAdmin,
    canWrite,
    canAdmin
  };
};
