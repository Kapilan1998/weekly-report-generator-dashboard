package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

import java.time.LocalDate;

public class DuplicateReportException extends ApiException {

    public DuplicateReportException(LocalDate weekStart) {
        super(HttpStatus.CONFLICT, "You already have a report for the week starting " + weekStart);
    }
}
