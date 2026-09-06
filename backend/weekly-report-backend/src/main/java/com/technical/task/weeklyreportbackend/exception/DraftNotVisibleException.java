package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A manager opening another user's draft. 403 rather than 404 here on purpose: the manager
 * is legitimately allowed to know the report exists (it shows on their dashboard as a
 * draft), they are simply not allowed to read its content until it is submitted.
 */
public class DraftNotVisibleException extends ApiException {

    public DraftNotVisibleException() {
        super(HttpStatus.FORBIDDEN, "This report is still a draft and its content is not visible yet");
    }
}
