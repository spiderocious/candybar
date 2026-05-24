import { Bell } from '@icons';
import { cn } from '@shared/utils/cn';

interface LogoProps {
  readonly className?: string;
  readonly compact?: boolean;
}

/** Standalone logo so it can be reused across the shell, connect screen, etc. */
export function Logo({ className, compact = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
        <Bell size={18} aria-hidden="true" />
      </span>
      {!compact && <span className="text-lg font-semibold text-text">Communiqué</span>}
    </div>
  );
}
