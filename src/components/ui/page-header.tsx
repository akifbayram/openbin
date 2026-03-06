import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@chakra-ui/react';
import { MenuButton } from '@/components/ui/menu-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
  back?: boolean;
  className?: string;
}

export function PageHeader({ title, actions, back, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn(actions ? 'flex items-center justify-between' : 'flex items-center gap-2', className)}>
      <div className="flex items-center gap-2">
        <MenuButton />
        {back && (
          <Tooltip content="Go back" side="bottom">
            <Button
              variant="ghost"
              size="xs" px="0"
              onClick={() => navigate(-1)}
              className="shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
        )}
        <h1 className="text-[28px] lg:text-[34px] font-bold tracking-tight leading-none">
          {title}
        </h1>
      </div>
      {actions}
    </div>
  );
}
