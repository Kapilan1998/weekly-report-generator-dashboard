package com.technical.task.weeklyreportbackend.mapper;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AchievementResponse;
import com.technical.task.weeklyreportbackend.dto.BlockerResponse;
import com.technical.task.weeklyreportbackend.dto.HoursEntryResponse;
import com.technical.task.weeklyreportbackend.dto.ProjectSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.ReportContentResponse;
import com.technical.task.weeklyreportbackend.dto.ReportDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.ReportVersionDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportVersionSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.ReviewCommentResponse;
import com.technical.task.weeklyreportbackend.dto.TaskEntryResponse;
import com.technical.task.weeklyreportbackend.dto.UserSummaryResponse;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Entity to DTO mapping. Every method is called from inside a read-only transaction, since
 * open-in-view is disabled and the lazy to-ones and child collections are touched here.
 *
 * <p>The calling user is passed in explicitly rather than read from the security context:
 * {@code editable} and {@code reviewable} are per-caller, and a mapper reaching into
 * SecurityContextHolder would hide that.
 */
@Component
public class ReportMapper {

    public UserSummaryResponse toUserSummary(User user) {
        return new UserSummaryResponse(user.getId(), user.getName());
    }

    public ProjectSummaryResponse toProjectSummary(Project project) {
        return new ProjectSummaryResponse(project.getId(), project.getName());
    }

    public ReportContentResponse toContent(ReportVersion version) {
        if (version == null) {
            return null;
        }
        List<TaskEntryResponse> tasks = version.getTaskEntries().stream()
                .map(task -> new TaskEntryResponse(
                        task.getId(),
                        task.getDisplayOrder(),
                        task.getTaskName(),
                        task.getPriority(),
                        task.getStatus(),
                        task.getPlannedPercent(),
                        task.getActualPercent(),
                        task.getTimePlannedHours(),
                        task.getTimeSpentHours(),
                        task.getOutputDeliverable()))
                .toList();

        List<BlockerResponse> blockers = version.getBlockers().stream()
                .map(blocker -> new BlockerResponse(
                        blocker.getId(),
                        blocker.getDisplayOrder(),
                        blocker.getDescription(),
                        blocker.isKeyIssue()))
                .toList();

        List<AchievementResponse> achievements = version.getAchievements().stream()
                .map(achievement -> new AchievementResponse(
                        achievement.getId(),
                        achievement.getDisplayOrder(),
                        achievement.getDescription(),
                        achievement.isKeyAchievement()))
                .toList();

        // Ordered by the fixed TaskType enum order rather than by an ordering column.
        List<HoursEntryResponse> hours = version.getHoursEntries().stream()
                .sorted(Comparator.comparing(entry -> entry.getTaskType().ordinal()))
                .map(entry -> new HoursEntryResponse(entry.getTaskType(), entry.getHours()))
                .toList();

        return new ReportContentResponse(
                version.getVersionNumber(),
                version.getSubmittedAt(),
                version.getTasksPlannedNextWeek(),
                version.getNotes(),
                version.getLinks(),
                tasks,
                blockers,
                achievements,
                hours);
    }

    public ReviewCommentResponse toReviewComment(ReviewComment comment) {
        return new ReviewCommentResponse(
                comment.getId(),
                comment.getReportVersion().getVersionNumber(),
                toUserSummary(comment.getReviewer()),
                comment.getAction(),
                comment.getComment(),
                comment.getCreatedAt());
    }

    public ReportSummaryResponse toSummary(Report report) {
        return new ReportSummaryResponse(
                report.getId(),
                toUserSummary(report.getUser()),
                toProjectSummary(report.getProject()),
                report.getWeekStart(),
                report.getWeekEnd(),
                report.getStatus(),
                report.getLastSubmittedAt(),
                report.getUpdatedAt());
    }

    public ReportDetailResponse toDetail(
            Report report,
            ReportVersion content,
            List<ReviewComment> history,
            int submittedVersionCount,
            User actor
    ) {
        boolean isOwner = report.getUser().getId().equals(actor.getId());
        boolean isManager = actor.getRole() == Role.MANAGER;

        List<ReviewCommentResponse> reviewHistory = history.stream().map(this::toReviewComment).toList();

        return new ReportDetailResponse(
                report.getId(),
                toUserSummary(report.getUser()),
                toProjectSummary(report.getProject()),
                report.getWeekStart(),
                report.getWeekEnd(),
                report.getStatus(),
                report.getLastSubmittedAt(),
                report.getCreatedAt(),
                report.getUpdatedAt(),
                toContent(content),
                reviewHistory.isEmpty() ? null : reviewHistory.get(0),
                reviewHistory,
                submittedVersionCount,
                isOwner && report.getStatus().isEditableByOwner(),
                isManager && !isOwner && report.getStatus() == ReportStatus.SUBMITTED);
    }

    public ReportVersionSummaryResponse toVersionSummary(ReportVersion version, List<ReviewComment> reviews) {
        return new ReportVersionSummaryResponse(
                version.getVersionNumber(),
                version.getSubmittedAt(),
                reviews.stream().map(this::toReviewComment).toList());
    }

    public ReportVersionDetailResponse toVersionDetail(
            Report report,
            ReportVersion version,
            List<ReviewComment> reviews
    ) {
        return new ReportVersionDetailResponse(
                report.getId(),
                toUserSummary(report.getUser()),
                toProjectSummary(report.getProject()),
                report.getWeekStart(),
                report.getWeekEnd(),
                report.getStatus(),
                toContent(version),
                reviews.stream().map(this::toReviewComment).toList());
    }
}
