package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;

import java.time.LocalDate;
import java.util.List;

/**
 * A single past version, viewed on demand.
 *
 * <p>Carries the owner, week and project as well as the content so the payload is
 * self-describing — this is the endpoint that satisfies "a manager must be able to clearly
 * see each past version of that week's report", and a version blob with no attribution
 * would not.
 */
public record ReportVersionDetailResponse(
        Long reportId,
        UserSummaryResponse owner,
        ProjectSummaryResponse project,
        LocalDate weekStart,
        LocalDate weekEnd,
        ReportStatus reportStatus,
        ReportContentResponse content,
        List<ReviewCommentResponse> reviews
) {
}
