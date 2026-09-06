package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * The report is in an editable status but is not complete enough to submit. 409 is used for
 * every submit refusal so the frontend has a single branch to handle.
 */
public class ReportNotSubmittableException extends ApiException {

    public ReportNotSubmittableException(String reason) {
        super(HttpStatus.CONFLICT, "This report cannot be submitted yet: " + reason);
    }
}
