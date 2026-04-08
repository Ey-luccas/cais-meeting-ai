import type { MeetingActionItem } from '@/types/meeting';

export const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

export const asActionItems = (value: unknown): MeetingActionItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): MeetingActionItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<MeetingActionItem>;
      if (typeof candidate.item !== 'string' || candidate.item.trim().length === 0) {
        return null;
      }

      return {
        item: candidate.item.trim(),
        owner: typeof candidate.owner === 'string' ? candidate.owner : null,
        deadline: typeof candidate.deadline === 'string' ? candidate.deadline : null,
        status: typeof candidate.status === 'string' ? candidate.status : null
      };
    })
    .filter((item): item is MeetingActionItem => item !== null);
};
