package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.TaskType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * The chart datasets for the manager dashboard, in one response so the page renders from a
 * single request rather than five.
 *
 * <p>Every aggregate is restricted to each report's <strong>current version</strong>. Without
 * that, a report that went through a correction cycle would have its tasks and hours counted
 * once per version.
 */
public record DashboardChartsResponse(
        List<TasksCompletedPoint> tasksCompletedTrend,
        List<MemberStatusBreakdown> statusByMember,
        List<ProjectWorkloadPoint> workloadByProject,
        List<TaskTypeHoursPoint> hoursByTaskType
) {
    /** One week on the trend line. */
    public record TasksCompletedPoint(LocalDate weekStart, long completedTasks) {
    }

    /** One bar per team member, split by report status. Members with no reports are included. */
    public record MemberStatusBreakdown(UserSummaryResponse member, Map<ReportStatus, Long> counts) {
    }

    public record ProjectWorkloadPoint(
            Long projectId,
            String projectName,
            long reportCount,
            BigDecimal hoursSpent
    ) {
    }

    public record TaskTypeHoursPoint(TaskType taskType, BigDecimal hours) {
    }
}
