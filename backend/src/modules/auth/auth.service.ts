import type { OrganizationRole, ProjectRole } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { emailService } from '../../services/email/email.service';
import { AppError } from '../../shared/app-error';
import { hashPassword, signAuthToken, verifyPassword } from '../../shared/security';
import { generateSecureToken, hashToken } from '../../shared/token';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const INVITATION_ACCEPT_EXPIRATION_ERROR = 'Convite expirado. Solicite um novo convite ao administrador.';
const PASSWORD_RESET_EXPIRATION_HOURS = 2;

const rolePriority: Record<OrganizationRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

const projectRolePriority: Record<ProjectRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

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

const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeBrazilPhone = (rawValue: string): string => {
  const digitsOnly = rawValue.replace(/\D/g, '');
  const nationalDigits =
    (digitsOnly.length === 12 || digitsOnly.length === 13) && digitsOnly.startsWith('55')
      ? digitsOnly.slice(2)
      : digitsOnly;

  if (nationalDigits.length < 10 || nationalDigits.length > 11) {
    throw new AppError(400, 'Telefone inválido. Use um número brasileiro com DDD.');
  }

  if (nationalDigits.length === 10) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(2, 6)}-${nationalDigits.slice(6)}`;
  }

  return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(2, 7)}-${nationalDigits.slice(7)}`;
};

export type AuthSessionResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    phone: string | null;
  };
  activeOrganization: {
    id: string;
    name: string;
    slug: string;
    email: string;
    memberId: string;
    role: OrganizationRole;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    email: string;
    memberId: string;
    role: OrganizationRole;
  }>;
};

export type InvitationValidationResponse = {
  isValid: boolean;
  isExpired: boolean;
  isAccepted: boolean;
  email: string | null;
  role: OrganizationRole | null;
  projects: Array<{
    id: string;
    name: string;
    role: ProjectRole;
  }>;
};

