import { Text, type TextProps } from '@chakra-ui/react';
import * as React from 'react';

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      <Text
        as="label"
        ref={ref as React.Ref<HTMLParagraphElement>}
        fontSize="13px"
        fontWeight="medium"
        color="var(--text-tertiary)"
        textTransform="uppercase"
        letterSpacing="wider"
        className={className}
        {...(props as TextProps)}
      />
    );
  }
);
Label.displayName = 'Label';

export { Label };
