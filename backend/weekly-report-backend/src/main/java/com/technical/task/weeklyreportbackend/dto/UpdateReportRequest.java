package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Replaces the editable content of a report.
 *
 * <p>Deliberately carries no weekStart: a report's week is its identity (one report per
 * user per week), so moving it would silently collide with another week's row. It also
 * carries no status — the workflow is driven by the submit/approve/request-changes
 * endpoints, never by a client-supplied field.
 *
 * <p>The child lists are a full replacement, not a merge. Merging by child id would let a
 * caller pass an id belonging to someone else's version.
 */
public record UpdateReportRequest(
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