export class AuthService {
  async registerOrganization(input: {
    organizationName: string;
    organizationSlug: string;
    organizationEmail?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  }): Promise<AuthSessionResponse> {
    const ownerEmail = normalizeEmail(input.ownerEmail);
    const organizationEmail = normalizeEmail(input.organizationEmail ?? input.ownerEmail);
    const slug = normalizeSlug(input.organizationSlug);

    if (!slug) {
      throw new AppError(400, 'Slug da organização inválido.');
    }

    const [existingUser, existingOrganization] = await Promise.all([
      prisma.user.findUnique({ where: { email: ownerEmail } }),
      prisma.organization.findUnique({ where: { slug } })
    ]);

    if (existingUser) {
      throw new AppError(409, 'Já existe usuário com este e-mail.');
    }

    if (existingOrganization) {
      throw new AppError(409, 'Slug da organização já está em uso.');
    }

    const passwordHash = await hashPassword(input.ownerPassword);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.ownerName.trim(),
          email: ownerEmail,
          passwordHash
        }
      });

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName.trim(),
          slug,
          email: organizationEmail
        }
      });

      const member = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'OWNER'
        }
      });

      return {
        userId: user.id,
        organizationId: organization.id,
        memberId: member.id
      };
    });

    return this.buildSessionResponse({
      userId: created.userId,
      activeMemberId: created.memberId,
      activeOrganizationId: created.organizationId
    });
  }

  async login(input: {
    email: string;
    password: string;
    organizationSlug?: string;
  }): Promise<AuthSessionResponse> {
    const user = await prisma.user.findUnique({
      where: {
        email: normalizeEmail(input.email)
      }
    });

    if (!user) {
      throw new AppError(401, 'Credenciais inválidas.');
    }

    const passwordIsValid = await verifyPassword(input.password, user.passwordHash);

    if (!passwordIsValid) {
      throw new AppError(401, 'Credenciais inválidas.');
    }

    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: user.id
      },
      include: {
        organization: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (memberships.length === 0) {
      throw new AppError(403, 'Usuário sem vínculo com organização.');
    }

    const normalizedSlug = input.organizationSlug ? normalizeSlug(input.organizationSlug) : null;

    const activeMembership = normalizedSlug
      ? memberships.find((entry) => entry.organization.slug === normalizedSlug)
      : memberships[0];

    if (!activeMembership) {
      throw new AppError(404, 'Organização não encontrada para este usuário.');
    }

    return this.buildSessionResponse({
      userId: user.id,
      activeMemberId: activeMembership.id,
      activeOrganizationId: activeMembership.organizationId
    });
  }

  async getSession(userId: string, organizationId: string, memberId: string): Promise<AuthSessionResponse> {
    return this.buildSessionResponse({
      userId,
      activeOrganizationId: organizationId,
      activeMemberId: memberId
    });
  }

  async updateProfile(input: {
    userId: string;
    organizationId: string;
    memberId: string;
    name?: string;
    phone?: string | null;
    avatarUrl?: string;
    removeAvatar?: boolean;
  }): Promise<AuthSessionResponse> {
    const data: {
      name?: string;
      phone?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.phone !== undefined) {
      data.phone = input.phone === null ? null : normalizeBrazilPhone(input.phone);
    }

    if (input.avatarUrl) {
      data.avatarUrl = input.avatarUrl;
    } else if (input.removeAvatar) {
      data.avatarUrl = null;
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({
        where: {
          id: input.userId
        },
        data
      });
    }

    return this.buildSessionResponse({
      userId: input.userId,
      activeOrganizationId: input.organizationId,
      activeMemberId: input.memberId
    });
  }

  async validateInvitationToken(token: string): Promise<InvitationValidationResponse> {
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      return {
        isValid: false,
        isExpired: false,
        isAccepted: false,
        email: null,
        role: null,
        projects: []
      };
    }

    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenHash: hashToken(normalizedToken)
      },
      include: {
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

    if (!invitation) {
      return {
        isValid: false,
        isExpired: false,
        isAccepted: false,
        email: null,
        role: null,
        projects: []
      };
    }

    const isAccepted = Boolean(invitation.acceptedAt);
    const isExpired = invitation.expiresAt.getTime() <= Date.now();
    const isValid = !isAccepted && !isExpired;

    return {
      isValid,
      isExpired,
      isAccepted,
      email: invitation.email,
      role: invitation.role,
      projects: invitation.projects.map((entry) => ({
        id: entry.project.id,
        name: entry.project.name,
        role: entry.role
      }))
    };
  }

  async acceptInvitation(input: {
    token: string;
    name: string;
    password: string;
  }): Promise<AuthSessionResponse> {
    const tokenHash = hashToken(input.token.trim());

    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenHash
      },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                organizationId: true
              }
            }
          }
        }
      }
    });

    if (!invitation) {
      throw new AppError(404, 'Convite inválido.');
    }

    if (invitation.acceptedAt) {
      throw new AppError(409, 'Este convite já foi aceito.');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new AppError(410, INVITATION_ACCEPT_EXPIRATION_ERROR);
    }

    const passwordHash = await hashPassword(input.password);

    const accepted = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          email: invitation.email
        },
        select: {
          id: true,
          name: true
        }
      });

      const user = existingUser
        ? await tx.user.update({
            where: {
              id: existingUser.id
            },
            data: {
              name: input.name.trim(),
              passwordHash
            },
            select: {
              id: true
            }
          })
        : await tx.user.create({
            data: {
              name: input.name.trim(),
              email: invitation.email,
              passwordHash
            },
            select: {
              id: true
            }
          });

      const existingMembership = await tx.organizationMember.findFirst({
        where: {
          organizationId: invitation.organizationId,
          userId: user.id
        },
        select: {
          id: true,
          role: true
        }
      });

      const targetOrganizationRole =
        existingMembership && rolePriority[existingMembership.role] >= rolePriority[invitation.role]
          ? existingMembership.role
          : invitation.role;

      const membership = existingMembership
        ? await tx.organizationMember.update({
            where: {
              id: existingMembership.id
            },
            data: {
              role: targetOrganizationRole
            },
            select: {
              id: true
            }
          })
        : await tx.organizationMember.create({
            data: {
              organizationId: invitation.organizationId,
              userId: user.id,
              role: invitation.role
            },
            select: {
              id: true
            }
          });

      for (const entry of invitation.projects) {
        const existingProjectMember = await tx.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: entry.projectId,
              userId: user.id
            }
          },
          select: {
            id: true,
            role: true
          }
        });

        const invitedProjectRole = entry.role ?? organizationRoleToProjectRole(invitation.role);

        if (existingProjectMember) {
          if (projectRolePriority[invitedProjectRole] > projectRolePriority[existingProjectMember.role]) {
            await tx.projectMember.update({
              where: {
                id: existingProjectMember.id
              },
              data: {
                role: invitedProjectRole
              }
            });
          }
          continue;
        }

        await tx.projectMember.create({
          data: {
            projectId: entry.projectId,
            userId: user.id,
            role: invitedProjectRole
          }
        });
      }

      await tx.invitation.update({
        where: {
          id: invitation.id
        },
        data: {
          acceptedAt: new Date()
        }
      });

      return {
        userId: user.id,
        organizationId: invitation.organizationId,
        memberId: membership.id
      };
    });

    return this.buildSessionResponse({
      userId: accepted.userId,
      activeOrganizationId: accepted.organizationId,
      activeMemberId: accepted.memberId
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: {
        email: normalizeEmail(email)
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (!user) {
      return;
    }

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_HOURS * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt
        }
      });
    });

    const resetUrl = emailService.getAppUrl(`/reset-password?token=${encodeURIComponent(token)}`);

    await emailService.sendEmail({
      to: user.email,
      subject: 'Redefinição de senha - Cais Teams',
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <p>Olá, ${user.name}.</p>
          <p>Recebemos uma solicitação para redefinir sua senha.</p>
          <p>Use o link abaixo para continuar:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Este link expira em ${PASSWORD_RESET_EXPIRATION_HOURS} horas.</p>
        </div>
      `,
      text: [
        `Olá, ${user.name}.`,
        'Recebemos uma solicitação para redefinir sua senha.',
        `Use o link para continuar: ${resetUrl}`,
        `Este link expira em ${PASSWORD_RESET_EXPIRATION_HOURS} horas.`
      ].join('\n')
    });
  }

  async resetPassword(input: { token: string; password: string }): Promise<void> {
    const normalizedToken = input.token.trim();
    const tokenHash = hashToken(normalizedToken);

    const passwordResetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        userId: true
      }
    });

    if (!passwordResetToken) {
      throw new AppError(400, 'Token inválido ou expirado.');
    }

    const passwordHash = await hashPassword(input.password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: passwordResetToken.userId
        },
        data: {
          passwordHash
        }
      });

      await tx.passwordResetToken.update({
        where: {
          id: passwordResetToken.id
        },
        data: {
          usedAt: new Date()
        }
      });
    });
  }

  private async buildSessionResponse(input: {
    userId: string;
    activeOrganizationId: string;
    activeMemberId: string;
  }): Promise<AuthSessionResponse> {
    const user = await prisma.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        phone: true
      }
    });

    if (!user) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: input.userId
      },
      include: {
        organization: true
      },
      orderBy: {
        organization: {
          name: 'asc'
        }
      }
    });

    const activeMembership = memberships.find(
      (entry) =>
        entry.organizationId === input.activeOrganizationId &&
        entry.id === input.activeMemberId
    );

    if (!activeMembership) {
      throw new AppError(401, 'Sessão inválida para organização ativa.');
    }

    const token = signAuthToken({
      userId: user.id,
      organizationId: activeMembership.organizationId,
      memberId: activeMembership.id,
      role: activeMembership.role
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        fullName: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        phone: user.phone
      },
      activeOrganization: {
        id: activeMembership.organization.id,
        name: activeMembership.organization.name,
        slug: activeMembership.organization.slug,
        email: activeMembership.organization.email,
        memberId: activeMembership.id,
        role: activeMembership.role
      },
      organizations: memberships.map((entry) => ({
        id: entry.organization.id,
        name: entry.organization.name,
        slug: entry.organization.slug,
        email: entry.organization.email,
        memberId: entry.id,
        role: entry.role
      }))
    };
  }
}

export const authService = new AuthService();
