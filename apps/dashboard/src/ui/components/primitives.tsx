
import { AlertCircle, Loader2 } from '@icons';
import { cn } from '@shared/utils/cn';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// ── Button ─────────────────────────────────────────────────────────────────────
interface ButtonProps extends Readonly<ButtonHTMLAttributes<HTMLButtonElement>> {
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  readonly loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-surface-2 text-text hover:bg-border',
    danger: 'bg-error text-white hover:opacity-90',
    ghost: 'bg-transparent text-text-muted hover:bg-surface-2',
  } as const;
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        styles[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

// ── Field (label + input + inline error) ─────────────────────────────────────────
interface FieldProps extends Readonly<InputHTMLAttributes<HTMLInputElement>> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string;
}

export function Field({ label, error, hint, id, className, ...rest }: FieldProps) {
  const fieldId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={fieldId}
        className={cn(
          'rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary',
          error ? 'border-error' : 'border-border',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && <InlineError id={`${fieldId}-error`} message={error} />}
    </div>
  );
}

// ── Textarea field ────────────────────────────────────────────────────────────
interface TextareaFieldProps extends Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>> {
  readonly label: string;
  readonly error?: string | undefined;
}

export function TextareaField({ label, error, id, className, ...rest }: TextareaFieldProps) {
  const fieldId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-text">
        {label}
      </label>
      <textarea
        id={fieldId}
        className={cn(
          'min-h-24 rounded-lg border bg-surface px-3 py-2 font-mono text-sm outline-none transition focus:ring-2 focus:ring-primary',
          error ? 'border-error' : 'border-border',
          className,
        )}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      {error && <InlineError message={error} />}
    </div>
  );
}

// ── InlineError ─────────────────────────────────────────────────────────────────
interface InlineErrorProps {
  readonly message: string;
  readonly id?: string;
}

export function InlineError({ message, id }: InlineErrorProps) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-sm text-error">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </p>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-5', className)}>{children}</div>
  );
}

// ── Spinner ─────────────────────────────────────────────────────────────────────
export function Spinner({ label = 'Loading' }: { readonly label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-text-muted">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

// ── EmptyState ──────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface py-12 text-center">
      <div className="text-text-muted" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {subtitle && <p className="max-w-sm text-sm text-text-muted">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────────
const badgeTone = {
  success: 'bg-success/10 text-success',
  error: 'bg-error/10 text-error',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  neutral: 'bg-surface-2 text-text-muted',
} as const;

export function Badge({
  tone = 'neutral',
  children,
}: {
  readonly tone?: keyof typeof badgeTone;
  readonly children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', badgeTone[tone])}>
      {children}
    </span>
  );
}

// ── PageHeader ──────────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
