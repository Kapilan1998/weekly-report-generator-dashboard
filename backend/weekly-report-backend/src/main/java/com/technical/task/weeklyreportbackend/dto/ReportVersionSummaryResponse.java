package com.technical.task.weeklyreportbackend.dto;

import java.time.LocalDateTime;
import java.util.List;

/** One row of the version-history list: when it was submitted and how it was reviewed. */
public record ReportVersionSummaryResponse(
        Integer versionNumber,
        LocalDateTime submittedAt,
        List<ReviewCommentResponse> reviews
) {
}
