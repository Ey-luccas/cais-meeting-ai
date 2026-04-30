import type { OrganizationRole, Prisma } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { hashPassword } from '../../shared/security';

type TeamMember = {
  memberId: string;
  role: OrganizationRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
};

type OrganizationDashboardActivityType =
  | 'MEETING_CREATED'
  | 'OBSERVATION_ADDED'
  | 'CARD_CREATED'
  | 'FILE_UPLOADED'
  | 'MEMBER_ADDED';

type OrganizationDashboard = {
  organization: {
    id: string;
    name: string;
    slug: string;
    email: string;
  };
  period: {
    days: number;
    from: string;
    to: string;
  };
  metrics: {
    projects: number;
    recentMeetings: number;
    openCards: number;
    recentDecisions: number;
    recentPendingItems: number;
  };
  recentDecisions: Array<{
    meetingId: string;
    meetingTitle: string;
    project: {
      id: string;
      name: string;
    };
    decision: string;
    createdAt: string;
  }>;
  recentPendingItems: Array<{
    meetingId: string;
    meetingTitle: string;
    project: {
      id: string;
      name: string;
    };
    item: string;
    createdAt: string;
  }>;
  teamRecentActivity: Array<{
    type: OrganizationDashboardActivityType;
    occurredAt: string;
    title: string;
    description: string;
    actor: {
      id: string;
      name: string;
      email: string;
    } | null;
    project: {
      id: string;
      name: string;
    } | null;
  }>;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
const CLOSED_COLUMN_KEYWORDS = ['concluido', 'concluida', 'done', 'completed', 'finalizado', 'encerrado'];

export class OrganizationsService {
  private mapMember(member: {
    id: string;
    role: OrganizationRole;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }): TeamMember {
    return {
      memberId: member.id,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      user: {
        id: member.user.id,
        name: member.user.name,
        fullName: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl
      }
    };
  }

  private assertRoleManagementPermission(input: {
    actorRole: OrganizationRole;
    targetRole: OrganizationRole;
    nextRole?: OrganizationRole;
  }): void {
    if (input.actorRole !== 'ADMIN') {
      return;
    }

    if (input.targetRole === 'OWNER') {
      throw new AppError(403, 'ADMIN não pode alterar membro OWNER.');
    }

    if (input.nextRole === 'OWNER') {
      throw new AppError(403, 'Apenas OWNER pode atribuir perfil OWNER.');
    }
  }

  private async assertNotRemovingLastOwner(
    tx: Prisma.TransactionClient,
    organizationId: string,
    targetRole: OrganizationRole,
    nextRole?: OrganizationRole
  ): Promise<void> {
    const willRemoveOwner =
      targetRole === 'OWNER' && (nextRole === undefined || nextRole !== 'OWNER');

    if (!willRemoveOwner) {
      return;
    }

    const ownerCount = await tx.organizationMember.count({
      where: {
        organizationId,
        role: 'OWNER'
      }
    });

    if (ownerCount <= 1) {
      throw new AppError(409, 'A organização precisa manter ao menos um OWNER.');
    }
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isClosedColumnTitle(title: string): boolean {
    const normalized = this.normalizeText(title);
    return CLOSED_COLUMN_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  private parseStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  async listMembers(organizationId: string): Promise<TeamMember[]> {
    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId
      },
      select: {
        id: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true
              }
            }
          },
          orderBy: [
            {
              role: 'asc'
            },
            {
              createdAt: 'asc'
            }
          ]
        }
      }
    });

    if (!organization) {
      throw new AppError(404, 'Organização não encontrada.');
    }

    return organization.members.map((member) => this.mapMember(member));
  }

  async getCurrentOrganization(organizationId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    email: string;
    members: TeamMember[];
  }> {
    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true
      }
    });

    if (!organization) {
      throw new AppError(404, 'Organização não encontrada.');
    }

    const members = await this.listMembers(organizationId);

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      email: organization.email,
      members
    };
  }

  async updateCurrentOrganization(input: {
    organizationId: string;
    actorRole: OrganizationRole;
    name?: string;
    slug?: string;
    email?: string;
  }): Promise<{
    id: string;
    name: string;
    slug: string;
    email: string;
    members: TeamMember[];
  }> {
    if (input.actorRole !== 'OWNER' && input.actorRole !== 'ADMIN') {
      throw new AppError(403, 'Sem permissão para atualizar a organização.');
    }

    const slug = input.slug === undefined ? undefined : normalizeSlug(input.slug);

    if (slug !== undefined && !slug) {
      throw new AppError(400, 'Slug da organização inválido.');
    }

    try {
      await prisma.organization.update({
        where: {
          id: input.organizationId
        },
        data: {
          name: input.name?.trim(),
          slug,
          email: input.email ? normalizeEmail(input.email) : undefined
        }
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new AppError(409, 'Slug da organização já está em uso.');
      }

      throw error;
    }

    return this.getCurrentOrganization(input.organizationId);
  }

  async getOrganizationDashboard(input: {
    organizationId: string;
    days: number;
  }): Promise<OrganizationDashboard> {
    const now = new Date();
    const periodDays = Math.max(7, Math.min(input.days, 365));
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const organization = await prisma.organization.findUnique({
      where: {
        id: input.organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true
      }
    });

    if (!organization) {
      throw new AppError(404, 'Organização não encontrada.');
    }

    const [
      projectsCount,
      recentMeetingsCount,
      cardsInOrganization,
      recentNotes,
      recentMeetings,
      recentObservations,
      recentCards,
      recentFiles,
      recentMembers
    ] = await Promise.all([
      prisma.project.count({
        where: {
          organizationId: input.organizationId
        }
      }),
      prisma.meeting.count({
        where: {
          project: {
            organizationId: input.organizationId
          },
          createdAt: {
            gte: periodStart,
            lte: now
          }
        }
      }),
      prisma.card.findMany({
        where: {
          project: {
            organizationId: input.organizationId
          }
        },
        select: {
          id: true,
          boardColumn: {
            select: {
              title: true
            }
          }
        }
      }),
      prisma.meetingNote.findMany({
        where: {
          createdAt: {
            gte: periodStart,
            lte: now
          },
          meeting: {
            project: {
              organizationId: input.organizationId
            }
          }
        },
        select: {
          createdAt: true,
          decisionsJson: true,
          pendingItemsJson: true,
          meeting: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 80
      }),
      prisma.meeting.findMany({
        where: {
          project: {
            organizationId: input.organizationId
          },
          createdAt: {
            gte: periodStart,
            lte: now
          }
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25
      }),
      prisma.meetingObservation.findMany({
        where: {
          createdAt: {
            gte: periodStart,
            lte: now
          },
          meeting: {
            project: {
              organizationId: input.organizationId
            }
          }
        },
        select: {
          id: true,
          type: true,
          content: true,
          createdAt: true,
          meeting: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          authorUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25
      }),
      prisma.card.findMany({
        where: {
          project: {
            organizationId: input.organizationId
          },
          createdAt: {
            gte: periodStart,
            lte: now
          }
        },
        select: {
          id: true,
          title: true,
          sourceType: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25
      }),
      prisma.projectFile.findMany({
        where: {
          project: {
            organizationId: input.organizationId
          },
          createdAt: {
            gte: periodStart,
            lte: now
          }
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              name: true
            }
          },
          uploadedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25
      }),
      prisma.organizationMember.findMany({
        where: {
          organizationId: input.organizationId,
          createdAt: {
            gte: periodStart,
            lte: now
          }
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25
      })
    ]);

    const openCardsCount = cardsInOrganization.filter(
      (card) => !this.isClosedColumnTitle(card.boardColumn.title)
    ).length;

    const recentDecisions: OrganizationDashboard['recentDecisions'] = [];
    const recentPendingItems: OrganizationDashboard['recentPendingItems'] = [];

    for (const note of recentNotes) {
      const decisions = this.parseStringArray(note.decisionsJson);
      const pendingItems = this.parseStringArray(note.pendingItemsJson);

      decisions.forEach((decision) => {
        recentDecisions.push({
          meetingId: note.meeting.id,
          meetingTitle: note.meeting.title,
          project: {
            id: note.meeting.project.id,
            name: note.meeting.project.name
          },
          decision,
          createdAt: note.createdAt.toISOString()
        });
      });

      pendingItems.forEach((item) => {
        recentPendingItems.push({
          meetingId: note.meeting.id,
          meetingTitle: note.meeting.title,
          project: {
            id: note.meeting.project.id,
            name: note.meeting.project.name
          },
          item,
          createdAt: note.createdAt.toISOString()
        });
      });
    }

    const activity: OrganizationDashboard['teamRecentActivity'] = [
      ...recentMeetings.map((meeting) => ({
        type: 'MEETING_CREATED' as const,
        occurredAt: meeting.createdAt.toISOString(),
        title: 'Nova reunião cadastrada',
        description: meeting.title,
        actor: meeting.createdByUser,
        project: meeting.project
      })),
      ...recentObservations.map((observation) => ({
        type: 'OBSERVATION_ADDED' as const,
        occurredAt: observation.createdAt.toISOString(),
        title: `Observação ${observation.type} registrada`,
        description: observation.content,
        actor: observation.authorUser,
        project: observation.meeting.project
      })),
      ...recentCards.map((card) => ({
        type: 'CARD_CREATED' as const,
        occurredAt: card.createdAt.toISOString(),
        title: `Card ${card.sourceType === 'AI' ? 'AI' : 'manual'} criado`,
        description: card.title,
        actor: card.createdByUser,
        project: card.project
      })),
      ...recentFiles.map((file) => ({
        type: 'FILE_UPLOADED' as const,
        occurredAt: file.createdAt.toISOString(),
        title: 'Arquivo enviado',
        description: file.name,
        actor: file.uploadedByUser,
        project: file.project
      })),
      ...recentMembers.map((member) => ({
        type: 'MEMBER_ADDED' as const,
        occurredAt: member.createdAt.toISOString(),
        title: 'Novo colaborador na organização',
        description: `${member.user.name} (${member.role})`,
        actor: member.user,
        project: null
      }))
    ]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 25);

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        email: organization.email
      },
      period: {
        days: periodDays,
        from: periodStart.toISOString(),
        to: now.toISOString()
      },
      metrics: {
        projects: projectsCount,
        recentMeetings: recentMeetingsCount,
        openCards: openCardsCount,
        recentDecisions: recentDecisions.length,
        recentPendingItems: recentPendingItems.length
      },
      recentDecisions: recentDecisions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
      recentPendingItems: recentPendingItems
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
      teamRecentActivity: activity
    };
  }

  async addMember(input: {
    organizationId: string;
    actorRole: OrganizationRole;
    fullName: string;
    email: string;
    password?: string;
    role: OrganizationRole;
  }): Promise<TeamMember> {
    this.assertRoleManagementPermission({
      actorRole: input.actorRole,
      targetRole: input.role,
      nextRole: input.role
    });

    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true }
    });

    if (!organization) {
      throw new AppError(404, 'Organização não encontrada.');
    }

    const normalizedEmail = normalizeEmail(input.email);
    const normalizedName = input.fullName.trim();

    const member = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          email: normalizedEmail
        }
      });

      if (!existingUser && !input.password) {
        throw new AppError(400, 'Senha inicial é obrigatória para novo colaborador.');
      }

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            name: normalizedName,
            email: normalizedEmail,
            passwordHash: await hashPassword(input.password as string)
          }
        }));

      const existingMembership = await tx.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: user.id
        }
      });

      if (existingMembership) {
        throw new AppError(409, 'Usuário já pertence a esta organização.');
      }

      const createdMembership = await tx.organizationMember.create({
        data: {
          organizationId: input.organizationId,
          userId: user.id,
          role: input.role
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });

      return createdMembership;
    });

    return this.mapMember(member);
  }

  async updateMemberRole(input: {
    organizationId: string;
    actorRole: OrganizationRole;
    actorMemberId: string;
    memberId: string;
    role: OrganizationRole;
  }): Promise<TeamMember> {
    const targetMember = await prisma.organizationMember.findFirst({
      where: {
        id: input.memberId,
        organizationId: input.organizationId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!targetMember) {
      throw new AppError(404, 'Membro não encontrado nesta organização.');
    }

    if (targetMember.id === input.actorMemberId && targetMember.role !== input.role) {
      throw new AppError(400, 'Não é permitido alterar o próprio papel nesta tela.');
    }

    this.assertRoleManagementPermission({
      actorRole: input.actorRole,
      targetRole: targetMember.role,
      nextRole: input.role
    });

    if (targetMember.role === input.role) {
      return this.mapMember(targetMember);
    }

    const updatedMember = await prisma.$transaction(async (tx) => {
      await this.assertNotRemovingLastOwner(tx, input.organizationId, targetMember.role, input.role);

      return tx.organizationMember.update({
        where: {
          id: targetMember.id
        },
        data: {
          role: input.role
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true
            }
          }
        }
      });
    });

    return this.mapMember(updatedMember);
  }

  async removeMember(input: {
    organizationId: string;
    actorRole: OrganizationRole;
    actorMemberId: string;
    memberId: string;
  }): Promise<void> {
    const targetMember = await prisma.organizationMember.findFirst({
      where: {
        id: input.memberId,
        organizationId: input.organizationId
      }
    });

    if (!targetMember) {
      throw new AppError(404, 'Membro não encontrado nesta organização.');
    }

    if (targetMember.id === input.actorMemberId) {
      throw new AppError(400, 'Não é permitido remover a própria conta nesta tela.');
    }

    this.assertRoleManagementPermission({
      actorRole: input.actorRole,
      targetRole: targetMember.role
    });

    await prisma.$transaction(async (tx) => {
      await this.assertNotRemovingLastOwner(tx, input.organizationId, targetMember.role);

      await tx.organizationMember.delete({
        where: {
          id: targetMember.id
        }
      });
    });
  }
}

export const organizationsService = new OrganizationsService();
