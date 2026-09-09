package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * The upstream model provider failed or answered in a way we cannot use.
 *
 * <p>502, because the failure is upstream rather than in this application. The message is
 * fixed and server-authored: a provider error body can carry request echoes and quota
 * details, and this string is shown to a user.
 */
public class AssistantUnavailableException extends ApiException {

    public AssistantUnavailableException(String detail) {
        super(HttpStatus.BAD_GATEWAY, "The AI assistant is unavailable right now. " + detail);
    }
}
