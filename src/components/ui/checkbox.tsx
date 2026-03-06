import { Checkbox as ChakraCheckbox } from '@chakra-ui/react';
import * as React from 'react';

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, id }, _ref) => {
    return (
      <ChakraCheckbox.Root
        checked={checked}
        onCheckedChange={(e) => onCheckedChange?.(!!e.checked)}
        disabled={disabled}
        className={className}
      >
        <ChakraCheckbox.HiddenInput id={id} />
        <ChakraCheckbox.Control>
          <ChakraCheckbox.Indicator />
        </ChakraCheckbox.Control>
      </ChakraCheckbox.Root>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
