import { ApiError } from '@/lib/api';
import { meetingsApi } from './meetings.api';
import type { CreateMeetingInput, Meeting } from '@/types/meeting';

const mapProviderError = (error: unknown): never => {
  if (error instanceof ApiError) {
    throw error;
  }

  throw new ApiError('Falha ao processar dados de reuniões.', 500);
};

export const meetingsModule = {
  list: async (): Promise<Meeting[]> => {
    try {
      return await meetingsApi.list();
    } catch (error) {
      return mapProviderError(error);
    }
  },

  details: async (id: string): Promise<Meeting> => {
    try {
      return await meetingsApi.details(id);
    } catch (error) {
      return mapProviderError(error);
    }
  },

  create: async (input: CreateMeetingInput): Promise<Meeting> => {
    try {
      return await meetingsApi.create(input);
    } catch (error) {
      return mapProviderError(error);
    }
  },

  uploadAudio: async (id: string, file: File): Promise<Meeting> => {
    try {
      return await meetingsApi.uploadAudio(id, file);
    } catch (error) {
      return mapProviderError(error);
    }
  },

  transcribe: async (id: string): Promise<Meeting> => {
    try {
      return await meetingsApi.transcribe(id);
    } catch (error) {
      return mapProviderError(error);
    }
  },

  generateNotes: async (id: string): Promise<Meeting> => {
    try {
      return await meetingsApi.generateNotes(id);
    } catch (error) {
      return mapProviderError(error);
    }
  },

  process: async (id: string): Promise<Meeting> => {
    try {
      await meetingsApi.transcribe(id);
      return await meetingsApi.generateNotes(id);
    } catch (error) {
      return mapProviderError(error);
    }
  },

  remove: async (id: string): Promise<void> => {
    try {
      await meetingsApi.remove(id);
    } catch (error) {
      return mapProviderError(error);
    }
  }
};

export type MeetingsModule = typeof meetingsModule;
