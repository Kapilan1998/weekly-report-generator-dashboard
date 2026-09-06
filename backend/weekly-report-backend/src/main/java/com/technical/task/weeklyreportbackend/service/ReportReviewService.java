package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.ReviewAction;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The manager side of the review cycle.
 *
 * <p>This class deliberately has no dependency that can write report content — it inserts
 * {@link ReviewComment} rows and updates {@link Report#getStatus()}, and nothing else. The
 * assignment's "managers must only be able to edit the status/comment fields, not rewrite
 * the team member's report content" is therefore a property of the class graph rather than
 * a rule someone has to remember.
 *
 * <p>Requesting changes creates no new version: the member's next edit forks one. That is
 * what keeps the manager's write surface this small.
 */
@Service
@RequiredArgsConstructor
public class ReportReviewService {

    private final ReportRepository reportRepository;
    private final ReportVersionRepository versionRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final ReportAccessGuard accessGuard;
    private final ReportService reportService;

    @Transactional
    public ReportDetailResponse approve(Long reportId, ApproveRequest request, User actor) {
        Report report = loadReviewable(reportId, actor);
        ReportVersion reviewed = submittedVersion(reportId);

        record(reviewed, actor, ReviewAction.APPROVE, request.comment());

        report.setStatus(ReportStatus.APPROVED);
        reportRepository.save(report);

        return reportService.getDetail(reportId, actor);
    }

    @Transactional
    public ReportDetailResponse requestChanges(Long reportId, RequestChangesRequest request, User actor) {
        Report report = loadReviewable(reportId, actor);
        ReportVersion reviewed = submittedVersion(reportId);

        record(reviewed, actor, ReviewAction.REQUEST_CHANGES, request.comment());

        report.setStatus(ReportStatus.NEEDS_CORRECTION);
        reportRepository.save(report);

        return reportService.getDetail(reportId, actor);
    }

    /**
     * Authorization before workflow state, as everywhere else: a manager reviewing their own
     * report is refused before the status is even considered.
     */
    private Report loadReviewable(Long reportId, User actor) {
        Report report = accessGuard.requireReviewableForUpdate(reportId);

        if (accessGuard.isOwner(report, actor)) {
            throw new SelfReviewNotAllowedException();
        }
        if (report.getStatus() != ReportStatus.SUBMITTED) {
            throw new IllegalReportTransitionException(report.getStatus(), "reviewed");
        }
        return report;
    }

    /** The version under review is the latest frozen one, which a SUBMITTED report always has. */
    private ReportVersion submittedVersion(Long reportId) {
        return versionRepository
                .findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(reportId)
                .orElseThrow(ReportNotFoundException::new);
    }

    private void record(ReportVersion version, User reviewer, ReviewAction action, String comment) {
        reviewCommentRepository.save(ReviewComment.builder()
                .reportVersion(version)
                .reviewer(reviewer)
                .action(action)
                .comment(comment)
                .build());
    }
}
