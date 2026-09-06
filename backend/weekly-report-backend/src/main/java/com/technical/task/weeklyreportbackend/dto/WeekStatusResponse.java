package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;

/**
 * One team member's submission state for a given week.
 *
 * <p>{@code status == null} means "not yet started" — the fifth value in the brief's
 * submission-status filter. It is the <em>absence</em> of a report row for that (user,
 * week) pair, so no predicate over reports alone can express it; this comes from a left
 * join out of users.
 */
public record WeekStatusResponse(
        UserSummaryResponse member,
        Long reportId,
        ReportStatus status
) {
    public boolean notStarted() {
        return status == null;
    }
}
