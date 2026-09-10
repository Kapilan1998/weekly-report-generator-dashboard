package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Achievement;
import com.technical.task.weeklyreportbackend.domain.Blocker;
import com.technical.task.weeklyreportbackend.domain.HoursEntry;
import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import com.technical.task.weeklyreportbackend.domain.TaskEntry;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AchievementRequest;
import com.technical.task.weeklyreportbackend.dto.BlockerRequest;
import com.technical.task.weeklyreportbackend.dto.CreateReportRequest;
import com.technical.task.weeklyreportbackend.dto.HoursEntryRequest;
import com.technical.task.weeklyreportbackend.dto.PageResponse;
import com.technical.task.weeklyreportbackend.dto.ReportDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.ReportVersionDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportVersionSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.TaskEntryRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateReportRequest;
import com.technical.task.weeklyreportbackend.dto.WeekStatusResponse;
import com.technical.task.weeklyreportbackend.exception.DuplicateReportException;
import com.technical.task.weeklyreportbackend.exception.IllegalReportTransitionException;
import com.technical.task.weeklyreportbackend.exception.InvalidReportContentException;
import com.technical.task.weeklyreportbackend.exception.ProjectChangeNotAllowedException;
import com.technical.task.weeklyreportbackend.exception.ReportNotDeletableException;
import com.technical.task.weeklyreportbackend.exception.ReportNotFoundException;
import com.technical.task.weeklyreportbackend.exception.ReportNotSubmittableException;
import com.technical.task.weeklyreportbackend.mapper.ReportMapper;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReportSpecifications;
import com.technical.task.weeklyreportbackend.repository.ReportVersionRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The report lifecycle.
 *
 * <p>Versioning model (see docs/PHASE2_SPEC.md): draft content is mutated in place, submit
 * freezes the open version, and the owner's first edit <em>after</em> a freeze forks a new
 * version populated from the request. A frozen version is never written again, which is
 * what keeps earlier submissions visible through a correction cycle.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final ReportVersionRepository versionRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final ReportAccessGuard accessGuard;
    private final ReportMapper mapper;

    @Transactional
    public ReportDetailResponse createDraft(CreateReportRequest request, User actor) {
        LocalDate weekStart = normalizeToMonday(request.weekStart());

        if (reportRepository.existsByUserIdAndWeekStart(actor.getId(), weekStart)) {
            throw new DuplicateReportException(weekStart);
        }

        validateContent(request.blockers(), request.achievements(), request.hours());
        Project project = projectService.requireActive(request.projectId());

        Report report = reportRepository.save(Report.builder()
                .user(actor)
                .project(project)
                .weekStart(weekStart)
                .weekEnd(weekStart.plusDays(6))
                .status(ReportStatus.DRAFT)
                .build());

        ReportVersion version = ReportVersion.builder()
                .report(report)
                .versionNumber(1)
                .build();
        applyContent(version, request.tasksPlannedNextWeek(), request.notes(), request.links(),
                request.tasks(), request.blockers(), request.achievements(), request.hours());
        versionRepository.save(version);

        return buildDetail(report, version, actor);
    }

    @Transactional
    public ReportDetailResponse updateReport(Long reportId, UpdateReportRequest request, User actor) {
        // Ownership first, workflow state second - never the other way round.
        Report report = accessGuard.requireOwnedForUpdate(reportId, actor);

        if (!report.getStatus().isEditableByOwner()) {
            throw new IllegalReportTransitionException(report.getStatus(), "edited");
        }

        validateContent(request.blockers(), request.achievements(), request.hours());

        ReportVersion current = currentVersion(reportId);

        if (!report.getProject().getId().equals(request.projectId())) {
            // The tag lives on the report, so changing it after a submission would rewrite the
            // context of a version that has already been reviewed.
            if (report.getLastSubmittedAt() != null) {
                throw new ProjectChangeNotAllowedException();
            }
            report.setProject(projectService.requireActive(request.projectId()));
        }

        ReportVersion target = current.isFrozen() ? forkFrom(report, current) : current;

        applyContent(target, request.tasksPlannedNextWeek(), request.notes(), request.links(),
                request.tasks(), request.blockers(), request.achievements(), request.hours());
        versionRepository.save(target);

        // Set explicitly: without a change on the report itself, @PreUpdate would not fire and
        // the report's updatedAt would not reflect the edit.
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.save(report);

        return buildDetail(report, target, actor);
    }

    @Transactional
    public ReportDetailResponse submit(Long reportId, User actor) {
        Report report = accessGuard.requireOwnedForUpdate(reportId, actor);

        if (!report.getStatus().isEditableByOwner()) {
            throw new IllegalReportTransitionException(report.getStatus(), "submitted");
        }

        ReportVersion current = currentVersion(reportId);
        if (current.isFrozen()) {
            // Only reachable in NEEDS_CORRECTION before the member has edited anything: the last
            // version is still the one the manager rejected, so there is nothing new to review.
            throw new ReportNotSubmittableException("no changes have been made since the last submission");
        }
        requireComplete(current);

        LocalDateTime now = LocalDateTime.now();
        current.setSubmittedAt(now);
        versionRepository.save(current);

        report.setStatus(ReportStatus.SUBMITTED);
        report.setLastSubmittedAt(now);
        reportRepository.save(report);

        return buildDetail(report, current, actor);
    }

    /**
     * Deletes one of the caller's own drafts, and nothing else.
     *
     * <h2>Why only a draft</h2>
     * A draft is private working notes: nobody else has ever seen it, no manager has acted on
     * it, and it has no frozen versions and no review comments. Removing one destroys nothing
     * anybody relies on.
     *
     * <p>Everything past that point is part of the review record. Once a report is submitted
     * it may carry an approval, a correction request, and a version history a manager can
     * still open — deleting it would let an author erase a decision made about their work,
     * and would silently move the dashboard's compliance figures for a past week. This is the
     * same line {@code UserAdminService} draws for accounts: a user with reports can only be
     * disabled, never deleted, because their authorship is part of the record.
     *
     * <h2>The status check is belt and braces</h2>
     * No transition in this application ever sets a report back to {@code DRAFT} — the status
     * only moves forward — so {@code DRAFT} already implies "never submitted". The
     * {@code lastSubmittedAt} check therefore cannot fire today; it is here so that if a
     * future "unsubmit" or "withdraw" action is ever added, this method fails closed instead
     * of quietly becoming a way to delete reviewed work.
     *
     * <h2>Children</h2>
     * Every foreign key from {@code report_versions} down to the task, blocker, achievement,
     * hours and review-comment tables is declared {@code ON DELETE CASCADE} in {@code V2}, so
     * one delete is enough. Deleting the rows here in Java as well would duplicate a rule the
     * schema already owns, and get out of step the first time a child table is added.
     */
    @Transactional
    public void delete(Long reportId, User actor) {
        // Locked and owner-checked by the same guard every mutating path uses: a peer's report
        // is a 404, so ids cannot be probed through this endpoint either.
        Report report = accessGuard.requireOwnedForUpdate(reportId, actor);

        if (report.getStatus() != ReportStatus.DRAFT || report.getLastSubmittedAt() != null) {
            throw new ReportNotDeletableException();
        }

        reportRepository.delete(report);
    }

    @Transactional(readOnly = true)
    public ReportDetailResponse getDetail(Long reportId, User actor) {
        Report report = accessGuard.requireContentReadable(reportId, actor);
        return buildDetail(report, contentVersionFor(report, actor), actor);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReportSummaryResponse> listMine(
            User actor,
            Long projectId,
            List<ReportStatus> statuses,
            LocalDate weekStart,
            LocalDate weekFrom,
            LocalDate weekTo,
            Pageable pageable
    ) {
        Specification<Report> specification = ReportSpecifications.ownedBy(actor.getId())
                .and(ReportSpecifications.forProject(projectId))
                .and(ReportSpecifications.statusIn(statuses))
                .and(ReportSpecifications.forWeek(weekStart))
                .and(ReportSpecifications.weekOverlaps(weekFrom, weekTo));

        return PageResponse.from(reportRepository.findAll(specification, pageable), mapper::toSummary);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReportSummaryResponse> listTeam(
            Long userId,
            Long projectId,
            List<ReportStatus> statuses,
            LocalDate weekStart,
            LocalDate weekFrom,
            LocalDate weekTo,
            Pageable pageable
    ) {
        Specification<Report> specification = ReportSpecifications.forUser(userId)
                .and(ReportSpecifications.forProject(projectId))
                .and(ReportSpecifications.statusIn(statuses))
                .and(ReportSpecifications.forWeek(weekStart))
                .and(ReportSpecifications.weekOverlaps(weekFrom, weekTo));

        return PageResponse.from(reportRepository.findAll(specification, pageable), mapper::toSummary);
    }

    /** Submitted snapshots only — the open working copy is not a version in the history sense. */
    @Transactional(readOnly = true)
    public List<ReportVersionSummaryResponse> listVersions(Long reportId, User actor) {
        accessGuard.requireContentReadable(reportId, actor);

        Map<Integer, List<ReviewComment>> reviewsByVersion =
                reviewCommentRepository.findByReportVersionReportIdOrderByCreatedAtDescIdDesc(reportId).stream()
                        .collect(Collectors.groupingBy(comment -> comment.getReportVersion().getVersionNumber()));

        return versionRepository.findByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(reportId).stream()
                .map(version -> mapper.toVersionSummary(
                        version,
                        reviewsByVersion.getOrDefault(version.getVersionNumber(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public ReportVersionDetailResponse getVersion(Long reportId, Integer versionNumber, User actor) {
        Report report = accessGuard.requireContentReadable(reportId, actor);

        ReportVersion version = versionRepository.findByReportIdAndVersionNumber(reportId, versionNumber)
                .orElseThrow(ReportNotFoundException::new);

        // An unsubmitted working copy is addressable by nobody, including its owner, through
        // this endpoint - the owner reads it via the report detail instead.
        if (!version.isFrozen()) {
            throw new ReportNotFoundException();
        }

        List<ReviewComment> reviews = reviewCommentRepository
                .findByReportVersionReportIdOrderByCreatedAtDescIdDesc(reportId).stream()
                .filter(comment -> comment.getReportVersion().getVersionNumber().equals(versionNumber))
                .toList();

        return mapper.toVersionDetail(report, version, reviews);
    }

    /**
     * One row per user for the given week, including users with no report at all — the
     * brief's "not yet started" state, which cannot be expressed as a status value because
     * it is the absence of a row.
     */
    @Transactional(readOnly = true)
    public List<WeekStatusResponse> weekStatus(LocalDate weekStart) {
        LocalDate monday = normalizeToMonday(weekStart);

        Map<Long, Report> reportsByUser = reportRepository.findByWeekStart(monday).stream()
                .collect(Collectors.toMap(report -> report.getUser().getId(), Function.identity()));

        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(user -> {
                    Report report = reportsByUser.get(user.getId());
                    return new WeekStatusResponse(
                            mapper.toUserSummary(user),
                            report == null ? null : report.getId(),
                            report == null ? null : report.getStatus());
                })
                .toList();
    }

    // ---------------------------------------------------------------------------------------
    // internals
    // ---------------------------------------------------------------------------------------

    /**
     * Any date inside the intended week is accepted and pinned to that week's Monday.
     * Normalizing rather than rejecting non-Mondays is what makes the one-report-per-week
     * unique constraint unbypassable: two different anchor dates cannot produce two rows.
     */
    private LocalDate normalizeToMonday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private ReportVersion currentVersion(Long reportId) {
        return versionRepository.findTopByReportIdOrderByVersionNumberDesc(reportId)
                .orElseThrow(ReportNotFoundException::new);
    }

    /** The version whose content this caller is allowed to see. */
    private ReportVersion contentVersionFor(Report report, User actor) {
        if (accessGuard.isOwner(report, actor)) {
            return currentVersion(report.getId());
        }
        // A manager reads the latest submitted version, never a correction in progress.
        return versionRepository
                .findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(report.getId())
                .orElseThrow(ReportNotFoundException::new);
    }

    private ReportVersion forkFrom(Report report, ReportVersion frozen) {
        return ReportVersion.builder()
                .report(report)
                .versionNumber(frozen.getVersionNumber() + 1)
                .build();
    }

    private ReportDetailResponse buildDetail(Report report, ReportVersion content, User actor) {
        List<ReviewComment> history =
                reviewCommentRepository.findByReportVersionReportIdOrderByCreatedAtDescIdDesc(report.getId());
        int submittedCount = versionRepository
                .findByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(report.getId()).size();
        return mapper.toDetail(report, content, history, submittedCount, actor);
    }

    private void requireComplete(ReportVersion version) {
        if (version.getTaskEntries().isEmpty()) {
            throw new ReportNotSubmittableException("add at least one completed task");
        }
        if (version.getTasksPlannedNextWeek() == null || version.getTasksPlannedNextWeek().isBlank()) {
            throw new ReportNotSubmittableException("fill in the tasks planned for next week");
        }
    }

    /**
     * Cross-item rules a field annotation cannot express: exactly one blocker may be flagged
     * as the week's key issue, one achievement as the key achievement, and a task type may
     * appear at most once in the hours breakdown.
     */
    private void validateContent(
            List<BlockerRequest> blockers,
            List<AchievementRequest> achievements,
            List<HoursEntryRequest> hours
    ) {
        if (blockers != null && blockers.stream().filter(b -> Boolean.TRUE.equals(b.keyIssue())).count() > 1) {
            throw new InvalidReportContentException("Only one blocker can be flagged as the key issue for the week");
        }
        if (achievements != null
                && achievements.stream().filter(a -> Boolean.TRUE.equals(a.keyAchievement())).count() > 1) {
            throw new InvalidReportContentException(
                    "Only one achievement can be flagged as the key achievement for the week");
        }
        if (hours != null) {
            Set<Object> seen = new HashSet<>();
            boolean duplicated = hours.stream().anyMatch(entry -> !seen.add(entry.taskType()));
            if (duplicated) {
                throw new InvalidReportContentException("Each task type can appear only once in the hours breakdown");
            }
        }
    }

    private void applyContent(
            ReportVersion version,
            String tasksPlannedNextWeek,
            String notes,
            String links,
            List<TaskEntryRequest> tasks,
            List<BlockerRequest> blockers,
            List<AchievementRequest> achievements,
            List<HoursEntryRequest> hours
    ) {
        version.setTasksPlannedNextWeek(tasksPlannedNextWeek);
        version.setNotes(notes);
        version.setLinks(links);

        List<TaskEntry> taskEntries = new ArrayList<>();
        if (tasks != null) {
            for (int index = 0; index < tasks.size(); index++) {
                TaskEntryRequest request = tasks.get(index);
                taskEntries.add(TaskEntry.builder()
                        .displayOrder(index)
                        .taskName(request.taskName())
                        .priority(request.priority())
                        .status(request.status())
                        .plannedPercent(request.plannedPercent())
                        .actualPercent(request.actualPercent())
                        .timePlannedHours(request.timePlannedHours())
                        .timeSpentHours(request.timeSpentHours())
                        .outputDeliverable(request.outputDeliverable())
                        .build());
            }
        }
        version.replaceTaskEntries(taskEntries);

        List<Blocker> blockerEntities = new ArrayList<>();
        if (blockers != null) {
            for (int index = 0; index < blockers.size(); index++) {
                BlockerRequest request = blockers.get(index);
                blockerEntities.add(Blocker.builder()
                        .displayOrder(index)
                        .description(request.description())
                        .keyIssue(Boolean.TRUE.equals(request.keyIssue()))
                        .build());
            }
        }
        version.replaceBlockers(blockerEntities);

        List<Achievement> achievementEntities = new ArrayList<>();
        if (achievements != null) {
            for (int index = 0; index < achievements.size(); index++) {
                AchievementRequest request = achievements.get(index);
                achievementEntities.add(Achievement.builder()
                        .displayOrder(index)
                        .description(request.description())
                        .keyAchievement(Boolean.TRUE.equals(request.keyAchievement()))
                        .build());
            }
        }
        version.replaceAchievements(achievementEntities);

        List<HoursEntry> hoursEntities = new ArrayList<>();
        if (hours != null) {
            hours.stream()
                    .sorted(Comparator.comparing(entry -> entry.taskType().ordinal()))
                    .forEach(entry -> hoursEntities.add(HoursEntry.builder()
                            .taskType(entry.taskType())
                            .hours(entry.hours())
                            .build()));
        }
        version.replaceHoursEntries(hoursEntities);
    }
}
