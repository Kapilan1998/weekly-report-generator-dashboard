package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A list row. Carries no report content, so a page of rows is one query plus the fetched
 * to-ones rather than an N+1 over five child tables.
 *
 * <p>{@code lastSubmittedAt} comes from the report, not from the current version: a report
 * under correction has an unsubmitted current version, so sourcing it from the version
 * would blank the column for exactly the rows a manager is chasing.
 */
public record ReportSummaryResponse(
        Long id,
        UserSummaryResponse owner,
        ProjectSummaryResponse project,
        LocalDate weekStart,
        LocalDate weekEnd,
        ReportStatus status,
        LocalDateTime lastSubmittedAt,
        LocalDateTime updatedAt
) {
}
