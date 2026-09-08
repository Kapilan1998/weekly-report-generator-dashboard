package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.TaskPriority;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;
import com.technical.task.weeklyreportbackend.domain.TaskType;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AchievementRequest;
import com.technical.task.weeklyreportbackend.dto.BlockerRequest;
import com.technical.task.weeklyreportbackend.dto.CreateReportRequest;
import com.technical.task.weeklyreportbackend.dto.HoursEntryRequest;
import com.technical.task.weeklyreportbackend.dto.PageResponse;
import com.technical.task.weeklyreportbackend.dto.ReportDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.TaskEntryRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateReportRequest;
import com.technical.task.weeklyreportbackend.dto.UserSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.WeekStatusResponse;
import com.technical.task.weeklyreportbackend.exception.DuplicateReportException;
import com.technical.task.weeklyreportbackend.exception.IllegalReportTransitionException;
import com.technical.task.weeklyreportbackend.exception.InvalidReportContentException;
import com.technical.task.weeklyreportbackend.exception.ProjectChangeNotAllowedException;
import com.technical.task.weeklyreportbackend.exception.ReportNotFoundException;
import com.technical.task.weeklyreportbackend.exception.ReportNotSubmittableException;
import com.technical.task.weeklyreportbackend.mapper.ReportMapper;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReportVersionRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @InjectMocks
    ReportService reportService;

    @Mock
    ReportRepository reportRepository;

    @Mock
    ReportVersionRepository versionRepository;

    @Mock
    ReviewCommentRepository reviewCommentRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    ProjectService projectService;

    @Mock
    ReportAccessGuard accessGuard;

    @Mock
    ReportMapper mapper;

    @Mock
    ReportDetailResponse detail;

    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 7);
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 9, 9);

    private final User alice = User.builder().id(1L).name("Alice Member")
            .email("alice@example.com").role(Role.TEAM_MEMBER).enabled(true).build();
    private final User manager = User.builder().id(3L).name("Mia Manager")
            .email("mia@example.com").role(Role.MANAGER).enabled(true).build();
    private final Project clientA = Project.builder().id(1L).name("Client A").active(true).build();

    private Report report(ReportStatus status, LocalDateTime lastSubmittedAt) {
        return Report.builder()
                .id(5L).user(alice).project(clientA)
                .weekStart(MONDAY).weekEnd(MONDAY.plusDays(6))
                .status(status).lastSubmittedAt(lastSubmittedAt)
                .build();
    }

    private ReportVersion version(Report report, int number, LocalDateTime submittedAt) {
        return ReportVersion.builder()
                .id(50L + number).report(report).versionNumber(number).submittedAt(submittedAt)
                .build();
    }

    private TaskEntryRequest task() {
        return new TaskEntryRequest("Build the form", TaskPriority.HIGH, TaskStatus.DONE,
                100, 100, new BigDecimal("6.00"), new BigDecimal("6.50"), "ReportFormPage.tsx");
    }

    private CreateReportRequest createRequest(LocalDate week) {
        return new CreateReportRequest(week, 1L, "Next week's plan", null, null,
                List.of(task()), List.of(), List.of(), List.of());
    }

    /**
     * Stands in for identity generation: a real save assigns the id, and {@code buildDetail}
     * immediately looks the report up by it. Echoing the argument back unchanged would leave
     * the id null and every later lookup would miss.
     */
    private void stubSaveAssigningAnId() {
        Mockito.when(reportRepository.save(any(Report.class))).thenAnswer(call -> {
            Report toSave = call.getArgument(0);
            toSave.setId(5L);
            return toSave;
        });
    }

    /** Stubs the three calls every write path makes on its way out through buildDetail. */
    private void stubDetailBuild() {
        Mockito.when(reviewCommentRepository
                        .findByReportVersionReportIdOrderByCreatedAtDescIdDesc(anyLong()))
                .thenReturn(List.of());
        Mockito.when(versionRepository
                        .findByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(anyLong()))
                .thenReturn(List.of());
        Mockito.when(mapper.toDetail(any(), any(), any(), anyInt(), any())).thenReturn(detail);
    }

    // ---- createDraft ----

    @Test
    void createDraftNormalisesAnyDayOfTheWeekToItsMonday() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(false);
        Mockito.when(projectService.requireActive(1L)).thenReturn(clientA);
        stubSaveAssigningAnId();
        stubDetailBuild();

        // The caller sends a Wednesday; the row must land on the Monday, or two people
        // reporting the same week would produce two different weeks.
        reportService.createDraft(createRequest(WEDNESDAY), alice);

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        Mockito.verify(reportRepository).save(saved.capture());
        assertEquals(MONDAY, saved.getValue().getWeekStart());
        assertEquals(MONDAY.plusDays(6), saved.getValue().getWeekEnd());
        assertEquals(ReportStatus.DRAFT, saved.getValue().getStatus());
        assertSame(alice, saved.getValue().getUser());
    }

    @Test
    void createDraftStartsAtVersionOneWithAnOpenWorkingCopy() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(false);
        Mockito.when(projectService.requireActive(1L)).thenReturn(clientA);
        stubSaveAssigningAnId();
        stubDetailBuild();

        assertSame(detail, reportService.createDraft(createRequest(MONDAY), alice));

        ArgumentCaptor<ReportVersion> saved = ArgumentCaptor.forClass(ReportVersion.class);
        Mockito.verify(versionRepository).save(saved.capture());
        assertEquals(1, saved.getValue().getVersionNumber());
        // submittedAt null is what marks the single open working copy.
        assertNull(saved.getValue().getSubmittedAt());
        assertFalse(saved.getValue().isFrozen());
        assertEquals(1, saved.getValue().getTaskEntries().size());
        assertEquals(0, saved.getValue().getTaskEntries().get(0).getDisplayOrder());
    }

    @Test
    void createDraftRefusesASecondReportForTheSameWeek() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(true);

        assertThrows(DuplicateReportException.class,
                () -> reportService.createDraft(createRequest(WEDNESDAY), alice));
        // Checked before anything is written, and before the project is even resolved.
        Mockito.verifyNoInteractions(projectService, versionRepository);
        Mockito.verify(reportRepository, Mockito.never()).save(any());
    }

    @Test
    void createDraftRefusesTwoKeyBlockers() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(false);
        CreateReportRequest request = new CreateReportRequest(MONDAY, 1L, "Plan", null, null,
                List.of(task()),
                List.of(new BlockerRequest("First", true), new BlockerRequest("Second", true)),
                List.of(), List.of());

        // "At most one key issue for the week" is a rule about the set, so bean validation on
        // an individual row cannot express it.
        assertThrows(InvalidReportContentException.class,
                () -> reportService.createDraft(request, alice));
    }

    @Test
    void createDraftRefusesTwoKeyAchievements() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(false);
        CreateReportRequest request = new CreateReportRequest(MONDAY, 1L, "Plan", null, null,
                List.of(task()), List.of(),
                List.of(new AchievementRequest("First", true), new AchievementRequest("Second", true)),
                List.of());

        assertThrows(InvalidReportContentException.class,
                () -> reportService.createDraft(request, alice));
    }

    @Test
    void createDraftRefusesADuplicatedTaskType() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(false);
        CreateReportRequest request = new CreateReportRequest(MONDAY, 1L, "Plan", null, null,
                List.of(task()), List.of(), List.of(),
                List.of(new HoursEntryRequest(TaskType.DEVELOPMENT, new BigDecimal("6.00")),
                        new HoursEntryRequest(TaskType.DEVELOPMENT, new BigDecimal("2.00"))));

        // Two rows for Development would make "hours by task type" ambiguous.
        assertThrows(InvalidReportContentException.class,
                () -> reportService.createDraft(request, alice));
    }

    @Test
    void createDraftRefusesAnInactiveProject() {
        Mockito.when(reportRepository.existsByUserIdAndWeekStart(1L, MONDAY)).thenReturn(false);
        Mockito.when(projectService.requireActive(9L))
                .thenThrow(new com.technical.task.weeklyreportbackend.exception.ProjectNotFoundException());

        CreateReportRequest request = new CreateReportRequest(MONDAY, 9L, "Plan", null, null,
                List.of(task()), List.of(), List.of(), List.of());

        assertThrows(com.technical.task.weeklyreportbackend.exception.ProjectNotFoundException.class,
                () -> reportService.createDraft(request, alice));
        Mockito.verify(reportRepository, Mockito.never()).save(any());
    }

    // ---- updateReport ----

    private UpdateReportRequest updateRequest(Long projectId) {
        return new UpdateReportRequest(projectId, "Plan", null, null,
                List.of(task()), List.of(), List.of(), List.of());
    }

    @Test
    void updateEditsAnOpenDraftInPlaceWithoutCreatingAVersion() {
        Report report = report(ReportStatus.DRAFT, null);
        ReportVersion open = version(report, 1, null);
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(open));
        stubDetailBuild();

        reportService.updateReport(5L, updateRequest(1L), alice);

        ArgumentCaptor<ReportVersion> saved = ArgumentCaptor.forClass(ReportVersion.class);
        Mockito.verify(versionRepository).save(saved.capture());
        // The same instance: a draft edited ten times is still version 1.
        assertSame(open, saved.getValue());
        assertEquals(1, saved.getValue().getVersionNumber());
    }

    @Test
    void updateForksTheNextVersionOnceTheCurrentOneIsFrozen() {
        Report report = report(ReportStatus.NEEDS_CORRECTION, LocalDateTime.now());
        ReportVersion frozen = version(report, 1, LocalDateTime.now());
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(frozen));
        stubDetailBuild();

        reportService.updateReport(5L, updateRequest(1L), alice);

        ArgumentCaptor<ReportVersion> saved = ArgumentCaptor.forClass(ReportVersion.class);
        Mockito.verify(versionRepository).save(saved.capture());
        // A new row at version 2, so version 1 stays exactly as the manager reviewed it.
        assertNotSame(frozen, saved.getValue());
        assertEquals(2, saved.getValue().getVersionNumber());
        assertNull(saved.getValue().getSubmittedAt());
        assertNull(frozen.getTasksPlannedNextWeek());
    }

    @ParameterizedTest
    @EnumSource(value = ReportStatus.class, names = {"SUBMITTED", "APPROVED"})
    void updateRefusesAReportThatIsNotEditableByItsOwner(ReportStatus status) {
        Report report = report(status, LocalDateTime.now());
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);

        assertThrows(IllegalReportTransitionException.class,
                () -> reportService.updateReport(5L, updateRequest(1L), alice));
        Mockito.verifyNoInteractions(versionRepository);
    }

    @Test
    void updateAllowsRetaggingTheProjectBeforeAnythingHasBeenSubmitted() {
        Report report = report(ReportStatus.DRAFT, null);
        Project other = Project.builder().id(2L).name("Marketing").active(true).build();
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(version(report, 1, null)));
        Mockito.when(projectService.requireActive(2L)).thenReturn(other);
        stubDetailBuild();

        reportService.updateReport(5L, updateRequest(2L), alice);

        assertSame(other, report.getProject());
    }

    @Test
    void updateRefusesRetaggingTheProjectAfterASubmission() {
        // The tag lives on the report, so moving it would rewrite the context of a version
        // that has already been reviewed.
        Report report = report(ReportStatus.NEEDS_CORRECTION, LocalDateTime.now());
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(version(report, 1, LocalDateTime.now())));

        assertThrows(ProjectChangeNotAllowedException.class,
                () -> reportService.updateReport(5L, updateRequest(2L), alice));
        assertSame(clientA, report.getProject());
    }

    @Test
    void updateTouchesTheReportsTimestampSoTheEditIsVisible() {
        // Without a change on the report row itself, @PreUpdate would not fire and the list's
        // "last updated" column would not move.
        Report report = report(ReportStatus.DRAFT, null);
        report.setUpdatedAt(LocalDateTime.of(2020, 1, 1, 0, 0));
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(version(report, 1, null)));
        stubDetailBuild();

        reportService.updateReport(5L, updateRequest(1L), alice);

        assertTrue(report.getUpdatedAt().isAfter(LocalDateTime.of(2020, 1, 1, 0, 0)));
        Mockito.verify(reportRepository).save(report);
    }

    // ---- submit ----

    @Test
    void submitFreezesTheWorkingCopyAndStampsTheReport() {
        Report report = report(ReportStatus.DRAFT, null);
        ReportVersion open = version(report, 1, null);
        open.setTasksPlannedNextWeek("Next week's plan");
        open.replaceTaskEntries(List.of(
                com.technical.task.weeklyreportbackend.domain.TaskEntry.builder()
                        .displayOrder(0).taskName("Build the form")
                        .priority(TaskPriority.HIGH).status(TaskStatus.DONE)
                        .plannedPercent(100).actualPercent(100)
                        .timePlannedHours(new BigDecimal("6.00")).timeSpentHours(new BigDecimal("6.50"))
                        .build()));

        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(open));
        stubDetailBuild();

        reportService.submit(5L, alice);

        assertNotNull(open.getSubmittedAt());
        assertTrue(open.isFrozen());
        assertEquals(ReportStatus.SUBMITTED, report.getStatus());
        assertEquals(open.getSubmittedAt(), report.getLastSubmittedAt());
    }

    @Test
    void submitRefusesWhenTheCurrentVersionIsAlreadyFrozen() {
        // Only reachable in NEEDS_CORRECTION before the member has edited anything: the last
        // version is still the one the manager rejected, so there is nothing new to review.
        Report report = report(ReportStatus.NEEDS_CORRECTION, LocalDateTime.now());
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(version(report, 1, LocalDateTime.now())));

        assertThrows(ReportNotSubmittableException.class, () -> reportService.submit(5L, alice));
        assertEquals(ReportStatus.NEEDS_CORRECTION, report.getStatus());
    }

    @Test
    void submitRefusesAReportWithNoTasks() {
        Report report = report(ReportStatus.DRAFT, null);
        ReportVersion open = version(report, 1, null);
        open.setTasksPlannedNextWeek("Plan");
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(open));

        assertThrows(ReportNotSubmittableException.class, () -> reportService.submit(5L, alice));
        assertNull(open.getSubmittedAt());
    }

    @Test
    void submitRefusesAReportWithNoPlanForNextWeek() {
        Report report = report(ReportStatus.DRAFT, null);
        ReportVersion open = version(report, 1, null);
        open.replaceTaskEntries(List.of(
                com.technical.task.weeklyreportbackend.domain.TaskEntry.builder()
                        .displayOrder(0).taskName("Build the form")
                        .priority(TaskPriority.HIGH).status(TaskStatus.DONE)
                        .plannedPercent(100).actualPercent(100)
                        .timePlannedHours(new BigDecimal("6.00")).timeSpentHours(new BigDecimal("6.50"))
                        .build()));
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(open));

        assertThrows(ReportNotSubmittableException.class, () -> reportService.submit(5L, alice));
    }

    @ParameterizedTest
    @EnumSource(value = ReportStatus.class, names = {"SUBMITTED", "APPROVED"})
    void submitRefusesAReportInANonEditableStatus(ReportStatus status) {
        Report report = report(status, LocalDateTime.now());
        Mockito.when(accessGuard.requireOwnedForUpdate(5L, alice)).thenReturn(report);

        assertThrows(IllegalReportTransitionException.class, () -> reportService.submit(5L, alice));
        Mockito.verifyNoInteractions(versionRepository);
    }

    // ---- reads ----

    @Test
    void getDetailShowsTheOwnerTheirOwnCurrentVersion() {
        Report report = report(ReportStatus.NEEDS_CORRECTION, LocalDateTime.now());
        ReportVersion open = version(report, 2, null);
        Mockito.when(accessGuard.requireContentReadable(5L, alice)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, alice)).thenReturn(true);
        Mockito.when(versionRepository.findTopByReportIdOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(open));
        stubDetailBuild();

        assertSame(detail, reportService.getDetail(5L, alice));

        ArgumentCaptor<ReportVersion> content = ArgumentCaptor.forClass(ReportVersion.class);
        Mockito.verify(mapper).toDetail(any(), content.capture(), any(), anyInt(), any());
        assertSame(open, content.getValue());
    }

    @Test
    void getDetailShowsAManagerTheLatestSubmittedVersionNotACorrectionInProgress() {
        Report report = report(ReportStatus.NEEDS_CORRECTION, LocalDateTime.now());
        ReportVersion frozen = version(report, 1, LocalDateTime.now());
        Mockito.when(accessGuard.requireContentReadable(5L, manager)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);
        Mockito.when(versionRepository.findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(frozen));
        stubDetailBuild();

        reportService.getDetail(5L, manager);

        ArgumentCaptor<ReportVersion> content = ArgumentCaptor.forClass(ReportVersion.class);
        Mockito.verify(mapper).toDetail(any(), content.capture(), any(), anyInt(), any());
        // Version 1, the one they reviewed - not the half-finished version 2.
        assertSame(frozen, content.getValue());
        Mockito.verify(versionRepository, Mockito.never())
                .findTopByReportIdOrderByVersionNumberDesc(anyLong());
    }

    @Test
    void getVersionRefusesAnUnsubmittedWorkingCopy() {
        Report report = report(ReportStatus.NEEDS_CORRECTION, LocalDateTime.now());
        Mockito.when(accessGuard.requireContentReadable(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findByReportIdAndVersionNumber(5L, 2))
                .thenReturn(Optional.of(version(report, 2, null)));

        // Addressable by nobody through this endpoint, including its owner - they read it via
        // the report detail instead, so the version history only ever lists frozen snapshots.
        assertThrows(ReportNotFoundException.class, () -> reportService.getVersion(5L, 2, alice));
    }

    @Test
    void getVersionRejectsAVersionNumberThatDoesNotExist() {
        Report report = report(ReportStatus.APPROVED, LocalDateTime.now());
        Mockito.when(accessGuard.requireContentReadable(5L, alice)).thenReturn(report);
        Mockito.when(versionRepository.findByReportIdAndVersionNumber(5L, 9))
                .thenReturn(Optional.empty());

        assertThrows(ReportNotFoundException.class, () -> reportService.getVersion(5L, 9, alice));
    }

    @Test
    void listVersionsReturnsFrozenSnapshotsOnly() {
        Report report = report(ReportStatus.APPROVED, LocalDateTime.now());
        Mockito.when(accessGuard.requireContentReadable(5L, alice)).thenReturn(report);
        Mockito.when(reviewCommentRepository.findByReportVersionReportIdOrderByCreatedAtDescIdDesc(5L))
                .thenReturn(List.of());
        Mockito.when(versionRepository.findByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(List.of(version(report, 2, LocalDateTime.now()),
                        version(report, 1, LocalDateTime.now())));
        Mockito.when(mapper.toVersionSummary(any(), any())).thenReturn(null);

        assertEquals(2, reportService.listVersions(5L, alice).size());
        // The finder itself filters on submittedAt, so an open working copy can never appear.
        Mockito.verify(versionRepository)
                .findByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L);
    }

    @Test
    void listMineFiltersByTheCallerRatherThanByAnyRequestedUser() {
        Pageable pageable = PageRequest.of(0, 20, Sort.by("weekStart"));
        Mockito.when(reportRepository.findAll(
                        org.mockito.ArgumentMatchers.<Specification<Report>>any(),
                        any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        PageResponse<ReportSummaryResponse> response =
                reportService.listMine(alice, null, null, null, null, null, pageable);

        assertEquals(0, response.totalElements());
        assertTrue(response.content().isEmpty());
    }

    @Test
    void listTeamPagesThroughEveryUsersReports() {
        Pageable pageable = PageRequest.of(0, 1, Sort.by("weekStart"));
        Report first = report(ReportStatus.SUBMITTED, LocalDateTime.now());
        Mockito.when(reportRepository.findAll(
                        org.mockito.ArgumentMatchers.<Specification<Report>>any(),
                        any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(first), pageable, 3));
        Mockito.when(mapper.toSummary(first)).thenReturn(null);

        PageResponse<ReportSummaryResponse> response =
                reportService.listTeam(null, null, null, null, null, null, pageable);

        assertEquals(3, response.totalElements());
        assertEquals(3, response.totalPages());
        assertTrue(response.first());
        assertFalse(response.last());
    }

    // ---- weekStatus: the brief's fifth state ----

    @Test
    void weekStatusIncludesUsersWithNoReportAtAll() {
        Report aliceReport = report(ReportStatus.SUBMITTED, LocalDateTime.now());
        Mockito.when(reportRepository.findByWeekStart(MONDAY)).thenReturn(List.of(aliceReport));
        Mockito.when(userRepository.findAll(any(Sort.class))).thenReturn(List.of(alice, manager));
        Mockito.when(mapper.toUserSummary(alice)).thenReturn(new UserSummaryResponse(1L, "Alice Member"));
        Mockito.when(mapper.toUserSummary(manager)).thenReturn(new UserSummaryResponse(3L, "Mia Manager"));

        // Starts from the user list rather than the report list, which is the only way a
        // member with nothing filed can get a row at all.
        List<WeekStatusResponse> rows = reportService.weekStatus(WEDNESDAY);

        assertEquals(2, rows.size());
        assertEquals(ReportStatus.SUBMITTED, rows.get(0).status());
        assertEquals(5L, rows.get(0).reportId());
        // "Not started" is a null status and a null id - it is the absence of a row, so it
        // cannot be a value of the status enum.
        assertNull(rows.get(1).status());
        assertNull(rows.get(1).reportId());
    }

    @Test
    void weekStatusNormalisesTheWeekItIsAskedAbout() {
        Mockito.when(reportRepository.findByWeekStart(MONDAY)).thenReturn(List.of());
        Mockito.when(userRepository.findAll(any(Sort.class))).thenReturn(List.of());

        reportService.weekStatus(WEDNESDAY);

        Mockito.verify(reportRepository).findByWeekStart(MONDAY);
    }
}
