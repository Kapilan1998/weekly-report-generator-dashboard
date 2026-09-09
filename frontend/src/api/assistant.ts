import { request } from './client'
import type {
  AssistantChatInput,
  AssistantChatResult,
  AssistantStatus,
  AssistantSummary,
} from '../types/api'

/** Manager only — every question reaches across the whole team. */

export function getAssistantStatus(): Promise<AssistantStatus> {
  return request<AssistantStatus>('/assistant/status')
}

/**
 * The conversation is sent with every question rather than kept on the server: the brief
 * doesn't ask for saved chats, and holding it here avoids a table and a retention question
 * about text that quotes report content.
 */
export function askAssistant(input: AssistantChatInput): Promise<AssistantChatResult> {
  return request<AssistantChatResult>('/assistant/chat', { method: 'POST', body: input })
}

export function getWeekSummary(weekStart: string): Promise<AssistantSummary> {
  return request<AssistantSummary>('/assistant/summary', {
    method: 'POST',
    query: { weekStart },
  })
}
