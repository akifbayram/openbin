import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  actions?: React.ReactNode;
  back?: boolean;
  /** Explicit back path — renders on all breakpoints (not just lg) */
  backTo?: string;
  className?: string;
}

export function PageHeader({ title, actions, back, backTo, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn(actions ? 'flex items-center justify-between' : 'flex items-center gap-2', className)}>
      <div className="flex items-center gap-2">
        {backTo ? (
          <Tooltip content="Go back" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(backTo)}
              className="shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
        ) : back && (
          <Tooltip content="Go back" side="bottom">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(-1)}
              className="hidden lg:inline-flex shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
        )}
        <h1 className="font-heading text-[28px] lg:text-[34px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          {title}
        </h1>
      </div>
      {actions}
    </div>
  );
}
