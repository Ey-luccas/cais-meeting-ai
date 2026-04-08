import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type InfoCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
};

export const InfoCard = ({ title, value, description, icon: Icon }: InfoCardProps): JSX.Element => {
  return (
    <Card className="cais-paper">
      <CardHeader className="space-y-3 pb-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#F2B11B]/45 bg-[#F2B11B]/24 text-[#0A4C78]">
          <Icon size={18} />
        </div>
        <CardTitle className="text-base text-[#0A4C78]/90">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="font-display text-4xl leading-none text-[#0A4C78]">{value}</p>
        <p className="text-sm leading-relaxed text-[#0A4C78]/72">{description}</p>
      </CardContent>
    </Card>
  );
};
