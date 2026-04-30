import { Modal } from '@/components/ui/modal';

type AppModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
};

export const AppModal = ({ open, title, description, onClose, className, children }: AppModalProps) => (
  <Modal open={open} title={title} description={description} onClose={onClose} className={className}>
    {children}
  </Modal>
);
