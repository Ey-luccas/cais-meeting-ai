import type { OrganizationRole, ProjectRole } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { emailService } from '../../services/email/email.service';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { generateSecureToken, hashToken } from '../../shared/token';

const INVITATION_EXPIRATION_HOURS = 72;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const organizationRoleToProjectRole = (role: OrganizationRole): ProjectRole => {
  if (role === 'OWNER') {
    return 'OWNER';
  }

  if (role === 'ADMIN') {
    return 'ADMIN';
  }

  if (role === 'VIEWER') {
    return 'VIEWER';
  }

  return 'MEMBER';
};

export type InvitationSummary = {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
  projects: Array<{
    id: string;
    name: string;
    role: ProjectRole;
  }>;
};

export class CollaboratorsService {
  private assertInvitePermission(input: {
    actorRole: OrganizationRole;
    invitedRole: OrganizationRole;
  }): void {
    if (input.actorRole !== 'OWNER' && input.actorRole !== 'ADMIN') {
      throw new AppError(403, 'Somente OWNER/ADMIN pode convidar colaboradores.');
    }

    if (input.actorRole === 'ADMIN' && input.invitedRole === 'OWNER') {
      throw new AppError(403, 'ADMIN não pode convidar colaborador com papel OWNER.');
    }
  }

  async invite(input: {
    organizationId: string;
    actorUserId: string;
    actorRole: OrganizationRole;
    email: string;
    role: OrganizationRole;
    projectIds: string[];
  }): Promise<{
    invitation: InvitationSummary;
    emailSent: boolean;
  }> {
    this.assertInvitePermission({
      actorRole: input.actorRole,
      invitedRole: input.role
    });

    const normalizedEmail = normalizeEmail(input.email);
    const uniqueProjectIds = [...new Set(input.projectIds)];

    if (uniqueProjectIds.length === 0) {
      throw new AppError(400, 'Selecione ao menos um projeto para o colaborador.');
    }

    const projects = await prisma.project.findMany({
      where: {
        organizationId: input.organizationId,
        id: {
          in: uniqueProjectIds
        }
      },
      select: {
        id: true,
        name: true,
        members: {
          where: {
            userId: input.actorUserId
          },
          select: {
            role: true
          },
          take: 1
        }
      }
    });

    if (projects.length !== uniqueProjectIds.length) {
      throw new AppError(400, 'Um ou mais projetos informados não existem nesta organização.');
    }

    if (input.actorRole !== 'OWNER' && input.actorRole !== 'ADMIN') {
      const missingAdminAccess = projects.find((project) => {
        const actorProjectRole = project.members[0]?.role;
        return actorProjectRole !== 'OWNER' && actorProjectRole !== 'ADMIN';
      });

      if (missingAdminAccess) {
        throw new AppError(403, 'Sem permissão para convidar colaborador em todos os projetos selecionados.');
      }
    }

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRATION_HOURS * 60 * 60 * 1000);
    const projectRole = organizationRoleToProjectRole(input.role);

    const invitation = await prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          organizationId: input.organizationId,
          email: normalizedEmail,
          acceptedAt: null
        },
        data: {
          expiresAt: new Date()
        }
      });

      return tx.invitation.create({
        data: {
          organizationId: input.organizationId,
          invitedByUserId: input.actorUserId,
          email: normalizedEmail,
          role: input.role,
          tokenHash,
          expiresAt,
          projects: {
            create: projects.map((project) => ({
              projectId: project.id,
              role: projectRole
            }))
          }
        },
        include: {
          invitedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          projects: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              project: {
                name: 'asc'
              }
            }
          }
        }
      });
    });

    const inviteUrl = emailService.getAppUrl(`/accept-invite?token=${encodeURIComponent(token)}`);
    const projectNames = invitation.projects.map((entry) => entry.project.name).join(', ');

    const emailSent = await emailService.sendEmail({
      to: invitation.email,
      subject: 'Convite para entrar no Cais Teams',
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <p>Olá,</p>
          <p>Você recebeu um convite para colaborar no Cais Teams.</p>
          <p><strong>Papel:</strong> ${invitation.role}</p>
          <p><strong>Projetos:</strong> ${projectNames}</p>
          <p>Para aceitar, acesse o link:</p>
          <p><a href="${inviteUrl}">${inviteUrl}</a></p>
          <p>Este link expira em ${INVITATION_EXPIRATION_HOURS} horas.</p>
        </div>
      `,
      text: [
        'Você recebeu um convite para colaborar no Cais Teams.',
        `Papel: ${invitation.role}`,
        `Projetos: ${projectNames}`,
        `Aceite o convite: ${inviteUrl}`,
        `Este link expira em ${INVITATION_EXPIRATION_HOURS} horas.`
      ].join('\n')
    });

    if (!emailSent) {
      logger.warn('Convite criado, mas envio de e-mail não foi concluído.', {
        invitationId: invitation.id,
        organizationId: input.organizationId
      });
    }

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
        createdAt: invitation.createdAt.toISOString(),
        invitedBy: invitation.invitedByUser,
        projects: invitation.projects.map((entry) => ({
          id: entry.project.id,
          name: entry.project.name,
          role: entry.role
        }))
      },
      emailSent
    };
  }

  async listPendingInvitations(input: {
    organizationId: string;
    actorRole: OrganizationRole;
  }): Promise<InvitationSummary[]> {
    if (input.actorRole !== 'OWNER' && input.actorRole !== 'ADMIN') {
      throw new AppError(403, 'Somente OWNER/ADMIN pode visualizar convites pendentes.');
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: input.organizationId,
        acceptedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        invitedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            project: {
              name: 'asc'
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
      invitedBy: invitation.invitedByUser,
      projects: invitation.projects.map((entry) => ({
        id: entry.project.id,
        name: entry.project.name,
        role: entry.role
      }))
    }));
  }
}

export const collaboratorsService = new CollaboratorsService();
