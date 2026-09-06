package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown both when a report does not exist and when it belongs to another team member, with
 * an identical message in each case.
 *
 * <p>Answering 403 for "exists but not yours" and 404 for "does not exist" would let a
 * caller enumerate which report ids are real and whose they are, so both collapse to 404.
 * 403 is reserved for role-gate rejections.
 */
public class ReportNotFoundException extends ApiException {

    public ReportNotFoundException() {
        super(HttpStatus.NOT_FOUND, "Report not found");
    }
}
