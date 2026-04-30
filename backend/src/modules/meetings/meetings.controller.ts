import { ObservationType } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/app-error';
import { getBaseUrl } from '../../shared/http';
import { meetingsService } from './meetings.service';

const projectParamsSchema = z.object({
  id: z.string().uuid('ID de projeto inválido.')
});

const meetingParamsSchema = z.object({
  meetingId: z.string().uuid('ID de reunião inválido.')
});

const createMeetingSchema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(4000).optional()
});

const createObservationSchema = z.object({
  timestampSeconds: z.coerce.number().int().min(0).default(0),
  type: z.nativeEnum(ObservationType).default(ObservationType.NOTE),
  content: z.string().trim().min(1).max(5000)
});

export class MeetingsController {
  async create(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para criação da reunião.', params.error.flatten());
    }

    const payload = createMeetingSchema.safeParse(req.body ?? {});

    if (!payload.success) {
      throw new AppError(400, 'Payload inválido para criação da reunião.', payload.error.flatten());
    }

    const meeting = await meetingsService.createMeeting({
      organizationId: req.auth.organizationId,
      projectId: params.data.id,
      userId: req.auth.userId,
      organizationRole: req.auth.role,
      title: payload.data.title,
      description: payload.data.description,
      audioFile: req.file ?? undefined,
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(meeting);
  }

  async listByProject(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = projectParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para listagem de reuniões.', params.error.flatten());
    }

    const meetings = await meetingsService.listProjectMeetings({
      organizationId: req.auth.organizationId,
      projectId: params.data.id,
      userId: req.auth.userId,
      organizationRole: req.auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json({ meetings });
  }

  async getById(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = meetingParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para buscar reunião.', params.error.flatten());
    }

    const meeting = await meetingsService.getMeetingById({
      organizationId: req.auth.organizationId,
      meetingId: params.data.meetingId,
      userId: req.auth.userId,
      organizationRole: req.auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(meeting);
  }

  async remove(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = meetingParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para excluir reunião.', params.error.flatten());
    }

    await meetingsService.deleteMeeting({
      organizationId: req.auth.organizationId,
      meetingId: params.data.meetingId,
      userId: req.auth.userId,
      organizationRole: req.auth.role
    });

    res.status(204).send();
  }

  async upload(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = meetingParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para upload de áudio.', params.error.flatten());
    }

    if (!req.file) {
      throw new AppError(400, 'Arquivo de áudio é obrigatório.');
    }

    const meeting = await meetingsService.uploadMeetingAudio({
      organizationId: req.auth.organizationId,
      meetingId: params.data.meetingId,
      userId: req.auth.userId,
      organizationRole: req.auth.role,
      audioFile: req.file,
      baseUrl: getBaseUrl(req)
    });

    res.json(meeting);
  }

  async createObservation(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = meetingParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para criar observação.', params.error.flatten());
    }

    const payload = createObservationSchema.safeParse(req.body ?? {});

    if (!payload.success) {
      throw new AppError(400, 'Payload inválido para observação da reunião.', payload.error.flatten());
    }

    const observation = await meetingsService.addObservation({
      organizationId: req.auth.organizationId,
      meetingId: params.data.meetingId,
      userId: req.auth.userId,
      organizationRole: req.auth.role,
      timestampSeconds: payload.data.timestampSeconds,
      type: payload.data.type,
      content: payload.data.content
    });

    res.status(201).json(observation);
  }

  async process(req: Request, res: Response): Promise<void> {
    if (!req.auth) {
      throw new AppError(401, 'Não autenticado.');
    }

    const params = meetingParamsSchema.safeParse(req.params);

    if (!params.success) {
      throw new AppError(400, 'Parâmetros inválidos para processamento da reunião.', params.error.flatten());
    }

    const meeting = await meetingsService.processMeeting({
      organizationId: req.auth.organizationId,
      meetingId: params.data.meetingId,
      userId: req.auth.userId,
      organizationRole: req.auth.role,
      baseUrl: getBaseUrl(req)
    });

    res.json(meeting);
  }
}

export const meetingsController = new MeetingsController();
