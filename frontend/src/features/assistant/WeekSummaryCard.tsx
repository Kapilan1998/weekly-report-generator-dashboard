import { useState } from 'react'
import { getWeekSummary } from '../../api/assistant'
import { errorMessage } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { formatWeek } from '../../lib/format'
import { weekEndOf } from '../../lib/week'
import type { AssistantSummary } from '../../types/api'

/**
 * The brief's second AI capability: a written summary of one week — completed work, recurring
 * blockers, workload balance.
 *
 * Generated on demand rather than on page load. It costs a model call every time, and a
 * manager opening the dashboard to check one number should not pay for prose they did not ask
 * for. The button also makes it obvious that this section is model-written, which matters when
 * everything else on the page is a computed figure.
 */
export function WeekSummaryCard({ week }: { week: string }) {
  const [summary, setSummary] = useState<AssistantSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      setSummary(await getWeekSummary(week))
    } catch (caught) {
      setError(errorMessage(caught, 'Could not generate a summary.'))
    } finally {
      setLoading(false)
    }
  }

  // A summary is tied to the week it was generated for; once the picker moves, it is stale.
  const stale = summary !== null && summary.weekStart !== week

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-navy-700/30 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-100">Week in review</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Written by the assistant from {formatWeek(week, weekEndOf(week))}&apos;s reports
          </p>
        </div>
        <Button variant="secondary" onClick={generate} loading={loading}>
          {summary && !stale ? 'Regenerate' : 'Summarise this week'}
        </Button>
      </div>

      <div className="px-4 py-4">
        {error && <Alert>{error}</Alert>}

        {!error && summary === null && !loading && (
          <p className="text-sm text-ink-500">
            Reads every readable report for the selected week and picks out what got done, which
            blockers recur, and whether the workload is evenly spread.
          </p>
        )}

        {summary && (
          <>
            {stale && (
              <div className="mb-3">
                <Alert tone="warning">
                  This summary covers {formatWeek(summary.weekStart, summary.weekEnd)}, not the
                  week now selected. Regenerate to update it.
                </Alert>
              </div>
            )}
            <p className="mb-2 text-xs text-ink-500">
              From {summary.reportsIncluded} report{summary.reportsIncluded === 1 ? '' : 's'} ·
              other members&apos; drafts are private and excluded
            </p>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink-300">
              {summary.summary}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
