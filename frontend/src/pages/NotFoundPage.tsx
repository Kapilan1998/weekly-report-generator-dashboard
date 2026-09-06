import { Link } from 'react-router-dom'
import { Card } from '../components/Card'

export function NotFoundPage() {
  return (
    <section className="animate-fade-up">
      <Card>
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-semibold text-brand-300">404</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink-100">
            Page not found
          </h1>
          <p className="mt-1 text-sm text-ink-300">That page doesn&apos;t exist.</p>
          <Link
            to="/reports"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-950/40 transition hover:bg-brand-500 active:scale-[0.98]"
          >
            Back to my reports
          </Link>
        </div>
      </Card>
    </section>
  )
}
