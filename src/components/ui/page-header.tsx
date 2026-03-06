import { Button, Flex, Heading } from '@chakra-ui/react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MenuButton } from '@/components/ui/menu-button';
import { Tooltip } from '@/components/ui/tooltip';

interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
  back?: boolean;
  className?: string;
}

export function PageHeader({ title, actions, back, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <Flex
      alignItems="center"
      justifyContent={actions ? 'space-between' : undefined}
      gap={actions ? undefined : '2'}
      className={className}
    >
      <Flex alignItems="center" gap="2">
        <MenuButton />
        {back && (
          <Tooltip content="Go back" side="bottom">
            <Button
              variant="ghost"
              size="xs"
              px="0"
              onClick={() => navigate(-1)}
              flexShrink={0}
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
        )}
        <Heading
          as="h1"
          fontSize={{ base: '28px', lg: '34px' }}
          fontWeight="bold"
          letterSpacing="tight"
          lineHeight="none"
        >
          {title}
        </Heading>
      </Flex>
      {actions}
    </Flex>
  );
}
