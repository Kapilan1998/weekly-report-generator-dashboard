import { useEffect, useRef, useState } from 'react'
import { askAssistant, getAssistantStatus } from '../../api/assistant'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import type { AssistantStatus, AssistantTurn } from '../../types/api'

/**
 * The chat widget — the brief's optional AI assistant.
 *
 * Mounted once in the app shell rather than on a page, so a manager can ask a question without
 * leaving whatever they were looking at. It renders nothing at all for a team member: the
 * endpoints are manager-only, so a visible control would be a button that always returns 403.
 *
 * `toolsUsed` is displayed under each answer deliberately. An assistant that quotes numbers is
 * only useful if you can tell where they came from, and it is the first thing to check when an
 * answer looks wrong.
 */

interface Message {
  role: 'user' | 'model'
  text: string
  toolsUsed?: string[]
}

const SUGGESTIONS = [
  'How many reports are waiting for my review?',
  "What blockers came up this week?",
  'Who has not filed a report this week?',
]

/**
 * Tool names as a manager would say them. An explicit map rather than stripping prefixes:
 * `list_reports` reduces to a bare "reports", which says nothing about what was looked up -
 * and the whole point of showing these is that the reader can tell where a number came from.
 */
const TOOL_LABELS: Record<string, string> = {
  get_week_overview: 'week overview',
  list_reports: 'report list',
  get_report_content: 'report content',
  get_team_metrics: 'team metrics',
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ')
}

export function AssistantWidget() {
  const { isManager } = useAuth()

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Asked once. A team member never reaches the endpoint, so the request isn't made at all.
  useEffect(() => {
    if (!isManager) return
    let active = true
    getAssistantStatus()
      .then((result) => {
        if (active) setStatus(result)
      })
      .catch(() => {
        // A failure here means the feature is unusable, which is the same outcome as
        // unconfigured - so it degrades to the same disabled state rather than an alarm.
        if (active) setStatus({ configured: false, model: '' })
      })
    return () => {
      active = false
    }
  }, [isManager])

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, asking])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!isManager) return null

  async function send(question: string) {
    const trimmed = question.trim()
    if (trimmed === '' || asking) return

    // The history sent is what preceded this question, so the reply the model is about to
    // produce isn't in it.
    const history: AssistantTurn[] = messages.map(({ role, text }) => ({ role, text }))

    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    setDraft('')
    setError(null)
    setAsking(true)
    try {
      const result = await askAssistant({ message: trimmed, history })
      setMessages((current) => [
        ...current,
        { role: 'model', text: result.reply, toolsUsed: result.toolsUsed },
      ])
    } catch (caught) {
      setError(errorMessage(caught, 'The assistant could not answer that.'))
    } finally {
      setAsking(false)
    }
  }

  const configured = status?.configured === true

  return (
    <>
      {/* Trigger. Stays visible but disabled when unconfigured, so the feature's existence
          and the reason it is off are both discoverable. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={status === null}
          title={
            status === null
              ? 'Checking the assistant…'
              : configured
                ? 'Ask the assistant'
                : 'The assistant is not configured on this server'
          }
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-brand-950/50 transition hover:bg-brand-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:right-6 sm:bottom-6"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8M8 14h5m-8 6 3.2-2.4A2 2 0 0 1 9.4 17H18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v13Z" />
          </svg>
          Ask the assistant
        </button>
      )}

      {open && (
        <section
          aria-label="AI assistant"
          className="fixed right-0 bottom-0 z-40 flex h-[min(34rem,85svh)] w-full flex-col overflow-hidden rounded-t-2xl bg-navy-800 shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:right-6 sm:bottom-6 sm:w-[26rem] sm:rounded-2xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-white/5 bg-navy-700/40 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink-100">Assistant</h2>
              <p className="truncate text-xs text-ink-500">
                {configured ? `Answers from your team's reports · ${status?.model}` : 'Not configured'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-4">
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!configured ? (
              <div className="rounded-lg bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200 ring-1 ring-inset ring-amber-500/25">
                <p className="font-medium">The assistant is not configured.</p>
                <p className="mt-1 text-amber-200/80">
                  It needs a model API key. Set <code className="text-amber-100">GEMINI_API_KEY</code>{' '}
                  — see the README. Everything else in the app works without it.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div>
                <p className="text-sm text-ink-300">
                  Ask about your team&apos;s reports. Every answer is looked up from the
                  data — nothing is answered from memory.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => send(suggestion)}
                        className="w-full rounded-lg bg-navy-900/50 px-3 py-2 text-left text-sm text-ink-300 ring-1 ring-inset ring-white/5 transition hover:bg-navy-900 hover:text-ink-100"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-brand-600 text-white'
                        : 'bg-navy-900/60 text-ink-100 ring-1 ring-inset ring-white/5'
                    }`}
                  >
                    {message.text}
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
                        {message.toolsUsed.map((tool) => (
                          <span
                            key={tool}
                            className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-500"
                          >
                            {toolLabel(tool)}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}

            {asking && (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <span
                  aria-hidden="true"
                  className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Looking it up…
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200 ring-1 ring-inset ring-red-500/25">
                {error}
              </p>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t border-white/5 bg-navy-700/30 px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Your question</span>
              <textarea
                rows={1}
                value={draft}
                maxLength={1000}
                disabled={!configured || asking}
                placeholder={configured ? 'Ask about the team…' : 'Unavailable'}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends, Shift+Enter makes a new line - the convention for chat.
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send(draft)
                  }
                }}
                className="block max-h-24 w-full resize-none rounded-lg bg-navy-900/70 px-3.5 py-2.5 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition placeholder:text-ink-500 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={!configured || asking || draft.trim() === ''}
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-6-6m6 6-6 6" />
              </svg>
            </button>
          </form>
        </section>
      )}
    </>
  )
}
