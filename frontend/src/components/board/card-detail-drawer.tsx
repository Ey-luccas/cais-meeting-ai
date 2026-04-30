import { Drawer } from '@/components/ui/drawer';

type CardDetailDrawerProps = {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  bodyClassName?: string;
  children: React.ReactNode;
};

export const CardDetailDrawer = ({
  title,
  description,
  open,
  onClose,
  bodyClassName,
  children
}: CardDetailDrawerProps) => {
  return (
    <Drawer
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      bodyClassName={bodyClassName}
    >
      {children}
    </Drawer>
  );
};
