package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.exception.DraftNotVisibleException;
import com.technical.task.weeklyreportbackend.exception.ReportNotFoundException;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The single place report-level authorization decisions are made.
 *
 * <p>Role checks alone cannot express these rules: two team members hold the same role, so
 * "only your own reports" has to be an ownership check, separate from
 * {@code @PreAuthorize}.
 *
 * <p><strong>Guard order matters.</strong> Every caller resolves visibility/ownership here
 * <em>before</em> checking workflow status. Reversed, the status check becomes an oracle —
 * a caller probing someone else's report id would get "409 report is APPROVED" for a real
 * one and 404 for a fake one, disclosing both existence and state.
 */
@Component
@RequiredArgsConstructor
public class ReportAccessGuard {

    private final ReportRepository reportRepository;

    /** A report the caller may read: their own, or any report if they are a manager. */
    public Report requireReadable(Long reportId, User actor) {
        Report report = reportRepository.findById(reportId).orElseThrow(ReportNotFoundException::new);

        if (isOwner(report, actor)) {
            return report;
        }
        if (actor.getRole() != Role.MANAGER) {
            // Deliberately the same exception a missing id produces - see ReportNotFoundException.
            throw new ReportNotFoundException();
        }
        return report;
    }

    /**
     * A report whose content the caller may read. Same as {@link #requireReadable} plus:
     * a manager may not read another user's draft, which the brief keeps private to its
     * author until submitted.
     */
    public Report requireContentReadable(Long reportId, User actor) {
        Report report = requireReadable(reportId, actor);
        if (!isOwner(report, actor) && report.getStatus() == ReportStatus.DRAFT) {
            throw new DraftNotVisibleException();
        }
        return report;
    }

    /**
     * A report the caller owns, locked for update. Used by every content-mutating path so an
     * edit and a submit cannot interleave.
     */
    public Report requireOwnedForUpdate(Long reportId, User actor) {
        Report report = reportRepository.findWithLockById(reportId).orElseThrow(ReportNotFoundException::new);
        if (!isOwner(report, actor)) {
            throw new ReportNotFoundException();
        }
        return report;
    }

    /** A report a manager is about to act on, locked for update. */
    public Report requireReviewableForUpdate(Long reportId) {
        return reportRepository.findWithLockById(reportId).orElseThrow(ReportNotFoundException::new);
    }

    public boolean isOwner(Report report, User actor) {
        // Compared by id: the principal's User is detached, loaded in the JWT filter outside
        // any persistence context, and User has no equals/hashCode override.
        return report.getUser().getId().equals(actor.getId());
    }
}
