import type { Request, Response } from 'express';
import { z } from 'zod';

import { meetingsService } from '../services';
import { AppError, getBaseUrl } from '../utils';

const meetingIdSchema = z.object({
  id: z.string().uuid()
});

const createMeetingSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional()
});

const normalizeTags = (input: unknown): string[] => {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
      .slice(0, 20);
  }

  if (typeof input !== 'string') {
    return [];
  }

  const raw = input.trim();

  if (!raw) {
    return [];
  }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
          .slice(0, 20);
      }
    } catch {
      // fallback to comma-separated parser
    }
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 20);
};

export class MeetingsController {
  async createMeeting(req: Request, res: Response): Promise<void> {
    const parsedBody = createMeetingSchema.safeParse(req.body);

    if (!parsedBody.success) {
      throw new AppError(400, 'Dados inválidos para criação da reunião.', parsedBody.error.flatten());
    }

    const meeting = await meetingsService.createMeeting({
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      durationSeconds: parsedBody.data.durationSeconds,
      tags: normalizeTags(parsedBody.data.tags),
      baseUrl: getBaseUrl(req)
    });

    res.status(201).json(meeting);
  }

  async listMeetings(req: Request, res: Response): Promise<void> {
    const meetings = await meetingsService.listMeetings(getBaseUrl(req));
    res.json({ meetings });
  }

  async getMeetingById(req: Request, res: Response): Promise<void> {
    const parsedParams = meetingIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de reunião inválido.', parsedParams.error.flatten());
    }

    const meeting = await meetingsService.getMeetingById(parsedParams.data.id, getBaseUrl(req));
    res.json(meeting);
  }

  async deleteMeeting(req: Request, res: Response): Promise<void> {
    const parsedParams = meetingIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de reunião inválido.', parsedParams.error.flatten());
    }

    await meetingsService.deleteMeeting(parsedParams.data.id);
    res.status(204).send();
  }

  async uploadMeetingAudio(req: Request, res: Response): Promise<void> {
    const parsedParams = meetingIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de reunião inválido.', parsedParams.error.flatten());
    }

    if (!req.file) {
      throw new AppError(400, 'Arquivo de áudio é obrigatório para upload.');
    }

    const meeting = await meetingsService.uploadMeetingAudio({
      id: parsedParams.data.id,
      file: req.file,
      baseUrl: getBaseUrl(req)
    });

    res.json(meeting);
  }

  async transcribeMeeting(req: Request, res: Response): Promise<void> {
    const parsedParams = meetingIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de reunião inválido.', parsedParams.error.flatten());
    }

    const meeting = await meetingsService.transcribeMeeting(parsedParams.data.id, getBaseUrl(req));
    res.json(meeting);
  }

  async generateMeetingNotes(req: Request, res: Response): Promise<void> {
    const parsedParams = meetingIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de reunião inválido.', parsedParams.error.flatten());
    }

    const meeting = await meetingsService.generateMeetingNotes(parsedParams.data.id, getBaseUrl(req));
    res.json(meeting);
  }

  async processMeeting(req: Request, res: Response): Promise<void> {
    const parsedParams = meetingIdSchema.safeParse(req.params);

    if (!parsedParams.success) {
      throw new AppError(400, 'ID de reunião inválido.', parsedParams.error.flatten());
    }

    const meeting = await meetingsService.processMeeting(parsedParams.data.id, getBaseUrl(req));
    res.json(meeting);
  }
}

export const meetingsController = new MeetingsController();
