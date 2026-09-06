package com.technical.task.weeklyreportbackend.exception;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import org.springframework.http.HttpStatus;

/** The requested action is not legal from the report's current status. */
public class IllegalReportTransitionException extends ApiException {

    public IllegalReportTransitionException(ReportStatus current, String action) {
        super(HttpStatus.CONFLICT, "A report with status " + current + " cannot be " + action);
    }
}
