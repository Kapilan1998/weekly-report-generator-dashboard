package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReviewAction;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;
import com.technical.task.weeklyreportbackend.domain.TaskType;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.ActivityItemResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardChartsResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardSummaryResponse;
import com.technical.task.weeklyreportbackend.mapper.ReportMapper;
import com.technical.task.weeklyreportbackend.repository.BlockerRepository;
import com.technical.task.weeklyreportbackend.repository.HoursEntryRepository;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import com.technical.task.weeklyreportbackend.repository.TaskEntryRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Read-only aggregates for the manager dashboard.
 *
 * <p>Two rules run through all of it:
 * <ul>
 *   <li>Aggregates over report <em>content</em> (tasks, hours, blockers) are restricted to
 *       each report's current version, in the queries themselves. Content hangs off a
 *       version, so a corrected report would otherwise be counted once per version.</li>
 *   <li>Week parameters are normalised to Monday exactly as {@code ReportService} does, so a
 *       caller passing any day of the week gets the week they meant.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ReportRepository reportRepository;
    private final TaskEntryRepository taskEntryRepository;
    private final HoursEntryRepository hoursEntryRepository;
    private final BlockerRepository blockerRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final UserRepository userRepository;
    private final ReportMapper mapper;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary(LocalDate weekStart) {
        LocalDate monday = normalizeToMonday(weekStart);

        long teamSize = userRepository.count();
        long submitted = reportRepository.countByWeekStartAndLastSubmittedAtIsNotNull(monday);
        long draft = reportRepository.countByWeekStartAndStatus(monday, ReportStatus.DRAFT);
        // Anyone with no report row at all for that week - the brief's fifth state.
        long notStarted = Math.max(0, teamSize - reportRepository.countByWeekStart(monday));

        int compliancePercent = teamSize == 0 ? 0 : (int) Math.round((submitted * 100.0) / teamSize);

        return new DashboardSummaryResponse(
                monday,
                monday.plusDays(6),
                teamSize,
                submitted,
                draft,
                notStarted,
                compliancePercent,
                reportRepository.countByStatus(ReportStatus.NEEDS_CORRECTION),
                blockerRepository.countOpen(ReportStatus.APPROVED));
    }

    /**
     * @param weekStart the most recent week to include
     * @param weeks     how many weeks back the trend covers
     */
    @Transactional(readOnly = true)
    public DashboardChartsResponse charts(LocalDate weekStart, int weeks) {
        LocalDate monday = normalizeToMonday(weekStart);
        LocalDate from = monday.minusWeeks(Math.max(1, weeks) - 1L);

        return new DashboardChartsResponse(
                tasksCompletedTrend(from, monday, weeks),
                statusByMember(from, monday),
                workloadByProject(from, monday),
                hoursByTaskType(from, monday));
    }

    /** Zero-filled, so the chart shows a flat week rather than skipping it. */
    private List<DashboardChartsResponse.TasksCompletedPoint> tasksCompletedTrend(
            LocalDate from, LocalDate to, int weeks) {
        Map<LocalDate, Long> counts = new HashMap<>();
        taskEntryRepository.countCompletedTasksByWeek(from, to, TaskStatus.DONE)
                .forEach(row -> counts.put(row.getWeekStart(), row.getCompletedTasks()));

        List<DashboardChartsResponse.TasksCompletedPoint> points = new ArrayList<>();
        for (int index = Math.max(1, weeks) - 1; index >= 0; index--) {
            LocalDate week = to.minusWeeks(index);
            points.add(new DashboardChartsResponse.TasksCompletedPoint(
                    week, counts.getOrDefault(week, 0L)));
        }
        return points;
    }

    /** Every user appears, including those with no reports in the window. */
    private List<DashboardChartsResponse.MemberStatusBreakdown> statusByMember(
            LocalDate from, LocalDate to) {
        Map<Long, Map<ReportStatus, Long>> byUser = new HashMap<>();
        reportRepository.countByMemberAndStatus(from, to).forEach(row ->
                byUser.computeIfAbsent(row.getUserId(), key -> new EnumMap<>(ReportStatus.class))
                        .put(row.getStatus(), row.getTotal()));

        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(user -> new DashboardChartsResponse.MemberStatusBreakdown(
                        mapper.toUserSummary(user),
                        byUser.getOrDefault(user.getId(), new EnumMap<>(ReportStatus.class))))
                .toList();
    }

    /**
     * Report counts and hours come from two queries and are merged here. Joining tasks into
     * the count query would multiply each report by its task rows.
     */
    private List<DashboardChartsResponse.ProjectWorkloadPoint> workloadByProject(
            LocalDate from, LocalDate to) {
        Map<Long, BigDecimal> hoursByProject = new HashMap<>();
        taskEntryRepository.sumHoursSpentByProject(from, to).forEach(row ->
                hoursByProject.put(row.getProjectId(), row.getHoursSpent()));

        return reportRepository.countByProject(from, to).stream()
                .map(row -> new DashboardChartsResponse.ProjectWorkloadPoint(
                        row.getProjectId(),
                        row.getProjectName(),
                        row.getReportCount(),
                        hoursByProject.getOrDefault(row.getProjectId(), BigDecimal.ZERO)))
                .toList();
    }

    /** One entry per task type in enum order, zero-filled so the chart axis is stable. */
    private List<DashboardChartsResponse.TaskTypeHoursPoint> hoursByTaskType(
            LocalDate from, LocalDate to) {
        Map<TaskType, BigDecimal> totals = new EnumMap<>(TaskType.class);
        hoursEntryRepository.sumHoursByTaskType(from, to)
                .forEach(row -> totals.put(row.getTaskType(), row.getHours()));

        return java.util.Arrays.stream(TaskType.values())
                .map(type -> new DashboardChartsResponse.TaskTypeHoursPoint(
                        type, totals.getOrDefault(type, BigDecimal.ZERO)))
                .toList();
    }

    /**
     * Submissions and review actions merged into one reverse-chronological feed. Both come
     * back capped at 20 and the merged list is trimmed again, so the query cost is bounded
     * regardless of how much history exists.
     */
    @Transactional(readOnly = true)
    public List<ActivityItemResponse> activity(int limit) {
        List<ActivityItemResponse> items = new ArrayList<>();

        for (Report report : reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc()) {
            items.add(new ActivityItemResponse(
                    ActivityItemResponse.ActivityType.SUBMITTED,
                    report.getId(),
                    report.getWeekStart(),
                    mapper.toUserSummary(report.getUser()),
                    // A submission's actor is always the report's own author.
                    mapper.toUserSummary(report.getUser()),
                    report.getProject().getName(),
                    null,
                    null,
                    report.getLastSubmittedAt()));
        }

        for (ReviewComment comment : reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc()) {
            Report report = comment.getReportVersion().getReport();
            User owner = report.getUser();
            items.add(new ActivityItemResponse(
                    comment.getAction() == ReviewAction.APPROVE
                            ? ActivityItemResponse.ActivityType.APPROVED
                            : ActivityItemResponse.ActivityType.CHANGES_REQUESTED,
                    report.getId(),
                    report.getWeekStart(),
                    mapper.toUserSummary(owner),
                    mapper.toUserSummary(comment.getReviewer()),
                    report.getProject().getName(),
                    comment.getReportVersion().getVersionNumber(),
                    comment.getComment(),
                    comment.getCreatedAt()));
        }

        return items.stream()
                .sorted(Comparator.comparing(ActivityItemResponse::at).reversed())
                .limit(Math.max(1, limit))
                .toList();
    }

    /** Mirrors ReportService.normalizeToMonday - see the note there. */
    private LocalDate normalizeToMonday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
}
