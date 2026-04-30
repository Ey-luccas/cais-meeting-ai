import type {
  CardActivityType,
  CardPriority,
  CardSourceType,
  OrganizationRole,
  Prisma,
  ProjectRole
} from '@prisma/client';

import { prisma } from '../../config/prisma';
import { AppError } from '../../shared/app-error';
import { logger } from '../../shared/logger';
import { toPublicFileUrl } from '../../shared/storage';
import { aiSearchIndexService } from '../ai-search/ai-search-index.service';
import { notificationEventService } from '../notifications/notification-event.service';

const DEFAULT_BOARD_COLUMNS = ['A Fazer', 'Em Andamento', 'Em Revisão', 'Concluído'] as const;

type CardWithRelations = Prisma.CardGetPayload<{
  include: {
    createdByUser: {
      select: {
        id: true;
        name: true;
        email: true;
        avatarUrl: true;
      };
    };
    assignees: {
      include: {
        user: {
          select: {
            id: true;
            name: true;
            email: true;
            avatarUrl: true;
          };
        };
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
    checklists: {
      include: {
        items: {
          orderBy: {
            position: 'asc';
          };
        };
      };
      orderBy: {
        position: 'asc';
      };
    };
    comments: {
      include: {
        authorUser: {
          select: {
            id: true;
            name: true;
            email: true;
            avatarUrl: true;
          };
        };
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
    attachments: {
      include: {
        uploadedByUser: {
          select: {
            id: true;
            name: true;
            email: true;
            avatarUrl: true;
          };
        };
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
    links: {
      orderBy: {
        createdAt: 'asc';
      };
    };
    labels: {
      include: {
        label: true;
      };
      orderBy: {
        label: {
          name: 'asc';
        };
      };
    };
    activities: {
      include: {
        actorUser: {
          select: {
            id: true;
            name: true;
            email: true;
            avatarUrl: true;
          };
        };
      };
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

const cardInclude = {
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true
    }
  },
  assignees: {
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
      createdAt: 'asc' as const
    }
  },
  checklists: {
    include: {
      items: {
        orderBy: {
          position: 'asc' as const
        }
      }
    },
    orderBy: {
      position: 'asc' as const
    }
  },
  comments: {
    include: {
      authorUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  attachments: {
    include: {
      uploadedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  links: {
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  labels: {
    include: {
      label: true
    },
    orderBy: {
      label: {
        name: 'asc' as const
      }
    }
  },
  activities: {
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc' as const
    }
  }
};

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const hasSameMembers = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
};

export class BoardService {
  async getBoard(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    baseUrl: string;
  }): Promise<{
    project: {
      id: string;
      name: string;
      description: string | null;
      color: string | null;
    };
    board: {
      id: string;
      name: string;
      createdAt: string;
    };
    members: Array<{
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      };
      role: ProjectRole;
    }>;
    labels: Array<{
      id: string;
      name: string;
      color: string;
    }>;
    columns: Array<{
      id: string;
      title: string;
      position: number;
      cards: ReturnType<BoardService['mapCard']>[];
    }>;
  }> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'read'
    });

    const board = await this.ensureBoard(input.projectId);

    const [members, labels, columns] = await Promise.all([
      prisma.projectMember.findMany({
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
      }),
      prisma.cardLabel.findMany({
        where: {
          projectId: input.projectId
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.boardColumn.findMany({
        where: {
          boardId: board.id
        },
        include: {
          cards: {
            where: {
              projectId: input.projectId
            },
            include: cardInclude,
            orderBy: [
              {
                position: 'asc'
              }
            ]
          }
        },
        orderBy: {
          position: 'asc'
        }
      })
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color
      },
      board: {
        id: board.id,
        name: board.name,
        createdAt: board.createdAt.toISOString()
      },
      members: members.map((member) => ({
        user: {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl
        },
        role: member.role
      })),
      labels: labels.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color
      })),
      columns: columns.map((column) => ({
        id: column.id,
        title: column.title,
        position: column.position,
        cards: column.cards.map((card) => this.mapCard(card, input.baseUrl))
      }))
    };
  }

  async createColumn(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    title: string;
  }): Promise<{
    id: string;
    title: string;
    position: number;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    return prisma.$transaction(async (tx) => {
      const board = await this.ensureBoardTx(tx, input.projectId);
      const maxPosition = await tx.boardColumn.aggregate({
        where: {
          boardId: board.id
        },
        _max: {
          position: true
        }
      });

      const column = await tx.boardColumn.create({
        data: {
          boardId: board.id,
          title: input.title.trim(),
          position: (maxPosition._max.position ?? 0) + 1
        }
      });

      return {
        id: column.id,
        title: column.title,
        position: column.position
      };
    });
  }

  async updateColumn(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    columnId: string;
    title: string;
  }): Promise<{
    id: string;
    title: string;
    position: number;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const column = await prisma.boardColumn.findFirst({
      where: {
        id: input.columnId,
        board: {
          projectId: input.projectId
        }
      }
    });

    if (!column) {
      throw new AppError(404, 'Coluna não encontrada neste projeto.');
    }

    const updated = await prisma.boardColumn.update({
      where: {
        id: column.id
      },
      data: {
        title: input.title.trim()
      }
    });

    return {
      id: updated.id,
      title: updated.title,
      position: updated.position
    };
  }

  async deleteColumn(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    columnId: string;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });
    await this.assertColumnManagementAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole
    });

    await prisma.$transaction(async (tx) => {
      const column = await tx.boardColumn.findFirst({
        where: {
          id: input.columnId,
          board: {
            projectId: input.projectId
          }
        },
        include: {
          cards: {
            select: {
              id: true,
              position: true
            },
            orderBy: {
              position: 'asc'
            }
          }
        }
      });

      if (!column) {
        throw new AppError(404, 'Coluna não encontrada neste projeto.');
      }

      const columns = await tx.boardColumn.findMany({
        where: {
          boardId: column.boardId
        },
        select: {
          id: true,
          position: true,
          title: true
        },
        orderBy: {
          position: 'asc'
        }
      });

      if (columns.length <= 1) {
        throw new AppError(400, 'Não é possível remover a única coluna do quadro.');
      }

      const targetColumn =
        columns.find((entry) => entry.position > column.position) ??
        [...columns].reverse().find((entry) => entry.id !== column.id);

      if (!targetColumn) {
        throw new AppError(400, 'Não foi possível determinar coluna de destino para os cards.');
      }

      if (column.cards.length > 0) {
        const targetColumnPosition = await tx.card.aggregate({
          where: {
            boardColumnId: targetColumn.id
          },
          _max: {
            position: true
          }
        });

        await Promise.all(
          column.cards.map((card, index) =>
            tx.card.update({
              where: {
                id: card.id
              },
              data: {
                boardColumnId: targetColumn.id,
                position: (targetColumnPosition._max.position ?? 0) + index + 1
              }
            })
          )
        );

        await tx.cardActivity.createMany({
          data: column.cards.map((card) => ({
            cardId: card.id,
            actorUserId: input.userId,
            type: 'CARD_MOVED',
            metadataJson: {
              fromColumnId: column.id,
              fromColumnTitle: column.title,
              toColumnId: targetColumn.id,
              toColumnTitle: targetColumn.title,
              reason: 'COLUMN_DELETED'
            }
          }))
        });
      }

      await tx.boardColumn.delete({
        where: {
          id: column.id
        }
      });

      const remainingColumns = await tx.boardColumn.findMany({
        where: {
          boardId: column.boardId
        },
        select: {
          id: true
        },
        orderBy: {
          position: 'asc'
        }
      });

      await Promise.all(
        remainingColumns.map((entry, index) =>
          tx.boardColumn.update({
            where: { id: entry.id },
            data: { position: index + 1 }
          })
        )
      );
    });
  }

  async reorderColumns(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    orderedColumnIds: string[];
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });
    await this.assertColumnManagementAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole
    });

    const orderedColumnIds = unique(input.orderedColumnIds);

    await prisma.$transaction(async (tx) => {
      const board = await this.ensureBoardTx(tx, input.projectId);
      const columns = await tx.boardColumn.findMany({
        where: {
          boardId: board.id
        },
        select: {
          id: true
        },
        orderBy: {
          position: 'asc'
        }
      });

      if (columns.length !== orderedColumnIds.length) {
        throw new AppError(400, 'A ordenação informada não corresponde ao total de colunas.');
      }

      const knownIds = new Set(columns.map((column) => column.id));
      const allIdsAreValid = orderedColumnIds.every((id) => knownIds.has(id));

      if (!allIdsAreValid) {
        throw new AppError(400, 'Uma ou mais colunas informadas não pertencem ao projeto.');
      }

      await Promise.all(
        orderedColumnIds.map((columnId, index) =>
          tx.boardColumn.update({
            where: {
              id: columnId
            },
            data: {
              position: index + 1
            }
          })
        )
      );
    });
  }

  async createCard(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    boardColumnId: string;
    meetingId?: string;
    title: string;
    description?: string;
    sourceType?: CardSourceType;
    priority?: CardPriority | null;
    dueDate?: string | null;
    assigneeUserIds?: string[];
    labelIds?: string[];
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    await this.assertColumnInProject(input.projectId, input.boardColumnId);

    if (input.meetingId) {
      await this.assertMeetingInProject(input.projectId, input.meetingId);
    }

    const assigneeUserIds = await this.validateAssigneeUserIds(input.projectId, input.assigneeUserIds);
    const labelIds = await this.validateLabelIds(input.projectId, input.labelIds);
    const maxPosition = await prisma.card.aggregate({
      where: {
        boardColumnId: input.boardColumnId
      },
      _max: {
        position: true
      }
    });

    const card = await prisma.card.create({
      data: {
        boardColumnId: input.boardColumnId,
        projectId: input.projectId,
        meetingId: input.meetingId ?? null,
        position: (maxPosition._max.position ?? 0) + 1,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        sourceType: input.sourceType ?? 'MANUAL',
        priority: input.priority ?? null,
        dueDate: this.parseDueDate(input.dueDate),
        createdByUserId: input.userId,
        assignees: assigneeUserIds.length
          ? {
              createMany: {
                data: assigneeUserIds.map((userId) => ({ userId })),
                skipDuplicates: true
              }
            }
          : undefined,
        labels: labelIds.length
          ? {
              createMany: {
                data: labelIds.map((labelId) => ({ labelId })),
                skipDuplicates: true
              }
            }
          : undefined
      },
      include: cardInclude
    });

    await this.logCardActivity({
      cardId: card.id,
      actorUserId: input.userId,
      type: 'CARD_CREATED',
      metadataJson: {
        columnId: card.boardColumnId,
        sourceType: card.sourceType,
        priority: card.priority,
        dueDate: card.dueDate?.toISOString() ?? null
      }
    });

    if (assigneeUserIds.length > 0) {
      await this.logCardActivity({
        cardId: card.id,
        actorUserId: input.userId,
        type: 'ASSIGNEE_ADDED',
        metadataJson: {
          assigneeUserIds
        }
      });
    }

    await aiSearchIndexService.indexCardById({
      organizationId: input.organizationId,
      cardId: card.id
    });

    await this.notifySafely('CARD_CREATED', () =>
      notificationEventService.notifyCardCreated({
        organizationId: input.organizationId,
        projectId: input.projectId,
        cardId: card.id,
        cardTitle: card.title,
        projectName: project.name
      })
    );

    if (assigneeUserIds.length > 0) {
      await this.notifySafely('CARD_ASSIGNED', async () => {
        await Promise.all(
          assigneeUserIds.map((assigneeUserId) =>
            notificationEventService.notifyCardAssigned({
              organizationId: input.organizationId,
              projectId: input.projectId,
              cardId: card.id,
              cardTitle: card.title,
              projectName: project.name,
              assignedUserId: assigneeUserId
            })
          )
        );
      });
    }

    const createdCardDueDate = card.dueDate;

    if (createdCardDueDate && assigneeUserIds.length > 0) {
      await this.notifySafely('CARD_DUE_DATE_SET', () =>
        notificationEventService.notifyCardDueDateSet({
          organizationId: input.organizationId,
          projectId: input.projectId,
          cardId: card.id,
          cardTitle: card.title,
          dueDate: createdCardDueDate,
          recipientUserIds: assigneeUserIds
        })
      );
    }

    return this.mapCard(card, input.baseUrl);
  }

  async reorderCards(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
    sourceColumnId: string;
    destinationColumnId: string;
    sourceOrderedCardIds: string[];
    destinationOrderedCardIds: string[];
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const sourceOrderedCardIds = unique(input.sourceOrderedCardIds);
    const destinationOrderedCardIds = unique(input.destinationOrderedCardIds);

    if (
      sourceOrderedCardIds.length !== input.sourceOrderedCardIds.length ||
      destinationOrderedCardIds.length !== input.destinationOrderedCardIds.length
    ) {
      throw new AppError(400, 'A lista de ordenação contém IDs duplicados.');
    }

    const movedColumnsMetadata = await prisma.$transaction(async (tx) => {
      const [sourceColumn, destinationColumn] = await Promise.all([
        tx.boardColumn.findFirst({
          where: {
            id: input.sourceColumnId,
            board: {
              projectId: input.projectId
            }
          },
          select: {
            id: true,
            title: true
          }
        }),
        tx.boardColumn.findFirst({
          where: {
            id: input.destinationColumnId,
            board: {
              projectId: input.projectId
            }
          },
          select: {
            id: true,
            title: true
          }
        })
      ]);

      if (!sourceColumn || !destinationColumn) {
        throw new AppError(404, 'Coluna de origem ou destino não pertence ao projeto.');
      }

      const movedCard = await tx.card.findFirst({
        where: {
          id: input.cardId,
          projectId: input.projectId
        },
        select: {
          id: true,
          boardColumnId: true,
          position: true
        }
      });

      if (!movedCard) {
        throw new AppError(404, 'Card não encontrado no projeto.');
      }

      if (movedCard.boardColumnId !== input.sourceColumnId) {
        throw new AppError(400, 'O card informado não está na coluna de origem.');
      }

      const isSameColumn = input.sourceColumnId === input.destinationColumnId;

      if (isSameColumn) {
        const sourceCards = await tx.card.findMany({
          where: {
            projectId: input.projectId,
            boardColumnId: input.sourceColumnId
          },
          select: {
            id: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        });

        const sourceCardIds = sourceCards.map((card) => card.id);

        if (!hasSameMembers(sourceCardIds, destinationOrderedCardIds)) {
          throw new AppError(400, 'A ordenação não corresponde aos cards da coluna.');
        }

        const sourceMaxPosition = sourceCards.reduce((max, card) => Math.max(max, card.position), 0);
        const sourceOffset = sourceMaxPosition + sourceCards.length + 10;

        await tx.card.updateMany({
          where: {
            id: {
              in: sourceCardIds
            }
          },
          data: {
            position: {
              increment: sourceOffset
            }
          }
        });

        await Promise.all(
          destinationOrderedCardIds.map((cardId, index) =>
            tx.card.update({
              where: {
                id: cardId
              },
              data: {
                position: index + 1
              }
            })
          )
        );

        return null;
      }

      const [sourceCards, destinationCards] = await Promise.all([
        tx.card.findMany({
          where: {
            projectId: input.projectId,
            boardColumnId: input.sourceColumnId
          },
          select: {
            id: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        }),
        tx.card.findMany({
          where: {
            projectId: input.projectId,
            boardColumnId: input.destinationColumnId
          },
          select: {
            id: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        })
      ]);

      const sourceCardIds = sourceCards.map((card) => card.id);
      const destinationCardIds = destinationCards.map((card) => card.id);
      const expectedSourceCardIds = sourceCardIds.filter((cardId) => cardId !== input.cardId);
      const expectedDestinationCardIds = [...destinationCardIds, input.cardId];

      if (!hasSameMembers(expectedSourceCardIds, sourceOrderedCardIds)) {
        throw new AppError(400, 'A ordenação da coluna de origem não corresponde ao estado atual.');
      }

      if (!hasSameMembers(expectedDestinationCardIds, destinationOrderedCardIds)) {
        throw new AppError(400, 'A ordenação da coluna de destino não corresponde ao estado atual.');
      }

      const sourceMaxPosition = sourceCards.reduce((max, card) => Math.max(max, card.position), 0);
      const sourceOffset = sourceMaxPosition + sourceCards.length + 10;
      const destinationMaxPosition = destinationCards.reduce((max, card) => Math.max(max, card.position), 0);
      const destinationOffset = destinationMaxPosition + destinationCards.length + 10;

      if (sourceCardIds.length > 0) {
        await tx.card.updateMany({
          where: {
            id: {
              in: sourceCardIds
            }
          },
          data: {
            position: {
              increment: sourceOffset
            }
          }
        });
      }

      if (destinationCardIds.length > 0) {
        await tx.card.updateMany({
          where: {
            id: {
              in: destinationCardIds
            }
          },
          data: {
            position: {
              increment: destinationOffset
            }
          }
        });
      }

      await tx.card.update({
        where: {
          id: input.cardId
        },
        data: {
          boardColumnId: input.destinationColumnId
        }
      });

      await Promise.all(
        sourceOrderedCardIds.map((cardId, index) =>
          tx.card.update({
            where: {
              id: cardId
            },
            data: {
              boardColumnId: input.sourceColumnId,
              position: index + 1
            }
          })
        )
      );

      await Promise.all(
        destinationOrderedCardIds.map((cardId, index) =>
          tx.card.update({
            where: {
              id: cardId
            },
            data: {
              boardColumnId: input.destinationColumnId,
              position: index + 1
            }
          })
        )
      );

      await tx.cardActivity.create({
        data: {
          cardId: input.cardId,
          actorUserId: input.userId,
          type: 'CARD_MOVED',
          metadataJson: {
            fromColumnId: input.sourceColumnId,
            fromColumnTitle: sourceColumn.title,
            toColumnId: input.destinationColumnId,
            toColumnTitle: destinationColumn.title
          }
        }
      });

      return {
        fromColumnTitle: sourceColumn.title,
        toColumnTitle: destinationColumn.title
      };
    });

    if (!movedColumnsMetadata) {
      return;
    }
    const movedMetadata = movedColumnsMetadata;

    const cardNotificationContext = await prisma.card.findFirst({
      where: {
        id: input.cardId,
        projectId: input.projectId
      },
      select: {
        id: true,
        title: true,
        createdByUserId: true,
        assignees: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!cardNotificationContext) {
      return;
    }

    const recipientUserIds = unique([
      cardNotificationContext.createdByUserId,
      ...cardNotificationContext.assignees.map((entry) => entry.userId)
    ]);

    await this.notifySafely('CARD_MOVED', () =>
      notificationEventService.notifyCardMoved({
        organizationId: input.organizationId,
        projectId: input.projectId,
        cardId: cardNotificationContext.id,
        cardTitle: cardNotificationContext.title,
        fromColumnTitle: movedMetadata.fromColumnTitle,
        toColumnTitle: movedMetadata.toColumnTitle,
        recipientUserIds
      })
    );
  }

  async updateCard(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
    boardColumnId?: string;
    meetingId?: string | null;
    title?: string;
    description?: string | null;
    sourceType?: CardSourceType;
    priority?: CardPriority | null;
    dueDate?: string | null;
    assigneeUserIds?: string[];
    labelIds?: string[];
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const card = await this.getCardRecord(input.projectId, input.cardId);
    const previousCard = await prisma.card.findFirst({
      where: {
        id: card.id
      },
      select: {
        boardColumnId: true,
        dueDate: true,
        priority: true,
        title: true,
        description: true,
        assignees: {
          select: {
            userId: true
          }
        }
      }
    });

    if (input.boardColumnId) {
      await this.assertColumnInProject(input.projectId, input.boardColumnId);
    }

    if (input.meetingId) {
      await this.assertMeetingInProject(input.projectId, input.meetingId);
    }

    const assigneeUserIds =
      input.assigneeUserIds === undefined
        ? undefined
        : await this.validateAssigneeUserIds(input.projectId, input.assigneeUserIds);
    const labelIds =
      input.labelIds === undefined
        ? undefined
        : await this.validateLabelIds(input.projectId, input.labelIds);

    const updatedCard = await prisma.$transaction(async (tx) => {
      const currentCard = await tx.card.findUniqueOrThrow({
        where: {
          id: card.id
        },
        select: {
          boardColumnId: true,
          position: true
        }
      });

      const nextColumnId = input.boardColumnId ?? currentCard.boardColumnId;
      const isMovingToAnotherColumn = nextColumnId !== currentCard.boardColumnId;
      const updateData: Prisma.CardUncheckedUpdateInput = {
        boardColumnId: input.boardColumnId,
        meetingId:
          input.meetingId === undefined ? undefined : input.meetingId === null ? null : input.meetingId,
        title: input.title?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description === null
              ? null
              : input.description.trim(),
        sourceType: input.sourceType,
        priority: input.priority === undefined ? undefined : input.priority,
        dueDate:
          input.dueDate === undefined ? undefined : input.dueDate === null ? null : this.parseDueDate(input.dueDate)
      };

      if (isMovingToAnotherColumn) {
        const maxPosition = await tx.card.aggregate({
          where: {
            boardColumnId: nextColumnId
          },
          _max: {
            position: true
          }
        });

        await tx.card.update({
          where: {
            id: card.id
          },
          data: {
            ...updateData,
            boardColumnId: nextColumnId,
            position: (maxPosition._max.position ?? 0) + 1
          }
        });

        await tx.card.updateMany({
          where: {
            boardColumnId: currentCard.boardColumnId,
            position: {
              gt: currentCard.position
            }
          },
          data: {
            position: {
              decrement: 1
            }
          }
        });
      } else {
        await tx.card.update({
          where: {
            id: card.id
          },
          data: updateData
        });
      }

      if (assigneeUserIds !== undefined) {
        await tx.cardAssignee.deleteMany({
          where: {
            cardId: card.id
          }
        });

        if (assigneeUserIds.length > 0) {
          await tx.cardAssignee.createMany({
            data: assigneeUserIds.map((userId) => ({
              cardId: card.id,
              userId
            })),
            skipDuplicates: true
          });
        }
      }

      if (labelIds !== undefined) {
        await tx.cardLabelRelation.deleteMany({
          where: {
            cardId: card.id
          }
        });

        if (labelIds.length > 0) {
          await tx.cardLabelRelation.createMany({
            data: labelIds.map((labelId) => ({
              cardId: card.id,
              labelId
            })),
            skipDuplicates: true
          });
        }
      }

      return tx.card.findUniqueOrThrow({
        where: {
          id: card.id
        },
        include: cardInclude
      });
    });

    await aiSearchIndexService.indexCardById({
      organizationId: input.organizationId,
      cardId: updatedCard.id
    });

    if (previousCard) {
      if (previousCard.boardColumnId !== updatedCard.boardColumnId) {
        const movedColumns = await prisma.boardColumn.findMany({
          where: {
            id: {
              in: unique([previousCard.boardColumnId, updatedCard.boardColumnId])
            }
          },
          select: {
            id: true,
            title: true
          }
        });
        const movedColumnsById = new Map(movedColumns.map((column) => [column.id, column.title]));
        const fromColumnTitle = movedColumnsById.get(previousCard.boardColumnId) ?? 'Coluna anterior';
        const toColumnTitle = movedColumnsById.get(updatedCard.boardColumnId) ?? 'Nova coluna';

        await this.logCardActivity({
          cardId: updatedCard.id,
          actorUserId: input.userId,
          type: 'CARD_MOVED',
          metadataJson: {
            fromColumnId: previousCard.boardColumnId,
            fromColumnTitle,
            toColumnId: updatedCard.boardColumnId,
            toColumnTitle
          }
        });

        const recipientUserIds = unique([
          updatedCard.createdByUser.id,
          ...updatedCard.assignees.map((entry) => entry.user.id)
        ]);

        await this.notifySafely('CARD_MOVED', () =>
          notificationEventService.notifyCardMoved({
            organizationId: input.organizationId,
            projectId: input.projectId,
            cardId: updatedCard.id,
            cardTitle: updatedCard.title,
            fromColumnTitle,
            toColumnTitle,
            recipientUserIds
          })
        );
      }

      if (previousCard.priority !== updatedCard.priority) {
        await this.logCardActivity({
          cardId: updatedCard.id,
          actorUserId: input.userId,
          type: 'PRIORITY_UPDATED',
          metadataJson: {
            previous: previousCard.priority,
            current: updatedCard.priority
          }
        });
      }

      const previousDueDate = previousCard.dueDate?.toISOString() ?? null;
      const currentDueDate = updatedCard.dueDate?.toISOString() ?? null;
      const currentAssigneeIds = updatedCard.assignees.map((entry) => entry.user.id);

      if (previousDueDate !== currentDueDate) {
        await this.logCardActivity({
          cardId: updatedCard.id,
          actorUserId: input.userId,
          type: 'DUE_DATE_UPDATED',
          metadataJson: {
            previous: previousDueDate,
            current: currentDueDate
          }
        });

        const updatedCardDueDate = updatedCard.dueDate;

        if (updatedCardDueDate && currentAssigneeIds.length > 0) {
          await this.notifySafely('CARD_DUE_DATE_SET', () =>
            notificationEventService.notifyCardDueDateSet({
              organizationId: input.organizationId,
              projectId: input.projectId,
              cardId: updatedCard.id,
              cardTitle: updatedCard.title,
              dueDate: updatedCardDueDate,
              recipientUserIds: currentAssigneeIds
            })
          );
        }
      }

      const previousAssigneeIds = previousCard.assignees.map((entry) => entry.userId);
      const addedAssigneeIds = currentAssigneeIds.filter((id) => !previousAssigneeIds.includes(id));
      const removedAssigneeIds = previousAssigneeIds.filter((id) => !currentAssigneeIds.includes(id));

      if (addedAssigneeIds.length > 0) {
        await this.logCardActivity({
          cardId: updatedCard.id,
          actorUserId: input.userId,
          type: 'ASSIGNEE_ADDED',
          metadataJson: {
            assigneeUserIds: addedAssigneeIds
          }
        });

        await this.notifySafely('CARD_ASSIGNED', async () => {
          await Promise.all(
            addedAssigneeIds.map((assigneeUserId) =>
              notificationEventService.notifyCardAssigned({
                organizationId: input.organizationId,
                projectId: input.projectId,
                cardId: updatedCard.id,
                cardTitle: updatedCard.title,
                projectName: project.name,
                assignedUserId: assigneeUserId
              })
            )
          );
        });
      }

      if (removedAssigneeIds.length > 0) {
        await this.logCardActivity({
          cardId: updatedCard.id,
          actorUserId: input.userId,
          type: 'ASSIGNEE_REMOVED',
          metadataJson: {
            assigneeUserIds: removedAssigneeIds
          }
        });
      }

      if (
        previousCard.title !== updatedCard.title ||
        (previousCard.description ?? null) !== (updatedCard.description ?? null)
      ) {
        await this.logCardActivity({
          cardId: updatedCard.id,
          actorUserId: input.userId,
          type: 'CARD_UPDATED',
          metadataJson: {
            fields: {
              titleChanged: previousCard.title !== updatedCard.title,
              descriptionChanged: (previousCard.description ?? null) !== (updatedCard.description ?? null)
            }
          }
        });
      }
    }

    return this.mapCard(updatedCard, input.baseUrl);
  }

  async deleteCard(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const card = await this.getCardRecord(input.projectId, input.cardId);

    await aiSearchIndexService.removeCardChunks({
      organizationId: input.organizationId,
      cardId: card.id
    });

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.card.deleteMany({
        where: {
          id: card.id,
          projectId: input.projectId
        }
      });

      if (deleted.count === 0) {
        throw new AppError(404, 'Card não encontrado.');
      }

      await tx.card.updateMany({
        where: {
          projectId: input.projectId,
          boardColumnId: card.boardColumnId,
          position: {
            gt: card.position
          }
        },
        data: {
          position: {
            decrement: 1
          }
        }
      });
    });
  }

  async updateCardById(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    boardColumnId?: string;
    meetingId?: string | null;
    title?: string;
    description?: string | null;
    sourceType?: CardSourceType;
    priority?: CardPriority | null;
    dueDate?: string | null;
    assigneeUserIds?: string[];
    labelIds?: string[];
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    return this.updateCard({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      cardId: card.id,
      boardColumnId: input.boardColumnId,
      meetingId: input.meetingId,
      title: input.title,
      description: input.description,
      sourceType: input.sourceType,
      priority: input.priority,
      dueDate: input.dueDate,
      assigneeUserIds: input.assigneeUserIds,
      labelIds: input.labelIds,
      baseUrl: input.baseUrl
    });
  }

  async deleteCardById(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<void> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    await this.deleteCard({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      cardId: card.id
    });
  }

  async addChecklist(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
    title: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const card = await this.getCardRecord(input.projectId, input.cardId);

    await prisma.$transaction(async (tx) => {
      const maxPosition = await tx.cardChecklist.aggregate({
        where: {
          cardId: card.id
        },
        _max: {
          position: true
        }
      });

      await tx.cardChecklist.create({
        data: {
          cardId: card.id,
          title: input.title.trim(),
          position: (maxPosition._max.position ?? 0) + 1
        }
      });
    });

    await this.logCardActivity({
      cardId: card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_CREATED',
      metadataJson: {
        title: input.title.trim()
      }
    });

    return this.getCardView(input.projectId, input.cardId, input.baseUrl);
  }

  async addChecklistByCardId(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    title: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    return this.addChecklist({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      cardId: card.id,
      title: input.title,
      baseUrl: input.baseUrl
    });
  }

  async updateChecklist(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    checklistId: string;
    title: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const checklist = await prisma.cardChecklist.findFirst({
      where: {
        id: input.checklistId,
        card: {
          projectId: input.projectId
        }
      },
      include: {
        card: {
          select: {
            id: true
          }
        }
      }
    });

    if (!checklist) {
      throw new AppError(404, 'Checklist não encontrado neste projeto.');
    }

    await prisma.cardChecklist.update({
      where: {
        id: checklist.id
      },
      data: {
        title: input.title.trim()
      }
    });

    await this.logCardActivity({
      cardId: checklist.card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_UPDATED',
      metadataJson: {
        checklistId: checklist.id
      }
    });

    return this.getCardView(input.projectId, checklist.card.id, input.baseUrl);
  }

  async removeChecklist(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    checklistId: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const checklist = await prisma.cardChecklist.findFirst({
      where: {
        id: input.checklistId,
        card: {
          projectId: input.projectId
        }
      },
      include: {
        card: {
          select: {
            id: true
          }
        }
      }
    });

    if (!checklist) {
      throw new AppError(404, 'Checklist não encontrado neste projeto.');
    }

    await prisma.cardChecklist.delete({
      where: {
        id: checklist.id
      }
    });

    await this.logCardActivity({
      cardId: checklist.card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_REMOVED',
      metadataJson: {
        checklistId: checklist.id
      }
    });

    return this.getCardView(input.projectId, checklist.card.id, input.baseUrl);
  }

  async addChecklistItem(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    checklistId: string;
    content: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const checklist = await prisma.cardChecklist.findUnique({
      where: {
        id: input.checklistId
      },
      include: {
        card: {
          select: {
            id: true,
            projectId: true
          }
        }
      }
    });

    if (!checklist || checklist.card.projectId !== input.projectId) {
      throw new AppError(404, 'Checklist não encontrado neste projeto.');
    }

    await prisma.$transaction(async (tx) => {
      const maxPosition = await tx.cardChecklistItem.aggregate({
        where: {
          checklistId: checklist.id
        },
        _max: {
          position: true
        }
      });

      await tx.cardChecklistItem.create({
        data: {
          checklistId: checklist.id,
          content: input.content.trim(),
          position: (maxPosition._max.position ?? 0) + 1
        }
      });
    });

    await this.logCardActivity({
      cardId: checklist.card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_ITEM_CREATED',
      metadataJson: {
        checklistId: checklist.id
      }
    });

    return this.getCardView(input.projectId, checklist.card.id, input.baseUrl);
  }

  async reorderChecklistItems(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    checklistId: string;
    orderedItemIds: string[];
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const orderedItemIds = unique(input.orderedItemIds);

    if (orderedItemIds.length !== input.orderedItemIds.length) {
      throw new AppError(400, 'A lista de itens contém IDs duplicados.');
    }

    const checklist = await prisma.cardChecklist.findFirst({
      where: {
        id: input.checklistId,
        card: {
          projectId: input.projectId
        }
      },
      include: {
        card: {
          select: {
            id: true
          }
        },
        items: {
          select: {
            id: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!checklist) {
      throw new AppError(404, 'Checklist não encontrado neste projeto.');
    }

    const existingItemIds = checklist.items.map((item) => item.id);

    if (!hasSameMembers(existingItemIds, orderedItemIds)) {
      throw new AppError(400, 'A ordenação informada não corresponde aos itens do checklist.');
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        orderedItemIds.map((itemId, index) =>
          tx.cardChecklistItem.update({
            where: {
              id: itemId
            },
            data: {
              position: index + 1
            }
          })
        )
      );

      await tx.cardActivity.create({
        data: {
          cardId: checklist.card.id,
          actorUserId: input.userId,
          type: 'CHECKLIST_ITEM_UPDATED',
          metadataJson: {
            checklistId: checklist.id,
            action: 'REORDER'
          }
        }
      });
    });

    return this.getCardView(input.projectId, checklist.card.id, input.baseUrl);
  }

  async updateChecklistItem(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    itemId: string;
    isCompleted?: boolean;
    content?: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const item = await prisma.cardChecklistItem.findUnique({
      where: {
        id: input.itemId
      },
      include: {
        checklist: {
          include: {
            card: {
              select: {
                id: true,
                projectId: true
              }
            }
          }
        }
      }
    });

    if (!item || item.checklist.card.projectId !== input.projectId) {
      throw new AppError(404, 'Item de checklist não encontrado neste projeto.');
    }

    await prisma.cardChecklistItem.update({
      where: {
        id: item.id
      },
      data: {
        isCompleted: input.isCompleted,
        content: input.content?.trim()
      }
    });

    await this.logCardActivity({
      cardId: item.checklist.card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_ITEM_UPDATED',
      metadataJson: {
        checklistItemId: item.id
      }
    });

    return this.getCardView(input.projectId, item.checklist.card.id, input.baseUrl);
  }

  async toggleChecklistItemById(input: {
    organizationId: string;
    itemId: string;
    userId: string;
    organizationRole: OrganizationRole;
    isCompleted?: boolean;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const item = await prisma.cardChecklistItem.findFirst({
      where: {
        id: input.itemId,
        checklist: {
          card: {
            project: {
              organizationId: input.organizationId
            }
          }
        }
      },
      include: {
        checklist: {
          include: {
            card: {
              select: {
                id: true,
                projectId: true
              }
            }
          }
        }
      }
    });

    if (!item) {
      throw new AppError(404, 'Item de checklist não encontrado.');
    }

    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: item.checklist.card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    await prisma.cardChecklistItem.update({
      where: {
        id: item.id
      },
      data: {
        isCompleted: input.isCompleted ?? !item.isCompleted
      }
    });

    await this.logCardActivity({
      cardId: item.checklist.card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_ITEM_TOGGLED',
      metadataJson: {
        checklistItemId: item.id,
        isCompleted: input.isCompleted ?? !item.isCompleted
      }
    });

    return this.getCardView(item.checklist.card.projectId, item.checklist.card.id, input.baseUrl);
  }

  async removeChecklistItem(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    itemId: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const item = await prisma.cardChecklistItem.findUnique({
      where: {
        id: input.itemId
      },
      include: {
        checklist: {
          include: {
            card: {
              select: {
                id: true,
                projectId: true
              }
            }
          }
        }
      }
    });

    if (!item || item.checklist.card.projectId !== input.projectId) {
      throw new AppError(404, 'Item de checklist não encontrado neste projeto.');
    }

    await prisma.cardChecklistItem.delete({
      where: {
        id: item.id
      }
    });

    await this.logCardActivity({
      cardId: item.checklist.card.id,
      actorUserId: input.userId,
      type: 'CHECKLIST_ITEM_REMOVED',
      metadataJson: {
        checklistItemId: item.id
      }
    });

    return this.getCardView(input.projectId, item.checklist.card.id, input.baseUrl);
  }

  async addComment(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
    content: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const card = await this.getCardRecord(input.projectId, input.cardId);
    const commentNotificationContext = await prisma.card.findFirst({
      where: {
        id: card.id,
        projectId: input.projectId
      },
      select: {
        id: true,
        title: true,
        createdByUserId: true,
        assignees: {
          select: {
            userId: true
          }
        }
      }
    });

    const comment = await prisma.cardComment.create({
      data: {
        cardId: card.id,
        authorUserId: input.userId,
        content: input.content.trim()
      }
    });

    await Promise.all([
      aiSearchIndexService.indexCardById({
        organizationId: input.organizationId,
        cardId: card.id
      }),
      aiSearchIndexService.indexCardCommentById({
        organizationId: input.organizationId,
        commentId: comment.id
      })
    ]);

    await this.logCardActivity({
      cardId: card.id,
      actorUserId: input.userId,
      type: 'COMMENT_ADDED',
      metadataJson: {
        commentId: comment.id
      }
    });

    if (commentNotificationContext) {
      const actorUser = await prisma.user.findUnique({
        where: {
          id: input.userId
        },
        select: {
          name: true
        }
      });

      const recipientUserIds = unique([
        commentNotificationContext.createdByUserId,
        ...commentNotificationContext.assignees.map((entry) => entry.userId)
      ]).filter((userId) => userId !== input.userId);

      if (recipientUserIds.length > 0) {
        await this.notifySafely('CARD_COMMENTED', () =>
          notificationEventService.notifyCardCommented({
            organizationId: input.organizationId,
            projectId: input.projectId,
            cardId: commentNotificationContext.id,
            cardTitle: commentNotificationContext.title,
            actorName: actorUser?.name ?? 'Um membro da equipe',
            recipientUserIds
          })
        );
      }
    }

    return this.getCardView(input.projectId, card.id, input.baseUrl);
  }

  async addCommentByCardId(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    content: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    return this.addComment({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      cardId: card.id,
      content: input.content,
      baseUrl: input.baseUrl
    });
  }

  async addLink(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
    title: string;
    url: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const card = await this.getCardRecord(input.projectId, input.cardId);

    const link = await prisma.cardLink.create({
      data: {
        cardId: card.id,
        title: input.title.trim(),
        url: input.url.trim()
      }
    });

    await this.logCardActivity({
      cardId: card.id,
      actorUserId: input.userId,
      type: 'LINK_ADDED',
      metadataJson: {
        linkId: link.id
      }
    });

    return this.getCardView(input.projectId, card.id, input.baseUrl);
  }

  async addLinkByCardId(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    title: string;
    url: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    return this.addLink({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      cardId: card.id,
      title: input.title,
      url: input.url,
      baseUrl: input.baseUrl
    });
  }

  async updateLink(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    linkId: string;
    title: string;
    url: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const link = await prisma.cardLink.findFirst({
      where: {
        id: input.linkId,
        card: {
          projectId: input.projectId
        }
      },
      include: {
        card: {
          select: {
            id: true
          }
        }
      }
    });

    if (!link) {
      throw new AppError(404, 'Link não encontrado neste projeto.');
    }

    await prisma.cardLink.update({
      where: {
        id: link.id
      },
      data: {
        title: input.title.trim(),
        url: input.url.trim()
      }
    });

    await this.logCardActivity({
      cardId: link.card.id,
      actorUserId: input.userId,
      type: 'LINK_UPDATED',
      metadataJson: {
        linkId: link.id
      }
    });

    return this.getCardView(input.projectId, link.card.id, input.baseUrl);
  }

  async removeLink(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    linkId: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const link = await prisma.cardLink.findFirst({
      where: {
        id: input.linkId,
        card: {
          projectId: input.projectId
        }
      },
      include: {
        card: {
          select: {
            id: true
          }
        }
      }
    });

    if (!link) {
      throw new AppError(404, 'Link não encontrado neste projeto.');
    }

    await prisma.cardLink.delete({
      where: {
        id: link.id
      }
    });

    await this.logCardActivity({
      cardId: link.card.id,
      actorUserId: input.userId,
      type: 'LINK_REMOVED',
      metadataJson: {
        linkId: link.id
      }
    });

    return this.getCardView(input.projectId, link.card.id, input.baseUrl);
  }

  async addAttachment(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    cardId: string;
    name: string;
    filePath: string;
    mimeType?: string;
    sizeBytes?: number;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const card = await this.getCardRecord(input.projectId, input.cardId);

    const createdAttachment = await prisma.$transaction(async (tx) => {
      const projectFile = await tx.projectFile.create({
        data: {
          projectId: input.projectId,
          uploadedByUserId: input.userId,
          name: input.name,
          filePath: input.filePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes
        },
        select: {
          id: true
        }
      });

      return tx.cardAttachment.create({
        data: {
          cardId: card.id,
          uploadedByUserId: input.userId,
          projectFileId: projectFile.id,
          name: input.name,
          filePath: input.filePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes
        },
        select: {
          id: true
        }
      });
    });

    await this.logCardActivity({
      cardId: card.id,
      actorUserId: input.userId,
      type: 'ATTACHMENT_ADDED',
      metadataJson: {
        attachmentId: createdAttachment.id
      }
    });

    return this.getCardView(input.projectId, card.id, input.baseUrl);
  }

  async addAttachmentByCardId(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    name: string;
    filePath: string;
    mimeType?: string;
    sizeBytes?: number;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    return this.addAttachment({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      cardId: card.id,
      name: input.name,
      filePath: input.filePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      baseUrl: input.baseUrl
    });
  }

  async removeAttachment(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    attachmentId: string;
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const attachment = await prisma.cardAttachment.findFirst({
      where: {
        id: input.attachmentId,
        card: {
          projectId: input.projectId
        }
      },
      include: {
        card: {
          select: {
            id: true
          }
        }
      }
    });

    if (!attachment) {
      throw new AppError(404, 'Anexo não encontrado neste projeto.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.cardAttachment.delete({
        where: {
          id: attachment.id
        }
      });

      if (attachment.projectFileId) {
        await tx.projectFile.deleteMany({
          where: {
            id: attachment.projectFileId,
            projectId: input.projectId
          }
        });
      }
    });

    await this.logCardActivity({
      cardId: attachment.card.id,
      actorUserId: input.userId,
      type: 'ATTACHMENT_REMOVED',
      metadataJson: {
        attachmentId: attachment.id
      }
    });

    return this.getCardView(input.projectId, attachment.card.id, input.baseUrl);
  }

  async addAssigneesByCardId(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    assigneeUserIds: string[];
    mode?: 'append' | 'replace';
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    const project = await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const cardNotificationContext = await prisma.card.findFirst({
      where: {
        id: card.id,
        projectId: card.projectId
      },
      select: {
        id: true,
        title: true
      }
    });

    const assigneeUserIds = await this.validateAssigneeUserIds(card.projectId, input.assigneeUserIds);
    const existingAssignees = await prisma.cardAssignee.findMany({
      where: {
        cardId: card.id
      },
      select: {
        userId: true
      }
    });
    const previousAssigneeIds = existingAssignees.map((entry) => entry.userId);

    await prisma.$transaction(async (tx) => {
      if (input.mode === 'replace') {
        await tx.cardAssignee.deleteMany({
          where: {
            cardId: card.id
          }
        });
      }

      if (assigneeUserIds.length > 0) {
        await tx.cardAssignee.createMany({
          data: assigneeUserIds.map((assigneeUserId) => ({
            cardId: card.id,
            userId: assigneeUserId
          })),
          skipDuplicates: true
        });
      }
    });

    const nextAssigneeIds = input.mode === 'replace'
      ? unique(assigneeUserIds)
      : unique([...previousAssigneeIds, ...assigneeUserIds]);

    const addedAssigneeIds = nextAssigneeIds.filter((id) => !previousAssigneeIds.includes(id));
    const removedAssigneeIds = previousAssigneeIds.filter((id) => !nextAssigneeIds.includes(id));

    if (addedAssigneeIds.length > 0) {
      await this.logCardActivity({
        cardId: card.id,
        actorUserId: input.userId,
        type: 'ASSIGNEE_ADDED',
        metadataJson: {
          assigneeUserIds: addedAssigneeIds
        }
      });

      if (cardNotificationContext) {
        await this.notifySafely('CARD_ASSIGNED', async () => {
          await Promise.all(
            addedAssigneeIds.map((assigneeUserId) =>
              notificationEventService.notifyCardAssigned({
                organizationId: input.organizationId,
                projectId: card.projectId,
                cardId: cardNotificationContext.id,
                cardTitle: cardNotificationContext.title,
                projectName: project.name,
                assignedUserId: assigneeUserId
              })
            )
          );
        });
      }
    }

    if (removedAssigneeIds.length > 0) {
      await this.logCardActivity({
        cardId: card.id,
        actorUserId: input.userId,
        type: 'ASSIGNEE_REMOVED',
        metadataJson: {
          assigneeUserIds: removedAssigneeIds
        }
      });
    }

    await aiSearchIndexService.indexCardById({
      organizationId: input.organizationId,
      cardId: card.id
    });

    return this.getCardView(card.projectId, card.id, input.baseUrl);
  }

  async addLabelsByCardId(input: {
    organizationId: string;
    cardId: string;
    userId: string;
    organizationRole: OrganizationRole;
    labelIds: string[];
    mode?: 'append' | 'replace';
    baseUrl: string;
  }): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await this.getCardScope(input.organizationId, input.cardId);

    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: card.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const labelIds = await this.validateLabelIds(card.projectId, input.labelIds);

    await prisma.$transaction(async (tx) => {
      if (input.mode === 'replace') {
        await tx.cardLabelRelation.deleteMany({
          where: {
            cardId: card.id
          }
        });
      }

      if (labelIds.length > 0) {
        await tx.cardLabelRelation.createMany({
          data: labelIds.map((labelId) => ({
            cardId: card.id,
            labelId
          })),
          skipDuplicates: true
        });
      }
    });

    await aiSearchIndexService.indexCardById({
      organizationId: input.organizationId,
      cardId: card.id
    });

    return this.getCardView(card.projectId, card.id, input.baseUrl);
  }

  async createLabel(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    name: string;
    color: string;
  }): Promise<{
    id: string;
    name: string;
    color: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    try {
      const label = await prisma.cardLabel.create({
        data: {
          projectId: input.projectId,
          name: input.name.trim(),
          color: input.color.trim()
        }
      });

      return {
        id: label.id,
        name: label.name,
        color: label.color
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new AppError(409, 'Já existe uma etiqueta com este nome no projeto.');
      }

      throw error;
    }
  }

  async updateLabel(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    labelId: string;
    name: string;
    color: string;
  }): Promise<{
    id: string;
    name: string;
    color: string;
  }> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const existing = await prisma.cardLabel.findFirst({
      where: {
        id: input.labelId,
        projectId: input.projectId
      }
    });

    if (!existing) {
      throw new AppError(404, 'Etiqueta não encontrada neste projeto.');
    }

    try {
      const updated = await prisma.cardLabel.update({
        where: {
          id: existing.id
        },
        data: {
          name: input.name.trim(),
          color: input.color.trim()
        }
      });

      const relatedCards = await prisma.cardLabelRelation.findMany({
        where: {
          labelId: updated.id
        },
        select: {
          cardId: true
        }
      });

      if (relatedCards.length > 0) {
        await prisma.cardActivity.createMany({
          data: relatedCards.map((relation) => ({
            cardId: relation.cardId,
            actorUserId: input.userId,
            type: 'LABEL_UPDATED',
            metadataJson: {
              labelId: updated.id
            }
          }))
        });
      }

      return {
        id: updated.id,
        name: updated.name,
        color: updated.color
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new AppError(409, 'Já existe uma etiqueta com este nome no projeto.');
      }

      throw error;
    }
  }

  async deleteLabel(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    labelId: string;
  }): Promise<void> {
    await this.assertProjectAccess({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      organizationRole: input.organizationRole,
      requiredAccess: 'write'
    });

    const label = await prisma.cardLabel.findFirst({
      where: {
        id: input.labelId,
        projectId: input.projectId
      },
      include: {
        cards: {
          select: {
            cardId: true
          }
        }
      }
    });

    if (!label) {
      throw new AppError(404, 'Etiqueta não encontrada neste projeto.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.cardLabel.delete({
        where: {
          id: label.id
        }
      });

      if (label.cards.length > 0) {
        await tx.cardActivity.createMany({
          data: label.cards.map((relation) => ({
            cardId: relation.cardId,
            actorUserId: input.userId,
            type: 'LABEL_REMOVED',
            metadataJson: {
              labelId: label.id
            }
          }))
        });
      }
    });
  }

  private async getCardView(
    projectId: string,
    cardId: string,
    baseUrl: string
  ): Promise<ReturnType<BoardService['mapCard']>> {
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        projectId
      },
      include: cardInclude
    });

    if (!card) {
      throw new AppError(404, 'Card não encontrado.');
    }

    return this.mapCard(card, baseUrl);
  }

  private async getCardScope(
    organizationId: string,
    cardId: string
  ): Promise<{ id: string; projectId: string }> {
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        project: {
          organizationId
        }
      },
      select: {
        id: true,
        projectId: true
      }
    });

    if (!card) {
      throw new AppError(404, 'Card não encontrado.');
    }

    return card;
  }

  private async getCardRecord(
    projectId: string,
    cardId: string
  ): Promise<{ id: string; boardColumnId: string; position: number }> {
    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        projectId
      },
      select: {
        id: true,
        boardColumnId: true,
        position: true
      }
    });

    if (!card) {
      throw new AppError(404, 'Card não encontrado neste projeto.');
    }

    return card;
  }

  private async assertColumnInProject(projectId: string, boardColumnId: string): Promise<void> {
    const column = await prisma.boardColumn.findFirst({
      where: {
        id: boardColumnId,
        board: {
          projectId
        }
      },
      select: {
        id: true
      }
    });

    if (!column) {
      throw new AppError(404, 'Coluna não encontrada neste projeto.');
    }
  }

  private async assertMeetingInProject(projectId: string, meetingId: string): Promise<void> {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        projectId
      },
      select: {
        id: true
      }
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião de origem não encontrada neste projeto.');
    }
  }

  private async validateAssigneeUserIds(projectId: string, assigneeUserIds?: string[]): Promise<string[]> {
    if (!assigneeUserIds || assigneeUserIds.length === 0) {
      return [];
    }

    const uniqueIds = unique(assigneeUserIds);

    const members = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: {
          in: uniqueIds
        }
      },
      select: {
        userId: true
      }
    });

    if (members.length !== uniqueIds.length) {
      throw new AppError(400, 'Um ou mais responsáveis não pertencem ao projeto.');
    }

    return uniqueIds;
  }

  private async validateLabelIds(projectId: string, labelIds?: string[]): Promise<string[]> {
    if (!labelIds || labelIds.length === 0) {
      return [];
    }

    const uniqueIds = unique(labelIds);

    const labels = await prisma.cardLabel.findMany({
      where: {
        projectId,
        id: {
          in: uniqueIds
        }
      },
      select: {
        id: true
      }
    });

    if (labels.length !== uniqueIds.length) {
      throw new AppError(400, 'Uma ou mais etiquetas não pertencem ao projeto.');
    }

    return uniqueIds;
  }

  private parseDueDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, 'Data limite inválida.');
    }

    return parsed;
  }

  private async ensureBoard(projectId: string): Promise<{ id: string; name: string; createdAt: Date }> {
    return prisma.$transaction((tx) => this.ensureBoardTx(tx, projectId));
  }

  private async ensureBoardTx(
    tx: Prisma.TransactionClient,
    projectId: string
  ): Promise<{ id: string; name: string; createdAt: Date }> {
    let board = await tx.board.findUnique({
      where: {
        projectId
      },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    if (!board) {
      board = await tx.board.create({
        data: {
          projectId,
          name: 'Board padrão'
        },
        select: {
          id: true,
          name: true,
          createdAt: true
        }
      });
    }

    const columnsCount = await tx.boardColumn.count({
      where: {
        boardId: board.id
      }
    });

    if (columnsCount === 0) {
      await tx.boardColumn.createMany({
        data: DEFAULT_BOARD_COLUMNS.map((title, index) => ({
          boardId: board.id,
          title,
          position: index + 1
        })),
        skipDuplicates: true
      });
    }

    return board;
  }

  private async assertProjectAccess(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
    requiredAccess: 'read' | 'write';
  }): Promise<{
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  }> {
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

    if (input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN') {
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color
      };
    }

    const projectRole = project.members[0]?.role;

    if (!projectRole) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    if (input.requiredAccess === 'write' && projectRole === 'VIEWER') {
      throw new AppError(403, 'Perfil VIEWER não pode alterar o board.');
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color
    };
  }

  private async assertColumnManagementAccess(input: {
    organizationId: string;
    projectId: string;
    userId: string;
    organizationRole: OrganizationRole;
  }): Promise<void> {
    if (input.organizationRole === 'OWNER' || input.organizationRole === 'ADMIN') {
      return;
    }

    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        project: {
          organizationId: input.organizationId
        }
      },
      select: {
        role: true
      }
    });

    if (!membership) {
      throw new AppError(403, 'Você não tem acesso a este projeto.');
    }

    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new AppError(403, 'Apenas ADMIN ou OWNER podem reordenar ou remover colunas.');
    }
  }

  private async notifySafely(eventName: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      logger.warn('Falha ao registrar notificação de board.', {
        eventName,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async logCardActivity(input: {
    cardId: string;
    actorUserId: string;
    type: CardActivityType;
    metadataJson?: Prisma.InputJsonValue;
  }): Promise<void> {
    await prisma.cardActivity.create({
      data: {
        cardId: input.cardId,
        actorUserId: input.actorUserId,
        type: input.type,
        metadataJson: input.metadataJson
      }
    });
  }

  private mapCard(card: CardWithRelations, baseUrl: string) {
    return {
      id: card.id,
      boardColumnId: card.boardColumnId,
      projectId: card.projectId,
      meetingId: card.meetingId,
      position: card.position,
      sourceType: card.sourceType,
      title: card.title,
      description: card.description,
      priority: card.priority,
      dueDate: card.dueDate?.toISOString() ?? null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      createdBy: {
        id: card.createdByUser.id,
        name: card.createdByUser.name,
        email: card.createdByUser.email,
        avatarUrl: card.createdByUser.avatarUrl
      },
      assignees: card.assignees.map((assignee) => ({
        id: assignee.id,
        user: {
          id: assignee.user.id,
          name: assignee.user.name,
          email: assignee.user.email,
          avatarUrl: assignee.user.avatarUrl
        }
      })),
      checklists: card.checklists.map((checklist) => ({
        id: checklist.id,
        title: checklist.title,
        position: checklist.position,
        createdAt: checklist.createdAt.toISOString(),
        updatedAt: checklist.updatedAt.toISOString(),
        items: checklist.items.map((item) => ({
          id: item.id,
          content: item.content,
          isCompleted: item.isCompleted,
          position: item.position,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString()
        }))
      })),
      comments: card.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        author: {
          id: comment.authorUser.id,
          name: comment.authorUser.name,
          email: comment.authorUser.email,
          avatarUrl: comment.authorUser.avatarUrl
        }
      })),
      attachments: card.attachments.map((attachment) => ({
        id: attachment.id,
        projectFileId: attachment.projectFileId,
        name: attachment.name,
        filePath: attachment.filePath,
        fileUrl: toPublicFileUrl(baseUrl, attachment.filePath),
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        createdAt: attachment.createdAt.toISOString(),
        uploadedBy: {
          id: attachment.uploadedByUser.id,
          name: attachment.uploadedByUser.name,
          email: attachment.uploadedByUser.email,
          avatarUrl: attachment.uploadedByUser.avatarUrl
        }
      })),
      links: card.links.map((link) => ({
        id: link.id,
        title: link.title,
        url: link.url,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString()
      })),
      labels: card.labels.map((relation) => ({
        id: relation.label.id,
        name: relation.label.name,
        color: relation.label.color
      })),
      activities: card.activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        metadataJson: activity.metadataJson,
        createdAt: activity.createdAt.toISOString(),
        actor: {
          id: activity.actorUser.id,
          name: activity.actorUser.name,
          email: activity.actorUser.email,
          avatarUrl: activity.actorUser.avatarUrl
        }
      }))
    };
  }
}

export const boardService = new BoardService();
