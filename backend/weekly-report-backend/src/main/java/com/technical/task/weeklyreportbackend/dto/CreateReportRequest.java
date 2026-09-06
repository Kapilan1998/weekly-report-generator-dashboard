package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

/**
 * Creates a draft. The field set is fixed and identical for every user — the assignment
 * requires that users cannot add or reorder their own fields, which is also why unknown
 * JSON properties are rejected globally.
 *
 * <p>weekStart is normalized to the Monday of that ISO week by the service, so any date
 * within the intended week is accepted and still lands on one canonical row.
 */
public record CreateReportRequest(
        @NotNull(message = "Week start is required")
        LocalDate weekStart,

        @NotNull(message = "Project is required")
        @Positive(message = "Project id must be positive")
        Long projectId,

        @Size(max = 4000, message = "Tasks planned for next week must be at most 4000 characters")
        String tasksPlannedNextWeek,

        @Size(max = 4000, message = "Notes must be at most 4000 characters")
        String notes,

        @Size(max = 1000, message = "Links must be at most 1000 characters")
        String links,

        @Valid
        @Size(max = 50, message = "A report may contain at most 50 tasks")
        List<TaskEntryRequest> tasks,

        @Valid
        @Size(max = 20, message = "A report may contain at most 20 blockers")
        List<BlockerRequest> blockers,

        @Valid
        @Size(max = 20, message = "A report may contain at most 20 achievements")
        List<AchievementRequest> achievements,

        @Valid
        @Size(max = 5, message = "A report may contain at most 5 hours entries")
        List<HoursEntryRequest> hours
) {
}
