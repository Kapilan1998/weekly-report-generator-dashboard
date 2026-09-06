import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-lg shadow-brand-950/40 hover:bg-brand-500 active:bg-brand-700 focus-visible:outline-brand-400',
  secondary:
    'bg-navy-700 text-ink-100 ring-1 ring-inset ring-white/10 hover:bg-navy-600 active:bg-navy-700 focus-visible:outline-brand-400',
  ghost: 'text-ink-300 hover:bg-white/5 hover:text-ink-100 focus-visible:outline-brand-400',
  danger:
    'bg-red-600 text-white shadow-lg shadow-red-950/40 hover:bg-red-500 active:bg-red-700 focus-visible:outline-red-400',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled ?? loading}
      // active:scale gives a physical press response; transform-only, so it costs nothing.
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
