import type { ReactNode } from 'react'

type Tone = 'error' | 'info' | 'warning' | 'success'

const TONES: Record<Tone, string> = {
  error: 'bg-red-500/10 text-red-200 ring-red-500/25',
  info: 'bg-brand-500/10 text-brand-200 ring-brand-400/25',
  warning: 'bg-amber-500/10 text-amber-200 ring-amber-500/25',
  success: 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/25',
}

export function Alert({
  tone = 'error',
  title,
  children,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
}) {
  return (
    <div
      role="alert"
      className={`animate-fade-in rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-inset ${TONES[tone]}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  )
}
