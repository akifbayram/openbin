import { Check } from 'lucide-react';
import { PASSWORD_CHECKS, type PasswordCheckResult } from '@/lib/passwordStrength';
import { cn } from '@/lib/utils';

interface PasswordChecklistProps {
  checks: PasswordCheckResult;
}

export function PasswordChecklist({ checks }: PasswordChecklistProps) {
  return (
    <ul className="flex flex-col gap-1 text-[13px]" aria-label="Password requirements">
      {PASSWORD_CHECKS.map(({ key, label }) => (
        <li
          key={key}
          className="row-tight"
          aria-label={`${label} — ${checks[key] ? 'met' : 'not met'}`}
        >
          {checks[key] ? (
            <Check className="h-3.5 w-3.5 text-[var(--accent)] shrink-0 animate-check-pop" aria-hidden="true" />
          ) : (
            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-flat)]" aria-hidden="true" />
          )}
          <span className={cn(
            'transition-colors duration-200',
            checks[key] ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
          )}>
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
