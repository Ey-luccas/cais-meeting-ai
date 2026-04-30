import { cn } from '@/lib/utils';

type PageContainerProps = {
  children: React.ReactNode;
  className?: string;
  size?: 'default' | 'wide' | 'full';
};

const sizeClassName = {
  default: 'max-w-[1180px]',
  wide: 'max-w-[1440px]',
  full: 'max-w-none'
};

export const PageContainer = ({ children, className, size = 'default' }: PageContainerProps) => (
  <div className={cn('mx-auto w-full min-w-0 max-w-full px-6 py-6 lg:px-8 lg:py-7', sizeClassName[size], className)}>
    {children}
  </div>
);
