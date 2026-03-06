import { useNavigate } from 'react-router-dom';
import { Dialog } from '@chakra-ui/react';
import { AiSetupView } from './InlineAiSetup';

interface AiSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}

export function AiSetupDialog({ open, onOpenChange, onNavigate }: AiSetupDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Body>
            <AiSetupView
              onNavigate={() => {
                onOpenChange(false);
                onNavigate?.();
                navigate('/settings#ai-settings');
              }}
              onDismiss={() => onOpenChange(false)}
            />
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
