import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { AiSetupView } from './InlineAiSetup';

interface AiSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}

export function AiSetupDialog({ open, onOpenChange, onNavigate }: AiSetupDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <AiSetupView
          onNavigate={() => {
            onOpenChange(false);
            onNavigate?.();
            navigate('/settings#ai-settings');
          }}
          onDismiss={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
