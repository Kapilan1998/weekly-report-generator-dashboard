package com.technical.task.weeklyreportbackend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One entry in the recent-activity feed. The brief asks for "recent reports / activity feed,
 * including recent review actions", so this covers both a member submitting and a manager
 * approving or sending a report back.
 */
public record ActivityItemResponse(
        ActivityType type,
        Long reportId,
        LocalDate weekStart,
        /** Whose report it is. */
        UserSummaryResponse owner,
        /** Who performed the action — the owner for a submission, the manager for a review. */
        UserSummaryResponse actor,
        String projectName,
        Integer versionNumber,
        String comment,
        LocalDateTime at
) {
    public enum ActivityType {
        SUBMITTED,
        APPROVED,
        CHANGES_REQUESTED
    }
}
