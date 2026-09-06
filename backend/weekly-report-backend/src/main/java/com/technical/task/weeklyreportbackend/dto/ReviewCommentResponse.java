package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.ReviewAction;

import java.time.LocalDateTime;

/**
 * {@code versionNumber} is the version this comment was made against, which may be older
 * than the report's current version — that is exactly what the assignment asks a manager to
 * be able to see.
 */
public record ReviewCommentResponse(
        Long id,
        Integer versionNumber,
        UserSummaryResponse reviewer,
        ReviewAction action,
        String comment,
        LocalDateTime createdAt
) {
}
