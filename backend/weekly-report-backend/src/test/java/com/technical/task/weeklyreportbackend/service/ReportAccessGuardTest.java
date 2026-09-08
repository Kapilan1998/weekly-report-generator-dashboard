package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.exception.DraftNotVisibleException;
import com.technical.task.weeklyreportbackend.exception.ReportNotFoundException;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The single place report-level authorization is decided, so this is the highest-value unit
 * test in the service package. Two properties are worth more than the rest:
 *
 * <ul>
 *   <li>A peer's report answers <strong>404, not 403</strong> — identical to a report that
 *       does not exist, so ids cannot be probed.</li>
 *   <li>Visibility is resolved <strong>before</strong> workflow status. Reversed, the status
 *       check becomes an oracle: a caller probing someone else's id would get "409, that
 *       report is approved" for a real one and 404 for a fake one.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class ReportAccessGuardTest {

    @InjectMocks
    ReportAccessGuard accessGuard;

    @Mock
    ReportRepository reportRepository;

    private final User alice = User.builder().id(1L).name("Alice Member")
            .email("alice@example.com").role(Role.TEAM_MEMBER).enabled(true).build();
    private final User bob = User.builder().id(2L).name("Bob Member")
            .email("bob@example.com").role(Role.TEAM_MEMBER).enabled(true).build();
    private final User manager = User.builder().id(3L).name("Mia Manager")
            .email("mia@example.com").role(Role.MANAGER).enabled(true).build();

    private Report reportOwnedBy(User owner, ReportStatus status) {
        return Report.builder()
                .id(5L)
                .user(owner)
                .project(Project.builder().id(1L).name("Client A").active(true).build())
                .weekStart(LocalDate.of(2026, 9, 7))
                .weekEnd(LocalDate.of(2026, 9, 13))
                .status(status)
                .build();
    }

    // ---- requireReadable ----

    @Test
    void requireReadableReturnsYourOwnReport() {
        Report report = reportOwnedBy(alice, ReportStatus.DRAFT);
        Mockito.when(reportRepository.findById(5L)).thenReturn(Optional.of(report));

        assertSame(report, accessGuard.requireReadable(5L, alice));
    }

    @Test
    void requireReadableReturnsAnyReportForAManager() {
        Report report = reportOwnedBy(alice, ReportStatus.SUBMITTED);
        Mockito.when(reportRepository.findById(5L)).thenReturn(Optional.of(report));

        assertSame(report, accessGuard.requireReadable(5L, manager));
    }

    @ParameterizedTest
    @EnumSource(ReportStatus.class)
    void requireReadableAnswers404ForAPeersReportInEveryStatus(ReportStatus status) {
        // Every status, including APPROVED: this is what pins ownership-before-status. If the
        // order flipped, one of these would start answering 409 instead.
        Mockito.when(reportRepository.findById(5L)).thenReturn(Optional.of(reportOwnedBy(alice, status)));

        assertThrows(ReportNotFoundException.class, () -> accessGuard.requireReadable(5L, bob));
    }

    @Test
    void requireReadableAnswersTheSame404ForAnIdThatDoesNotExist() {
        Mockito.when(reportRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ReportNotFoundException.class, () -> accessGuard.requireReadable(404L, bob));
    }

    // ---- requireContentReadable ----

    @Test
    void requireContentReadableLetsAnOwnerReadTheirOwnDraft() {
        Report draft = reportOwnedBy(alice, ReportStatus.DRAFT);
        Mockito.when(reportRepository.findById(5L)).thenReturn(Optional.of(draft));

        assertSame(draft, accessGuard.requireContentReadable(5L, alice));
    }

    @Test
    void requireContentReadableRefusesAManagerAnotherUsersDraft() {
        // 403 rather than 404 here, and that is not an inconsistency: the manager is allowed
        // to know the report exists - they can see it on the dashboard - just not read a draft
        // its author has not submitted.
        Mockito.when(reportRepository.findById(5L))
                .thenReturn(Optional.of(reportOwnedBy(alice, ReportStatus.DRAFT)));

        assertThrows(DraftNotVisibleException.class,
                () -> accessGuard.requireContentReadable(5L, manager));
    }

    @ParameterizedTest
    @EnumSource(value = ReportStatus.class, names = {"SUBMITTED", "NEEDS_CORRECTION", "APPROVED"})
    void requireContentReadableLetsAManagerReadAnythingOnceSubmitted(ReportStatus status) {
        Report report = reportOwnedBy(alice, status);
        Mockito.when(reportRepository.findById(5L)).thenReturn(Optional.of(report));

        assertSame(report, accessGuard.requireContentReadable(5L, manager));
    }

    @Test
    void requireContentReadableStillAnswers404ForAPeer() {
        // The draft rule must not downgrade a peer's 404 into a 403.
        Mockito.when(reportRepository.findById(5L))
                .thenReturn(Optional.of(reportOwnedBy(alice, ReportStatus.DRAFT)));

        assertThrows(ReportNotFoundException.class,
                () -> accessGuard.requireContentReadable(5L, bob));
    }

    // ---- requireOwnedForUpdate ----

    @Test
    void requireOwnedForUpdateTakesARowLock() {
        Report report = reportOwnedBy(alice, ReportStatus.DRAFT);
        Mockito.when(reportRepository.findWithLockById(5L)).thenReturn(Optional.of(report));

        assertSame(report, accessGuard.requireOwnedForUpdate(5L, alice));

        // The locking finder, not findById: an edit and a submit must not interleave and leave
        // a frozen version whose children changed after submission.
        Mockito.verify(reportRepository).findWithLockById(5L);
        Mockito.verify(reportRepository, Mockito.never()).findById(Mockito.anyLong());
    }

    @Test
    void requireOwnedForUpdateRefusesAManagerSomeoneElsesReport() {
        // Being a manager grants no write access to content - only to status and comment,
        // through the review service.
        Mockito.when(reportRepository.findWithLockById(5L))
                .thenReturn(Optional.of(reportOwnedBy(alice, ReportStatus.SUBMITTED)));

        assertThrows(ReportNotFoundException.class,
                () -> accessGuard.requireOwnedForUpdate(5L, manager));
    }

    @Test
    void requireOwnedForUpdateRefusesAPeer() {
        Mockito.when(reportRepository.findWithLockById(5L))
                .thenReturn(Optional.of(reportOwnedBy(alice, ReportStatus.DRAFT)));

        assertThrows(ReportNotFoundException.class, () -> accessGuard.requireOwnedForUpdate(5L, bob));
    }

    // ---- requireReviewableForUpdate ----

    @Test
    void requireReviewableForUpdateLocksWithoutCheckingOwnership() {
        // Ownership is not the rule on this path - self-review is, and the review service
        // applies it. This method only has to take the lock.
        Report report = reportOwnedBy(alice, ReportStatus.SUBMITTED);
        Mockito.when(reportRepository.findWithLockById(5L)).thenReturn(Optional.of(report));

        assertSame(report, accessGuard.requireReviewableForUpdate(5L));
    }

    @Test
    void requireReviewableForUpdateRejectsAMissingReport() {
        Mockito.when(reportRepository.findWithLockById(404L)).thenReturn(Optional.empty());

        assertThrows(ReportNotFoundException.class, () -> accessGuard.requireReviewableForUpdate(404L));
    }

    // ---- isOwner ----

    @Test
    void isOwnerComparesByIdRatherThanByReference() {
        // The principal's User is detached - loaded in the JWT filter outside any persistence
        // context - and User has no equals override, so a reference comparison would be false
        // for the actual owner on every single request.
        Report report = reportOwnedBy(alice, ReportStatus.DRAFT);
        User sameUserDifferentInstance = User.builder().id(1L).name("Alice Member")
                .email("alice@example.com").role(Role.TEAM_MEMBER).enabled(true).build();

        assertNotSame(alice, sameUserDifferentInstance);
        assertTrue(accessGuard.isOwner(report, sameUserDifferentInstance));
        assertFalse(accessGuard.isOwner(report, bob));
    }
}
