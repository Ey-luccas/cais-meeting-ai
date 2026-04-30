import type { OrganizationRole, ProjectRole } from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { aiSearchIndexService } from '../ai-search/ai-search-index.service';
import { notificationEventService } from '../notifications/notification-event.service';

const DEFAULT_BOARD_COLUMNS = ['A Fazer', 'Em Andamento', 'Em Revisão', 'Concluído'] as const;

type ProjectMetrics = {
  members: number;
  meetings: number;
  files: number;
  reports: number;
  columns: number;
  cards: number;
};

export type ProjectMemberSummary = {
  id: string;
  role: ProjectRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: ProjectMetrics;
};

export type ProjectDetail = ProjectSummary & {
  members: ProjectMemberSummary[];
  meetings: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  board: {
    id: string;
    name: string;
    createdAt: string;
    columns: Array<{
      id: string;
      title: string;
      position: number;
      cards: number;
    }>;
  } | null;
  files: Array<{
    id: string;
    name: string;
    description: string | null;
    filePath: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  reports: Array<{
    id: string;
    meetingId: string;
    meetingTitle: string;
    summary: string;
    createdAt: string;
  }>;
};

export class ProjectsService {
  private mapProjectMember(member: {
    id: string;
    role: ProjectRole;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
  }): ProjectMemberSummary {
    return {
      id: member.id,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl
      }
    };
  }

  private async assertProjectExists(organizationId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }
  }

  private async assertCanManageMembers(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    actorOrganizationRole: OrganizationRole;
  }): Promise<void> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
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

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    if (input.actorOrganizationRole === 'OWNER' || input.actorOrganizationRole === 'ADMIN') {
      return;
    }

    const actorProjectRole = project.members[0]?.role;

    if (actorProjectRole === 'OWNER' || actorProjectRole === 'ADMIN') {
      return;
    }

    throw new AppError(403, 'Sem permissão para gerenciar membros deste projeto.');
  }

  private async assertNotRemovingLastProjectOwner(
    projectId: string,
    currentRole: ProjectRole,
    nextRole?: ProjectRole
  ): Promise<void> {
    const willRemoveOwner = currentRole === 'OWNER' && (nextRole === undefined || nextRole !== 'OWNER');

    if (!willRemoveOwner) {
      return;
    }

    const ownerCount = await prisma.projectMember.count({
      where: {
        projectId,
        role: 'OWNER'
      }
    });

    if (ownerCount <= 1) {
      throw new AppError(409, 'O projeto precisa manter ao menos um membro OWNER.');
    }
  }

  private async countReports(projectId: string): Promise<number> {
    return prisma.meetingNote.count({
      where: {
        meeting: {
          projectId
        }
      }
    });
  }

  private async countBoardColumns(projectId: string): Promise<number> {
    return prisma.boardColumn.count({
      where: {
        board: {
          projectId
        }
      }
    });
  }

  private async buildMetrics(project: {
    id: string;
    _count: {
      members: number;
      meetings: number;
      files: number;
      cards: number;
    };
  }): Promise<ProjectMetrics> {
    const [reports, columns] = await Promise.all([
      this.countReports(project.id),
      this.countBoardColumns(project.id)
    ]);

    return {
      members: project._count.members,
      meetings: project._count.meetings,
      files: project._count.files,
      reports,
      columns,
      cards: project._count.cards
    };
  }

  async listProjects(organizationId: string): Promise<ProjectSummary[]> {
    const projects = await prisma.project.findMany({
      where: {
        organizationId
      },
      include: {
        _count: {
          select: {
            members: true,
            meetings: true,
            files: true,
            cards: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const metricsByProject = await Promise.all(projects.map((project) => this.buildMetrics(project)));

    return projects.map((project, index) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      metrics: metricsByProject[index]
    }));
  }

  async createProject(input: {
    organizationId: string;
    createdByUserId: string;
    name: string;
    description?: string;
    color?: string;
  }): Promise<ProjectDetail> {
    const createdProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: input.organizationId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          color: input.color || null
        }
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: input.createdByUserId,
          role: 'OWNER'
        }
      });

      let board = await tx.board.findUnique({
        where: {
          projectId: project.id
        }
      });

      if (!board) {
        board = await tx.board.create({
          data: {
            projectId: project.id,
            name: 'Board padrão'
          }
        });
      }

      await tx.boardColumn.createMany({
        data: DEFAULT_BOARD_COLUMNS.map((title, index) => ({
          boardId: board.id,
          title,
          position: index + 1
        })),
        skipDuplicates: true
      });

      return project;
    });

    await aiSearchIndexService.indexProjectById({
      organizationId: input.organizationId,
      projectId: createdProject.id
    });

    return this.getProjectById(input.organizationId, createdProject.id);
  }

  async getProjectById(organizationId: string, projectId: string): Promise<ProjectDetail> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId
      },
      include: {
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
          orderBy: {
            createdAt: 'asc'
          }
        },
        meetings: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 30
        },
        files: {
          include: {
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
          take: 30
        },
        board: {
          include: {
            columns: {
              include: {
                _count: {
                  select: {
                    cards: true
                  }
                }
              },
              orderBy: {
                position: 'asc'
              }
            }
          }
        },
        _count: {
          select: {
            members: true,
            meetings: true,
            files: true,
            cards: true
          }
        }
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    const reports = await prisma.meetingNote.findMany({
      where: {
        meeting: {
          projectId: project.id
        }
      },
      include: {
        meeting: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 30
    });

    const metrics = await this.buildMetrics(project);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      metrics,
      members: project.members.map((member) => this.mapProjectMember(member)),
      meetings: project.meetings.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        status: meeting.status,
        createdAt: meeting.createdAt.toISOString(),
        updatedAt: meeting.updatedAt.toISOString()
      })),
      board: project.board
        ? {
            id: project.board.id,
            name: project.board.name,
            createdAt: project.board.createdAt.toISOString(),
            columns: project.board.columns.map((column) => ({
              id: column.id,
              title: column.title,
              position: column.position,
              cards: column._count.cards
            }))
          }
        : null,
      files: project.files.map((file) => ({
        id: file.id,
        name: file.name,
        description: file.description,
        filePath: file.filePath,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt.toISOString(),
        uploadedBy: {
          id: file.uploadedByUser.id,
          name: file.uploadedByUser.name,
          email: file.uploadedByUser.email
        }
      })),
      reports: reports.map((report) => ({
        id: report.id,
        meetingId: report.meeting.id,
        meetingTitle: report.meeting.title,
        summary: report.summary,
        createdAt: report.createdAt.toISOString()
      }))
    };
  }

  async listProjectMembers(input: {
    organizationId: string;
    projectId: string;
  }): Promise<ProjectMemberSummary[]> {
    await this.assertProjectExists(input.organizationId, input.projectId);

    const members = await prisma.projectMember.findMany({
      where: {
        projectId: input.projectId
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
      },
      orderBy: [
        {
          role: 'asc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    return members.map((member) => this.mapProjectMember(member));
  }

  async addProjectMember(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    actorOrganizationRole: OrganizationRole;
    organizationMemberId: string;
    role: ProjectRole;
  }): Promise<ProjectMemberSummary> {
    await this.assertCanManageMembers({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorOrganizationRole: input.actorOrganizationRole
    });

    const organizationMember = await prisma.organizationMember.findFirst({
      where: {
        id: input.organizationMemberId,
        organizationId: input.organizationId
      },
      select: {
        userId: true
      }
    });

    if (!organizationMember) {
      throw new AppError(404, 'Colaborador não encontrado nesta organização.');
    }

    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: input.projectId,
          userId: organizationMember.userId
        }
      },
      select: {
        id: true
      }
    });

    if (existingMembership) {
      throw new AppError(409, 'Este colaborador já está vinculado ao projeto.');
    }

    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    const createdMembership = await prisma.projectMember.create({
      data: {
        projectId: input.projectId,
        userId: organizationMember.userId,
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

    await this.notifySafely('PROJECT_MEMBER_ADDED', () =>
      notificationEventService.notifyProjectMemberAdded({
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: createdMembership.user.id,
        role: createdMembership.role,
        projectName: project.name
      })
    );

    return this.mapProjectMember(createdMembership);
  }

  async updateProjectMemberRole(input: {
    organizationId: string;
    projectId: string;
    memberId: string;
    actorUserId: string;
    actorOrganizationRole: OrganizationRole;
    role: ProjectRole;
  }): Promise<ProjectMemberSummary> {
    await this.assertCanManageMembers({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorOrganizationRole: input.actorOrganizationRole
    });

    const targetMembership = await prisma.projectMember.findFirst({
      where: {
        id: input.memberId,
        projectId: input.projectId,
        project: {
          organizationId: input.organizationId
        }
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

    if (!targetMembership) {
      throw new AppError(404, 'Membro não encontrado neste projeto.');
    }

    if (targetMembership.role === input.role) {
      return this.mapProjectMember(targetMembership);
    }

    await this.assertNotRemovingLastProjectOwner(input.projectId, targetMembership.role, input.role);

    const updatedMembership = await prisma.projectMember.update({
      where: {
        id: targetMembership.id
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

    return this.mapProjectMember(updatedMembership);
  }

  async removeProjectMember(input: {
    organizationId: string;
    projectId: string;
    memberId: string;
    actorUserId: string;
    actorOrganizationRole: OrganizationRole;
  }): Promise<void> {
    await this.assertCanManageMembers({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorOrganizationRole: input.actorOrganizationRole
    });

    const targetMembership = await prisma.projectMember.findFirst({
      where: {
        id: input.memberId,
        projectId: input.projectId,
        project: {
          organizationId: input.organizationId
        }
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!targetMembership) {
      throw new AppError(404, 'Membro não encontrado neste projeto.');
    }

    await this.assertNotRemovingLastProjectOwner(input.projectId, targetMembership.role);

    await prisma.projectMember.delete({
      where: {
        id: targetMembership.id
      }
    });
  }

  async updateProject(input: {
    organizationId: string;
    projectId: string;
    name?: string;
    description?: string | null;
    color?: string | null;
  }): Promise<ProjectDetail> {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        name: input.name?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description
              ? input.description.trim()
              : null,
        color: input.color === undefined ? undefined : input.color || null
      }
    });

    await aiSearchIndexService.indexProjectById({
      organizationId: input.organizationId,
      projectId: project.id
    });

    return this.getProjectById(input.organizationId, project.id);
  }

  async deleteProject(organizationId: string, projectId: string): Promise<void> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }

    await aiSearchIndexService.removeProjectChunks({
      organizationId,
      projectId: project.id
    });

    await prisma.project.delete({
      where: {
        id: project.id
      }
    });
  }

  private async notifySafely(eventName: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      logger.warn('Falha ao registrar notificação de projeto.', {
        eventName,
        error: error instanceof Error ? error.message : error
      });
    }
  }
}

export const projectsService = new ProjectsService();
