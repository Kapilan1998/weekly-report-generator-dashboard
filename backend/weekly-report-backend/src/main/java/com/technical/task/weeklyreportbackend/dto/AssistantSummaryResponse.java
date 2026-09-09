package com.technical.task.weeklyreportbackend.dto;

import java.time.LocalDate;

/** A written summary of one week: completed work, recurring blockers, workload balance. */
public record AssistantSummaryResponse(
        LocalDate weekStart,
        LocalDate weekEnd,
        int reportsIncluded,
        String summary
) {
}
