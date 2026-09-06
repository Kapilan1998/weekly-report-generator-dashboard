package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A cross-item content rule was broken — e.g. two blockers both flagged as the week's key
 * issue. These can't be expressed with a field-level annotation, so they are checked in the
 * service.
 */
public class InvalidReportContentException extends ApiException {

    public InvalidReportContentException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
