import { Switch as ChakraSwitch } from '@chakra-ui/react';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, id, disabled, className }: SwitchProps) {
  return (
    <ChakraSwitch.Root
      checked={checked}
      onCheckedChange={(e) => onCheckedChange(e.checked)}
      disabled={disabled}
      className={cn(className)}
    >
      <ChakraSwitch.HiddenInput id={id} />
      <ChakraSwitch.Control>
        <ChakraSwitch.Thumb />
      </ChakraSwitch.Control>
    </ChakraSwitch.Root>
  );
}
