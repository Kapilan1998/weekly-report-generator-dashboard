package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * One report in full.
 *
 * <p>{@code content} is the owner's working copy when the caller owns the report, and the
 * latest submitted version when the caller is a manager — a manager is never shown an
 * unsubmitted correction in progress. {@code content.versionNumber} always says which
 * version is being displayed.
 *
 * <p>{@code latestReviewComment} is hoisted out of the history so the team member sees the
 * manager's correction note without having to dig, which the assignment requires.
 * {@code editable} / {@code reviewable} are computed for the calling user.
 */
public record ReportDetailResponse(
        Long id,
        UserSummaryResponse owner,
        ProjectSummaryResponse project,
        LocalDate weekStart,
        LocalDate weekEnd,
        ReportStatus status,
        LocalDateTime lastSubmittedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        ReportContentResponse content,
        ReviewCommentResponse latestReviewComment,
        List<ReviewCommentResponse> reviewHistory,
        int submittedVersionCount,
        boolean editable,
        boolean reviewable
) {
}
