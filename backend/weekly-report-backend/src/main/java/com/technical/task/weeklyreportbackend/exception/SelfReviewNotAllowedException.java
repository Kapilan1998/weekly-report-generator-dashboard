package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A manager may file their own weekly report — the brief says every user gets their own
 * report page — but may not review it. Compared by user id, not by entity: the principal's
 * User is detached, loaded in the JWT filter outside any persistence context.
 */
public class SelfReviewNotAllowedException extends ApiException {

    public SelfReviewNotAllowedException() {
        super(HttpStatus.FORBIDDEN, "You cannot review your own report");
    }
}
