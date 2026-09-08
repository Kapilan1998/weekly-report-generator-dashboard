package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.ReviewAction;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;
import com.technical.task.weeklyreportbackend.domain.TaskType;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.ActivityItemResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardChartsResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.UserSummaryResponse;
import com.technical.task.weeklyreportbackend.mapper.ReportMapper;
import com.technical.task.weeklyreportbackend.repository.BlockerRepository;
import com.technical.task.weeklyreportbackend.repository.HoursEntryRepository;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import com.technical.task.weeklyreportbackend.repository.TaskEntryRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

/**
 * The dashboard aggregates. The arithmetic is worth testing because every one of these
 * numbers is read as a fact about the team: a compliance rate that rounds the wrong way or a
 * chart that skips a quiet week is not a cosmetic bug.
 *
 * <p>Zero-filling is deliberate and asserted here — a trend that omits weeks with no activity
 * draws a line that slopes through the gap instead of showing the dip.
 */
@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @InjectMocks
    DashboardService dashboardService;

    @Mock
    ReportRepository reportRepository;

    @Mock
    TaskEntryRepository taskEntryRepository;

    @Mock
    HoursEntryRepository hoursEntryRepository;

    @Mock
    BlockerRepository blockerRepository;

    @Mock
    ReviewCommentRepository reviewCommentRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    ReportMapper mapper;

    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 7);
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 9);

    private final User alice = User.builder().id(1L).name("Alice Member")
            .email("alice@example.com").role(Role.TEAM_MEMBER).enabled(true).build();
    private final User liam = User.builder().id(2L).name("Liam Chen")
            .email("liam@example.com").role(Role.TEAM_MEMBER).enabled(true).build();

    // ---- projection stand-ins: interface-based projections, so implemented inline ----

    private TaskEntryRepository.WeeklyCount weeklyCount(LocalDate week, long completed) {
        return new TaskEntryRepository.WeeklyCount() {
            @Override
            public LocalDate getWeekStart() {
                return week;
            }

            @Override
            public long getCompletedTasks() {
                return completed;
            }
        };
    }

    private TaskEntryRepository.ProjectHours projectHours(Long projectId, String hours) {
        return new TaskEntryRepository.ProjectHours() {
            @Override
            public Long getProjectId() {
                return projectId;
            }

            @Override
            public BigDecimal getHoursSpent() {
                return new BigDecimal(hours);
            }
        };
    }

    private HoursEntryRepository.TaskTypeHours taskTypeHours(TaskType type, String hours) {
        return new HoursEntryRepository.TaskTypeHours() {
            @Override
            public TaskType getTaskType() {
                return type;
            }

            @Override
            public BigDecimal getHours() {
                return new BigDecimal(hours);
            }
        };
    }

    private ReportRepository.MemberStatusCount memberStatus(Long userId, ReportStatus status, long total) {
        return new ReportRepository.MemberStatusCount() {
            @Override
            public Long getUserId() {
                return userId;
            }

            @Override
            public ReportStatus getStatus() {
                return status;
            }

            @Override
            public long getTotal() {
                return total;
            }
        };
    }

    private ReportRepository.ProjectReportCount projectReports(Long id, String name, long count) {
        return new ReportRepository.ProjectReportCount() {
            @Override
            public Long getProjectId() {
                return id;
            }

            @Override
            public String getProjectName() {
                return name;
            }

            @Override
            public long getReportCount() {
                return count;
            }
        };
    }

    // ---- summary ----

    private void stubSummary(long teamSize, long submitted, long draft, long withAnyReport) {
        Mockito.when(userRepository.count()).thenReturn(teamSize);
        Mockito.when(reportRepository.countByWeekStartAndLastSubmittedAtIsNotNull(MONDAY))
                .thenReturn(submitted);
        Mockito.when(reportRepository.countByWeekStartAndStatus(MONDAY, ReportStatus.DRAFT))
                .thenReturn(draft);
        Mockito.when(reportRepository.countByWeekStart(MONDAY)).thenReturn(withAnyReport);
        Mockito.when(reportRepository.countByStatus(ReportStatus.NEEDS_CORRECTION)).thenReturn(3L);
        Mockito.when(blockerRepository.countOpen(ReportStatus.APPROVED)).thenReturn(5L);
    }

    @Test
    void summaryNormalisesTheWeekAndReportsTheWholeRange() {
        stubSummary(6, 2, 1, 3);

        DashboardSummaryResponse summary = dashboardService.summary(WEDNESDAY);

        assertEquals(MONDAY, summary.weekStart());
        assertEquals(MONDAY.plusDays(6), summary.weekEnd());
    }

    @Test
    void summaryCountsSubmittedDraftAndNotStarted() {
        // 6 people, 3 have a report row of some kind, so 3 have nothing at all.
        stubSummary(6, 2, 1, 3);

        DashboardSummaryResponse summary = dashboardService.summary(MONDAY);

        assertEquals(6, summary.teamSize());
        assertEquals(2, summary.submitted());
        assertEquals(1, summary.draft());
        assertEquals(3, summary.notStarted());
    }

    @Test
    void summaryRoundsTheComplianceRate() {
        // 2 of 6 is 33.33%, which has to round rather than truncate toward either end.
        stubSummary(6, 2, 1, 3);
        assertEquals(33, dashboardService.summary(MONDAY).compliancePercent());
    }

    @Test
    void summaryReportsFullComplianceWhenEveryoneHasFiled() {
        stubSummary(4, 4, 0, 4);

        DashboardSummaryResponse summary = dashboardService.summary(MONDAY);

        assertEquals(100, summary.compliancePercent());
        assertEquals(0, summary.notStarted());
    }

    @Test
    void summaryHandlesAnEmptyTeamWithoutDividingByZero() {
        stubSummary(0, 0, 0, 0);

        DashboardSummaryResponse summary = dashboardService.summary(MONDAY);

        assertEquals(0, summary.compliancePercent());
        assertEquals(0, summary.notStarted());
    }

    @Test
    void summaryNeverReportsANegativeNotStartedCount() {
        // More report rows than users is only reachable if an account was deleted after
        // filing, but the floor means the tile shows 0 rather than "-2 not started".
        stubSummary(3, 3, 0, 5);

        assertEquals(0, dashboardService.summary(MONDAY).notStarted());
    }

    @Test
    void needsCorrectionAndOpenBlockersAreCurrentStateNotWeekScoped() {
        // Both are questions about now, so neither query takes the week - which is why the UI
        // labels them "all weeks" under a week picker.
        stubSummary(6, 2, 1, 3);

        DashboardSummaryResponse summary = dashboardService.summary(MONDAY);

        assertEquals(3, summary.needsCorrection());
        assertEquals(5, summary.openBlockers());
        Mockito.verify(reportRepository).countByStatus(ReportStatus.NEEDS_CORRECTION);
        Mockito.verify(blockerRepository).countOpen(ReportStatus.APPROVED);
    }

    // ---- charts ----

    private void stubCharts(LocalDate from, List<TaskEntryRepository.WeeklyCount> trend) {
        Mockito.when(taskEntryRepository.countCompletedTasksByWeek(from, MONDAY, TaskStatus.DONE))
                .thenReturn(trend);
        Mockito.when(reportRepository.countByMemberAndStatus(from, MONDAY)).thenReturn(List.of());
        Mockito.when(userRepository.findAll(any(Sort.class))).thenReturn(List.of());
        Mockito.when(taskEntryRepository.sumHoursSpentByProject(from, MONDAY)).thenReturn(List.of());
        Mockito.when(reportRepository.countByProject(from, MONDAY)).thenReturn(List.of());
        Mockito.when(hoursEntryRepository.sumHoursByTaskType(from, MONDAY)).thenReturn(List.of());
    }

    @Test
    void chartsWindowEndsAtTheSelectedWeekAndReachesBack() {
        LocalDate from = MONDAY.minusWeeks(3);
        stubCharts(from, List.of());

        DashboardChartsResponse charts = dashboardService.charts(MONDAY, 4);

        // Four weeks inclusive of the selected one, not four weeks before it.
        assertEquals(4, charts.tasksCompletedTrend().size());
        assertEquals(from, charts.tasksCompletedTrend().get(0).weekStart());
        assertEquals(MONDAY, charts.tasksCompletedTrend().get(3).weekStart());
    }

    @Test
    void chartsZeroFillWeeksWithNoCompletedTasks() {
        LocalDate from = MONDAY.minusWeeks(2);
        // Only the middle week has data.
        stubCharts(from, List.of(weeklyCount(MONDAY.minusWeeks(1), 7)));

        List<DashboardChartsResponse.TasksCompletedPoint> trend =
                dashboardService.charts(MONDAY, 3).tasksCompletedTrend();

        assertEquals(3, trend.size());
        assertEquals(0, trend.get(0).completedTasks());
        assertEquals(7, trend.get(1).completedTasks());
        assertEquals(0, trend.get(2).completedTasks());
    }

    @Test
    void chartsTreatAZeroOrNegativeWindowAsOneWeek() {
        stubCharts(MONDAY, List.of());

        assertEquals(1, dashboardService.charts(MONDAY, 0).tasksCompletedTrend().size());
    }

    @Test
    void chartsIncludeEveryTeamMemberEvenWithNoReportsInTheWindow() {
        LocalDate from = MONDAY.minusWeeks(7);
        Mockito.when(taskEntryRepository.countCompletedTasksByWeek(from, MONDAY, TaskStatus.DONE))
                .thenReturn(List.of());
        Mockito.when(reportRepository.countByMemberAndStatus(from, MONDAY))
                .thenReturn(List.of(memberStatus(1L, ReportStatus.APPROVED, 4L)));
        Mockito.when(userRepository.findAll(any(Sort.class))).thenReturn(List.of(alice, liam));
        Mockito.when(mapper.toUserSummary(alice)).thenReturn(new UserSummaryResponse(1L, "Alice Member"));
        Mockito.when(mapper.toUserSummary(liam)).thenReturn(new UserSummaryResponse(2L, "Liam Chen"));
        Mockito.when(taskEntryRepository.sumHoursSpentByProject(from, MONDAY)).thenReturn(List.of());
        Mockito.when(reportRepository.countByProject(from, MONDAY)).thenReturn(List.of());
        Mockito.when(hoursEntryRepository.sumHoursByTaskType(from, MONDAY)).thenReturn(List.of());

        List<DashboardChartsResponse.MemberStatusBreakdown> byMember =
                dashboardService.charts(MONDAY, 8).statusByMember();

        assertEquals(2, byMember.size());
        assertEquals(4L, byMember.get(0).counts().get(ReportStatus.APPROVED));
        // Liam filed nothing: an empty map, not a missing row. Dropping him would hide the
        // person a manager most needs to see.
        assertTrue(byMember.get(1).counts().isEmpty());
    }

    @Test
    void chartsListEveryTaskTypeInEnumOrderEvenAtZeroHours() {
        LocalDate from = MONDAY.minusWeeks(7);
        Mockito.when(taskEntryRepository.countCompletedTasksByWeek(from, MONDAY, TaskStatus.DONE))
                .thenReturn(List.of());
        Mockito.when(reportRepository.countByMemberAndStatus(from, MONDAY)).thenReturn(List.of());
        Mockito.when(userRepository.findAll(any(Sort.class))).thenReturn(List.of());
        Mockito.when(taskEntryRepository.sumHoursSpentByProject(from, MONDAY)).thenReturn(List.of());
        Mockito.when(reportRepository.countByProject(from, MONDAY)).thenReturn(List.of());
        Mockito.when(hoursEntryRepository.sumHoursByTaskType(from, MONDAY))
                .thenReturn(List.of(taskTypeHours(TaskType.TESTING, "94.80")));

        List<DashboardChartsResponse.TaskTypeHoursPoint> hours =
                dashboardService.charts(MONDAY, 8).hoursByTaskType();

        // A stable axis: the bar order must not shift as the data changes.
        assertEquals(TaskType.values().length, hours.size());
        assertEquals(TaskType.DEVELOPMENT, hours.get(0).taskType());
        assertEquals(BigDecimal.ZERO, hours.get(0).hours());
        assertEquals(TaskType.TESTING, hours.get(1).taskType());
        assertEquals(new BigDecimal("94.80"), hours.get(1).hours());
    }

    @Test
    void chartsMergeProjectReportCountsWithProjectHours() {
        LocalDate from = MONDAY.minusWeeks(7);
        Mockito.when(taskEntryRepository.countCompletedTasksByWeek(from, MONDAY, TaskStatus.DONE))
                .thenReturn(List.of());
        Mockito.when(reportRepository.countByMemberAndStatus(from, MONDAY)).thenReturn(List.of());
        Mockito.when(userRepository.findAll(any(Sort.class))).thenReturn(List.of());
        Mockito.when(reportRepository.countByProject(from, MONDAY))
                .thenReturn(List.of(projectReports(1L, "Client A", 5L), projectReports(2L, "Support", 4L)));
        Mockito.when(taskEntryRepository.sumHoursSpentByProject(from, MONDAY))
                .thenReturn(List.of(projectHours(1L, "100.00")));
        Mockito.when(hoursEntryRepository.sumHoursByTaskType(from, MONDAY)).thenReturn(List.of());

        List<DashboardChartsResponse.ProjectWorkloadPoint> workload =
                dashboardService.charts(MONDAY, 8).workloadByProject();

        // Two queries rather than one join: joining tasks into the count query would multiply
        // each report by its task rows and inflate every count.
        assertEquals(2, workload.size());
        assertEquals(new BigDecimal("100.00"), workload.get(0).hoursSpent());
        assertEquals(5, workload.get(0).reportCount());
        // A project with reports but no logged hours reports zero, not null.
        assertEquals(BigDecimal.ZERO, workload.get(1).hoursSpent());
        assertEquals(4, workload.get(1).reportCount());
    }

    // ---- activity ----

    private Report submittedReport(long id, User owner, LocalDateTime submittedAt) {
        return Report.builder()
                .id(id).user(owner)
                .project(Project.builder().id(1L).name("Client A").active(true).build())
                .weekStart(MONDAY).weekEnd(MONDAY.plusDays(6))
                .status(ReportStatus.SUBMITTED).lastSubmittedAt(submittedAt)
                .build();
    }

    private ReviewComment review(Report report, ReviewAction action, LocalDateTime at) {
        return ReviewComment.builder()
                .id(9L)
                .reportVersion(ReportVersion.builder().id(50L).report(report).versionNumber(1).build())
                .reviewer(liam)
                .action(action)
                .comment("Please split the tasks up")
                .createdAt(at)
                .build();
    }

    @Test
    void activityMergesSubmissionsAndReviewsNewestFirst() {
        Report report = submittedReport(5L, alice, LocalDateTime.of(2026, 9, 11, 16, 30));
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of(report));
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc())
                .thenReturn(List.of(review(report, ReviewAction.REQUEST_CHANGES,
                        LocalDateTime.of(2026, 9, 12, 9, 0))));
        Mockito.when(mapper.toUserSummary(any(User.class)))
                .thenReturn(new UserSummaryResponse(1L, "Alice Member"));

        List<ActivityItemResponse> feed = dashboardService.activity(15);

        assertEquals(2, feed.size());
        // The review happened the morning after the submission, so it comes first.
        assertEquals(ActivityItemResponse.ActivityType.CHANGES_REQUESTED, feed.get(0).type());
        assertEquals(ActivityItemResponse.ActivityType.SUBMITTED, feed.get(1).type());
        assertTrue(feed.get(0).at().isAfter(feed.get(1).at()));
    }

    @Test
    void activityMapsAnApprovalToItsOwnType() {
        Report report = submittedReport(5L, alice, LocalDateTime.of(2026, 9, 11, 16, 30));
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of());
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc())
                .thenReturn(List.of(review(report, ReviewAction.APPROVE,
                        LocalDateTime.of(2026, 9, 12, 9, 0))));
        Mockito.when(mapper.toUserSummary(any(User.class)))
                .thenReturn(new UserSummaryResponse(1L, "Alice Member"));

        List<ActivityItemResponse> feed = dashboardService.activity(15);

        assertEquals(ActivityItemResponse.ActivityType.APPROVED, feed.get(0).type());
        // The version the decision was made against travels with the entry.
        assertEquals(1, feed.get(0).versionNumber());
    }

    @Test
    void aSubmissionsActorIsAlwaysItsOwnAuthor() {
        Report report = submittedReport(5L, alice, LocalDateTime.of(2026, 9, 11, 16, 30));
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of(report));
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc()).thenReturn(List.of());
        Mockito.when(mapper.toUserSummary(alice)).thenReturn(new UserSummaryResponse(1L, "Alice Member"));

        ActivityItemResponse item = dashboardService.activity(15).get(0);

        // Owner and actor are separate fields because on a review they differ; conflating
        // them would misattribute every approval to the report's author.
        assertEquals(item.owner(), item.actor());
        assertNull(item.versionNumber());
        assertNull(item.comment());
    }

    @Test
    void activityRespectsTheRequestedLimit() {
        Report first = submittedReport(5L, alice, LocalDateTime.of(2026, 9, 11, 16, 30));
        Report second = submittedReport(6L, liam, LocalDateTime.of(2026, 9, 10, 16, 30));
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of(first, second));
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc()).thenReturn(List.of());
        Mockito.when(mapper.toUserSummary(any(User.class)))
                .thenReturn(new UserSummaryResponse(1L, "Alice Member"));

        List<ActivityItemResponse> feed = dashboardService.activity(1);

        assertEquals(1, feed.size());
        // The newest of the two survives the trim.
        assertEquals(LocalDateTime.of(2026, 9, 11, 16, 30), feed.get(0).at());
    }

    @Test
    void activityTreatsAZeroLimitAsOne() {
        Report report = submittedReport(5L, alice, LocalDateTime.of(2026, 9, 11, 16, 30));
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of(report));
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc()).thenReturn(List.of());
        Mockito.when(mapper.toUserSummary(any(User.class)))
                .thenReturn(new UserSummaryResponse(1L, "Alice Member"));

        // Stream.limit(0) would return nothing at all rather than falling back to a default.
        assertEquals(1, dashboardService.activity(0).size());
    }

    @Test
    void activityIsEmptyWhenNothingHasHappened() {
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of());
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc()).thenReturn(List.of());

        assertTrue(dashboardService.activity(15).isEmpty());
        Mockito.verify(mapper, Mockito.never()).toUserSummary(any());
    }

    @Test
    void bothActivityQueriesAreCappedRegardlessOfTheRequestedLimit() {
        // The query cost is bounded by the Top20 finders, so a caller asking for 50 cannot
        // turn the feed into a full table scan.
        Mockito.when(reportRepository.findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc())
                .thenReturn(List.of());
        Mockito.when(reviewCommentRepository.findTop20ByOrderByCreatedAtDescIdDesc()).thenReturn(List.of());

        dashboardService.activity(50);

        Mockito.verify(reportRepository).findTop20ByLastSubmittedAtIsNotNullOrderByLastSubmittedAtDesc();
        Mockito.verify(reviewCommentRepository).findTop20ByOrderByCreatedAtDescIdDesc();
        Mockito.verify(reportRepository, Mockito.never()).findAll(eq(Sort.unsorted()));
    }
}
