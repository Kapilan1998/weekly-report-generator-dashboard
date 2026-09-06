package com.technical.task.weeklyreportbackend.domain;

public enum ReportStatus {
    DRAFT,
    SUBMITTED,
    NEEDS_CORRECTION,
    APPROVED;

    public boolean isEditableByOwner() {
        return this == DRAFT || this == NEEDS_CORRECTION;
    }
}
