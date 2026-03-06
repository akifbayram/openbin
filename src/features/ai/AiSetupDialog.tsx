import { useNavigate } from 'react-router-dom';
import { Drawer } from '@chakra-ui/react';
import { DRAWER_PLACEMENT } from '@/components/ui/provider';
import { AiSetupView } from './InlineAiSetup';

interface AiSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}

export function AiSetupDialog({ open, onOpenChange, onNavigate }: AiSetupDialogProps) {
  const navigate = useNavigate();

  return (
    <Drawer.Root placement={DRAWER_PLACEMENT} open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.CloseTrigger />
          <Drawer.Body>
            <AiSetupView
              onNavigate={() => {
                onOpenChange(false);
                onNavigate?.();
                navigate('/settings#ai-settings');
              }}
              onDismiss={() => onOpenChange(false)}
            />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
