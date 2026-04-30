import type { OrganizationRole } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { hashPassword, signAuthToken, verifyPassword } from '../../shared/security';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

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
    phone?: string | null;
    avatarUrl?: string;
    removeAvatar?: boolean;
  }): Promise<AuthSessionResponse> {
    const data: {
      phone?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (input.phone !== undefined) {
      data.phone = input.phone;
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
