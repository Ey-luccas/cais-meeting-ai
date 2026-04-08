import { apiClient } from '@/lib/api-client';
import type { CreateMeetingInput, Meeting, MeetingsListResponse } from '@/types/meeting';

export const meetingsApi = {
  async list(): Promise<Meeting[]> {
    const payload = await apiClient.request<MeetingsListResponse>('/meetings');
    return payload.meetings;
  },

  details(id: string): Promise<Meeting> {
    return apiClient.request<Meeting>(`/meetings/${id}`);
  },

  create(input: CreateMeetingInput): Promise<Meeting> {
    return apiClient.request<Meeting>('/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(input)
    });
  },

  uploadAudio(id: string, file: File): Promise<Meeting> {
    const formData = new FormData();
    formData.append('audio', file);

    return apiClient.request<Meeting>(`/meetings/${id}/upload`, {
      method: 'POST',
      body: formData
    });
  },

  transcribe(id: string): Promise<Meeting> {
    return apiClient.request<Meeting>(`/meetings/${id}/transcribe`, {
      method: 'POST'
    });
  },

  generateNotes(id: string): Promise<Meeting> {
    return apiClient.request<Meeting>(`/meetings/${id}/generate-notes`, {
      method: 'POST'
    });
  },

  remove(id: string): Promise<void> {
    return apiClient.request<void>(`/meetings/${id}`, {
      method: 'DELETE'
    });
  }
};
