import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

type MeetingStatusTimelineProps = {
  steps: Array<{ label: string; done: boolean }>;
};

export const MeetingStatusTimeline = ({ steps }: MeetingStatusTimelineProps) => (
  <div className="space-y-3">
    {steps.map((step) => (
      <div key={step.label} className="flex items-center gap-3">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border', step.done ? 'border-brand bg-brand text-white' : 'border-app bg-white text-app-muted')}>
          <Check className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm text-[#111827]">{step.label}</span>
      </div>
    ))}
  </div>
);
