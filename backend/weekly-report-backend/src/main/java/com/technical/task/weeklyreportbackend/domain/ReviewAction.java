package com.technical.task.weeklyreportbackend.domain;

/**
 * Deliberately APPROVE rather than APPROVED, so it cannot be confused with
 * {@link ReportStatus#APPROVED} where both enums appear in the same mapper.
 */
public enum ReviewAction {
    APPROVE,
    REQUEST_CHANGES
}
