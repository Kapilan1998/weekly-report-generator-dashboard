package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * No API key is configured, so the assistant cannot answer.
 *
 * <p>503 rather than 500: nothing is broken, the optional feature simply is not switched on.
 * The rest of the application is unaffected, which is why this is a per-request failure
 * rather than a start-up one - a fresh clone with no key still runs everything else.
 */
public class AssistantNotConfiguredException extends ApiException {

    public AssistantNotConfiguredException() {
        super(HttpStatus.SERVICE_UNAVAILABLE,
                "The AI assistant is not configured. Set GEMINI_API_KEY to enable it.");
    }
}
