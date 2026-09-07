package com.technical.task.weeklyreportbackend.dto;

import java.time.LocalDate;

/**
 * The four summary metrics the brief asks for, for one week.
 *
 * <p>Compliance is broken into its parts rather than shipped as a single percentage, so the
 * dashboard can show "submitted vs pending vs not started" as the brief words it, and the
 * percentage is included so the UI does not have to reproduce the rounding.
 *
 * <p>{@code needsCorrection} and {@code openBlockers} are deliberately <em>not</em>
 * week-scoped: both are current-state counts ("reports currently in Needs Correction",
 * "open blockers across the team"), so scoping them to a week would answer a different
 * question.
 */
public record DashboardSummaryResponse(
        LocalDate weekStart,
        LocalDate weekEnd,
        long teamSize,
        long submitted,
        long draft,
        long notStarted,
        int compliancePercent,
        long needsCorrection,
        long openBlockers
) {
}
