package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.ReviewAction;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.ApproveRequest;
import com.technical.task.weeklyreportbackend.dto.ReportDetailResponse;
import com.technical.task.weeklyreportbackend.dto.RequestChangesRequest;
import com.technical.task.weeklyreportbackend.exception.IllegalReportTransitionException;
import com.technical.task.weeklyreportbackend.exception.ReportNotFoundException;
import com.technical.task.weeklyreportbackend.exception.SelfReviewNotAllowedException;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReportVersionRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The manager side of the review cycle. Two structural properties are what these tests are
 * really for:
 *
 * <ul>
 *   <li>Requesting changes creates <strong>no new version</strong>. The author's next edit
 *       forks one — that lazy fork is what keeps the manager's write surface down to a review
 *       comment plus a status, so "managers cannot rewrite report content" holds by
 *       construction rather than by convention.</li>
 *   <li>The comment attaches to the <strong>frozen submitted version</strong>, which is what
 *       makes "which version was this comment made against" answerable at all.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class ReportReviewServiceTest {

    @InjectMocks
    ReportReviewService reviewService;

    @Mock
    ReportRepository reportRepository;

    @Mock
    ReportVersionRepository versionRepository;

    @Mock
    ReviewCommentRepository reviewCommentRepository;

    @Mock
    ReportAccessGuard accessGuard;

    @Mock
    ReportService reportService;

    @Mock
    ReportDetailResponse detail;

    private final User alice = User.builder().id(1L).name("Alice Member")
            .email("alice@example.com").role(Role.TEAM_MEMBER).enabled(true).build();
    private final User manager = User.builder().id(3L).name("Mia Manager")
            .email("mia@example.com").role(Role.MANAGER).enabled(true).build();

    private Report report(ReportStatus status) {
        return Report.builder()
                .id(5L)
                .user(alice)
                .project(Project.builder().id(1L).name("Client A").active(true).build())
                .weekStart(LocalDate.of(2026, 9, 7))
                .weekEnd(LocalDate.of(2026, 9, 13))
                .status(status)
                .lastSubmittedAt(LocalDateTime.of(2026, 9, 11, 16, 30))
                .build();
    }

    private ReportVersion frozenVersion(Report report, int number) {
        return ReportVersion.builder()
                .id(50L + number)
                .report(report)
                .versionNumber(number)
                .submittedAt(LocalDateTime.of(2026, 9, 11, 16, 30))
                .build();
    }

    // ---- approve ----

    @Test
    void approveRecordsTheDecisionAgainstTheSubmittedVersionAndSetsApproved() {
        Report report = report(ReportStatus.SUBMITTED);
        ReportVersion submitted = frozenVersion(report, 2);

        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);
        Mockito.when(versionRepository.findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(submitted));
        Mockito.when(reportService.getDetail(5L, manager)).thenReturn(detail);

        assertSame(detail, reviewService.approve(5L, new ApproveRequest("Clear and complete"), manager));

        ArgumentCaptor<ReviewComment> saved = ArgumentCaptor.forClass(ReviewComment.class);
        Mockito.verify(reviewCommentRepository).save(saved.capture());
        assertEquals(ReviewAction.APPROVE, saved.getValue().getAction());
        assertEquals("Clear and complete", saved.getValue().getComment());
        assertSame(manager, saved.getValue().getReviewer());
        // Attached to version 2, not to the report - this is what answers "which version".
        assertSame(submitted, saved.getValue().getReportVersion());

        assertEquals(ReportStatus.APPROVED, report.getStatus());
        Mockito.verify(reportRepository).save(report);
    }

    @Test
    void approveAcceptsANullComment() {
        Report report = report(ReportStatus.SUBMITTED);
        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);
        Mockito.when(versionRepository.findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(frozenVersion(report, 1)));
        Mockito.when(reportService.getDetail(5L, manager)).thenReturn(detail);

        reviewService.approve(5L, new ApproveRequest(null), manager);

        ArgumentCaptor<ReviewComment> saved = ArgumentCaptor.forClass(ReviewComment.class);
        Mockito.verify(reviewCommentRepository).save(saved.capture());
        assertNull(saved.getValue().getComment());
        assertEquals(ReportStatus.APPROVED, report.getStatus());
    }

    // ---- request changes ----

    @Test
    void requestChangesSetsNeedsCorrectionAndCreatesNoNewVersion() {
        Report report = report(ReportStatus.SUBMITTED);
        ReportVersion submitted = frozenVersion(report, 1);

        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);
        Mockito.when(versionRepository.findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(submitted));
        Mockito.when(reportService.getDetail(5L, manager)).thenReturn(detail);

        reviewService.requestChanges(5L, new RequestChangesRequest("Please split the tasks up"), manager);

        ArgumentCaptor<ReviewComment> saved = ArgumentCaptor.forClass(ReviewComment.class);
        Mockito.verify(reviewCommentRepository).save(saved.capture());
        assertEquals(ReviewAction.REQUEST_CHANGES, saved.getValue().getAction());
        assertEquals("Please split the tasks up", saved.getValue().getComment());
        assertEquals(ReportStatus.NEEDS_CORRECTION, report.getStatus());

        // The lazy fork: no version is written here. The version the manager rejected stays
        // the current one until the author edits, which is what "Edit & resubmit" relies on.
        Mockito.verify(versionRepository, Mockito.never()).save(Mockito.any());
    }

    @Test
    void requestChangesLeavesTheSubmissionTimestampAlone() {
        // lastSubmittedAt records when the member submitted, not when the manager looked at
        // it, so a review must not touch it.
        Report report = report(ReportStatus.SUBMITTED);
        LocalDateTime submittedAt = report.getLastSubmittedAt();

        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);
        Mockito.when(versionRepository.findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.of(frozenVersion(report, 1)));
        Mockito.when(reportService.getDetail(5L, manager)).thenReturn(detail);

        reviewService.requestChanges(5L, new RequestChangesRequest("Needs work"), manager);

        assertEquals(submittedAt, report.getLastSubmittedAt());
    }

    // ---- the guards ----

    @Test
    void aManagerCannotReviewTheirOwnReport() {
        Report own = report(ReportStatus.SUBMITTED);
        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(own);
        Mockito.when(accessGuard.isOwner(own, manager)).thenReturn(true);

        assertThrows(SelfReviewNotAllowedException.class,
                () -> reviewService.approve(5L, new ApproveRequest(null), manager));

        Mockito.verifyNoInteractions(reviewCommentRepository);
        Mockito.verify(reportRepository, Mockito.never()).save(Mockito.any());
    }

    @Test
    void selfReviewIsRefusedBeforeTheStatusIsEvenConsidered() {
        // Authorization before workflow state, as everywhere else - so a manager probing their
        // own draft learns nothing about its state from the error.
        Report ownDraft = report(ReportStatus.DRAFT);
        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(ownDraft);
        Mockito.when(accessGuard.isOwner(ownDraft, manager)).thenReturn(true);

        assertThrows(SelfReviewNotAllowedException.class,
                () -> reviewService.approve(5L, new ApproveRequest(null), manager));
    }

    @ParameterizedTest
    @EnumSource(value = ReportStatus.class, names = {"DRAFT", "NEEDS_CORRECTION", "APPROVED"})
    void onlyASubmittedReportCanBeReviewed(ReportStatus status) {
        Report report = report(status);
        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);

        assertThrows(IllegalReportTransitionException.class,
                () -> reviewService.approve(5L, new ApproveRequest(null), manager));
        assertEquals(status, report.getStatus());
        Mockito.verifyNoInteractions(reviewCommentRepository);
    }

    @Test
    void aSubmittedReportWithNoFrozenVersionIsTreatedAsMissing() {
        // Not reachable through the API - a SUBMITTED report always has one - so if the data
        // ever says otherwise the answer is 404 rather than a NullPointerException.
        Report report = report(ReportStatus.SUBMITTED);
        Mockito.when(accessGuard.requireReviewableForUpdate(5L)).thenReturn(report);
        Mockito.when(accessGuard.isOwner(report, manager)).thenReturn(false);
        Mockito.when(versionRepository.findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(5L))
                .thenReturn(Optional.empty());

        assertThrows(ReportNotFoundException.class,
                () -> reviewService.approve(5L, new ApproveRequest(null), manager));
    }

    @Test
    void theReviewServiceCannotReachReportContentAtAll() {
        // A design assertion rather than a behavioural one: this class is given no dependency
        // through which report content could be written. If someone injects a task or hours
        // repository here, this test is the thing that should make them stop and explain why.
        assertEquals(5, ReportReviewService.class.getDeclaredFields().length);
        java.util.List<String> fields = java.util.Arrays.stream(
                        ReportReviewService.class.getDeclaredFields())
                .map(java.lang.reflect.Field::getName)
                .toList();
        assertEquals(java.util.List.of(
                "reportRepository", "versionRepository", "reviewCommentRepository",
                "accessGuard", "reportService"), fields);
    }
}
