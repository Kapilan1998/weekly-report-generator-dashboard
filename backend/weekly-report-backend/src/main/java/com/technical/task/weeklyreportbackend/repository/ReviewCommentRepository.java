package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewCommentRepository extends JpaRepository<ReviewComment, Long> {

    /**
     * Ordered by created_at DESC, id DESC — the id tiebreaker matters because two review
     * actions can land in the same instant (a double-click, or a seed script running a whole
     * cycle back to back), and without it "the latest comment" is non-deterministic.
     */
    @EntityGraph(attributePaths = {"reviewer", "reportVersion"})
    List<ReviewComment> findByReportVersionReportIdOrderByCreatedAtDescIdDesc(Long reportId);

    @EntityGraph(attributePaths = {"reviewer", "reportVersion"})
    Optional<ReviewComment> findTopByReportVersionReportIdOrderByCreatedAtDescIdDesc(Long reportId);

    /**
     * Recent review actions for the dashboard activity feed. The graph reaches through to the
     * report's owner and project because the feed renders all three, and lazy-loading them
     * per row would be an N+1 with open-in-view disabled.
     */
    @EntityGraph(attributePaths = {
            "reviewer",
            "reportVersion",
            "reportVersion.report",
            "reportVersion.report.user",
            "reportVersion.report.project"
    })
    List<ReviewComment> findTop20ByOrderByCreatedAtDescIdDesc();
}
