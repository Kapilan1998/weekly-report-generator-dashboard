package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.Size;

/** Approval may carry an optional note; unlike request-changes, a comment is not required. */
public record ApproveRequest(
        @Size(max = 2000, message = "Comment must be at most 2000 characters")
        String comment
) {
}
