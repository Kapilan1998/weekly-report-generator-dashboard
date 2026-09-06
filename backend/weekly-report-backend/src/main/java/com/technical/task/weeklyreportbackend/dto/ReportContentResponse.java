package com.technical.task.weeklyreportbackend.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The content of one version. {@code submittedAt == null} means this is the open working
 * copy; a non-null value means a frozen snapshot.
 */
public record ReportContentResponse(
        Integer versionNumber,
        LocalDateTime submittedAt,
        String tasksPlannedNextWeek,
        String notes,
        String links,
        List<TaskEntryResponse> tasks,
        List<BlockerResponse> blockers,
        List<AchievementResponse> achievements,
        List<HoursEntryResponse> hours
) {
}
