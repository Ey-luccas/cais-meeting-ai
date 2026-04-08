import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type InformativeBlockProps = {
  title: string;
  text: string;
};

export const InformativeBlock = ({ title, text }: InformativeBlockProps): JSX.Element => {
  return (
    <Card className="cais-paper">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[#0A4C78]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-relaxed text-[#0A4C78]/74">{text}</CardContent>
    </Card>
  );
};
