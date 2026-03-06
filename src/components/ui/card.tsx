import { Card as ChakraCard } from '@chakra-ui/react';
import * as React from 'react';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ChakraCard.Root
      ref={ref}
      borderRadius="var(--radius-lg)"
      bg={{ base: 'white', _dark: '#1c1c1e' }}
      border="1px solid"
      borderColor="var(--border-subtle)"
      boxShadow="sm"
      transition="all 0.2s"
      className={className}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ChakraCard.Header
      ref={ref}
      display="flex"
      flexDirection="column"
      gap="1"
      px="5"
      pt="5"
      pb="1"
      className={className}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <ChakraCard.Title
      ref={ref}
      fontSize="17px"
      fontWeight="semibold"
      lineHeight="tight"
      className={className}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <ChakraCard.Description
      ref={ref}
      fontSize="13px"
      color="var(--text-tertiary)"
      lineHeight="snug"
      className={className}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ChakraCard.Body ref={ref} px="5" py="4" className={className} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <ChakraCard.Footer
      ref={ref}
      display="flex"
      alignItems="center"
      px="5"
      pb="4"
      pt="0"
      className={className}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
