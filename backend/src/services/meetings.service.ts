import { MeetingStatus, Prisma } from '@prisma/client';

import { prisma } from '../config/prisma';
import type { GeneratedNotesPayload, MeetingResponse } from '../types';
import {
  AppError,
  deleteFileIfExists,
  fileExists,
  logger,
  publicAudioUrl,
  resolveAudioFilePath
} from '../utils';
import { audioProcessingService } from './audio-processing.service';

const meetingInclude = {
  transcript: true,
  note: true,
  tags: true
} satisfies Prisma.MeetingInclude;

type MeetingWithRelations = Prisma.MeetingGetPayload<{
  include: typeof meetingInclude;
}>;

type CreateMeetingInput = {
  title: string;
  description?: string;
  durationSeconds?: number;
  tags: string[];
  baseUrl: string;
};

type UploadAudioInput = {
  id: string;
  file: Express.Multer.File;
  baseUrl: string;
};

export class MeetingsService {
  async createMeeting(input: CreateMeetingInput): Promise<MeetingResponse> {
    const { tags, baseUrl, ...data } = input;

    const meeting = await prisma.meeting.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        audioPath: null,
        durationSeconds: data.durationSeconds ?? null,
        status: MeetingStatus.PENDING,
        tags: {
          create: tags.map((tag) => ({ tag }))
        }
      },
      include: meetingInclude
    });

    return this.toResponse(meeting, baseUrl);
  }

  async listMeetings(baseUrl: string): Promise<MeetingResponse[]> {
    const meetings = await prisma.meeting.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: meetingInclude
    });

    return meetings.map((meeting) => this.toResponse(meeting, baseUrl));
  }

  async getMeetingById(id: string, baseUrl: string): Promise<MeetingResponse> {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: meetingInclude
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    return this.toResponse(meeting, baseUrl);
  }

  async deleteMeeting(id: string): Promise<void> {
    const meeting = await prisma.meeting.findUnique({ where: { id } });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    await prisma.meeting.delete({ where: { id } });

    if (meeting.audioPath) {
      await deleteFileIfExists(meeting.audioPath);
    }
  }

  async uploadMeetingAudio(input: UploadAudioInput): Promise<MeetingResponse> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: input.id },
      include: meetingInclude
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    const updatedMeeting = await prisma.$transaction(async (tx) => {
      await tx.transcript.deleteMany({ where: { meetingId: input.id } });
      await tx.note.deleteMany({ where: { meetingId: input.id } });

      return tx.meeting.update({
        where: { id: input.id },
        data: {
          audioPath: input.file.filename,
          status: MeetingStatus.UPLOADED,
          durationSeconds: null
        },
        include: meetingInclude
      });
    });

    if (meeting.audioPath && meeting.audioPath !== input.file.filename) {
      try {
        await deleteFileIfExists(meeting.audioPath);
      } catch (error) {
        logger.warn('Falha ao remover áudio anterior da reunião.', {
          meetingId: meeting.id,
          audioPath: meeting.audioPath,
          error
        });
      }
    }

    return this.toResponse(updatedMeeting, input.baseUrl);
  }

  async transcribeMeeting(id: string, baseUrl: string): Promise<MeetingResponse> {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: meetingInclude
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    if (!meeting.audioPath) {
      throw new AppError(400, 'A reunião não possui áudio associado.');
    }

    if (!(await fileExists(meeting.audioPath))) {
      throw new AppError(400, 'Arquivo de áudio não encontrado no servidor.');
    }

    await prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.TRANSCRIBING }
    });

    try {
      const transcription = await audioProcessingService.transcribeMeetingAudio(
        resolveAudioFilePath(meeting.audioPath)
      );

      const updatedMeeting = await prisma.$transaction(async (tx) => {
        await tx.transcript.upsert({
          where: { meetingId: id },
          create: {
            meetingId: id,
            fullText: transcription.fullText,
            language: transcription.language,
            rawJson: transcription.rawJson as Prisma.InputJsonValue
          },
          update: {
            fullText: transcription.fullText,
            language: transcription.language,
            rawJson: transcription.rawJson as Prisma.InputJsonValue
          }
        });

        await tx.note.deleteMany({ where: { meetingId: id } });

        return tx.meeting.update({
          where: { id },
          data: {
            status: MeetingStatus.TRANSCRIBED,
            durationSeconds: transcription.durationSeconds ?? meeting.durationSeconds
          },
          include: meetingInclude
        });
      });

      return this.toResponse(updatedMeeting, baseUrl);
    } catch (error) {
      await this.markMeetingAsFailed(id, 'Falha ao atualizar status para FAILED após erro na transcrição.');
      throw error;
    }
  }

  async generateMeetingNotes(id: string, baseUrl: string): Promise<MeetingResponse> {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: meetingInclude
    });

    if (!meeting) {
      throw new AppError(404, 'Reunião não encontrada.');
    }

    if (!meeting.transcript) {
      throw new AppError(400, 'A reunião ainda não possui transcrição.');
    }

    await prisma.meeting.update({
      where: { id },
      data: { status: MeetingStatus.PROCESSING_AI }
    });

    try {
      const notes = await audioProcessingService.generateMeetingNotes(meeting.transcript.fullText);

      const updatedMeeting = await prisma.$transaction(async (tx) => {
        await tx.note.upsert({
          where: { meetingId: id },
          create: this.noteCreatePayload(id, notes),
          update: this.noteUpdatePayload(notes)
        });

        return tx.meeting.update({
          where: { id },
          data: { status: MeetingStatus.COMPLETED },
          include: meetingInclude
        });
      });

      return this.toResponse(updatedMeeting, baseUrl);
    } catch (error) {
      await this.markMeetingAsFailed(id, 'Falha ao atualizar status para FAILED após erro na geração de notas.');
      throw error;
    }
  }

  async processMeeting(id: string, baseUrl: string): Promise<MeetingResponse> {
    await this.transcribeMeeting(id, baseUrl);
    return this.generateMeetingNotes(id, baseUrl);
  }

  private async markMeetingAsFailed(meetingId: string, logMessage: string): Promise<void> {
    try {
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.FAILED }
      });
    } catch (statusError) {
      logger.warn(logMessage, {
        meetingId,
        error: statusError
      });
    }
  }

  private noteCreatePayload(meetingId: string, notes: GeneratedNotesPayload): Prisma.NoteCreateInput {
    return {
      meeting: {
        connect: { id: meetingId }
      },
      summary: notes.summary,
      topicsJson: notes.topics as Prisma.InputJsonValue,
      decisionsJson: notes.decisions as Prisma.InputJsonValue,
      actionItemsJson: notes.actionItems as Prisma.InputJsonValue,
      pendingItemsJson: notes.pendingItems as Prisma.InputJsonValue,
      commentsJson: notes.comments as Prisma.InputJsonValue
    };
  }

  private noteUpdatePayload(notes: GeneratedNotesPayload): Prisma.NoteUpdateInput {
    return {
      summary: notes.summary,
      topicsJson: notes.topics as Prisma.InputJsonValue,
      decisionsJson: notes.decisions as Prisma.InputJsonValue,
      actionItemsJson: notes.actionItems as Prisma.InputJsonValue,
      pendingItemsJson: notes.pendingItems as Prisma.InputJsonValue,
      commentsJson: notes.comments as Prisma.InputJsonValue
    };
  }

  private toResponse(meeting: MeetingWithRelations, baseUrl: string): MeetingResponse {
    return {
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      audioPath: meeting.audioPath,
      audioUrl: publicAudioUrl(meeting.audioPath, baseUrl),
      durationSeconds: meeting.durationSeconds,
      status: meeting.status,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
      tags: meeting.tags.map((tag) => tag.tag),
      transcript: meeting.transcript
        ? {
            id: meeting.transcript.id,
            fullText: meeting.transcript.fullText,
            language: meeting.transcript.language,
            rawJson: meeting.transcript.rawJson,
            createdAt: meeting.transcript.createdAt.toISOString()
          }
        : null,
      note: meeting.note
        ? {
            id: meeting.note.id,
            summary: meeting.note.summary,
            topicsJson: meeting.note.topicsJson,
            decisionsJson: meeting.note.decisionsJson,
            actionItemsJson: meeting.note.actionItemsJson,
            pendingItemsJson: meeting.note.pendingItemsJson,
            commentsJson: meeting.note.commentsJson,
            createdAt: meeting.note.createdAt.toISOString()
          }
        : null
    };
  }
}

export const meetingsService = new MeetingsService();
