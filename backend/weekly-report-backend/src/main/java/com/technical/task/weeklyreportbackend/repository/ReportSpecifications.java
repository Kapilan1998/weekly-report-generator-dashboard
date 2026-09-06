package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.List;

/**
 * Filters for the report list endpoints.
 *
 * <p>An absent filter returns {@link Specification#unrestricted()}, never {@code null}.
 * Returning null was the Spring Data JPA 3.x idiom; on 4.x {@code Specification.and}/
 * {@code where} assert non-null and {@code findAll(null, pageable)} throws, so an omitted
 * filter would turn into a 500.
 */
public final class ReportSpecifications {

    private ReportSpecifications() {
    }

    public static Specification<Report> ownedBy(Long userId) {
        return (root, query, builder) -> builder.equal(root.get("user").get("id"), userId);
    }

    public static Specification<Report> forUser(Long userId) {
        if (userId == null) {
            return Specification.unrestricted();
        }
        return ownedBy(userId);
    }

    public static Specification<Report> forProject(Long projectId) {
        if (projectId == null) {
            return Specification.unrestricted();
        }
        return (root, query, builder) -> builder.equal(root.get("project").get("id"), projectId);
    }

    public static Specification<Report> statusIn(List<ReportStatus> statuses) {
        if (statuses == null || statuses.isEmpty()) {
            return Specification.unrestricted();
        }
        return (root, query, builder) -> root.get("status").in(statuses);
    }

    /** Exact-week match — the brief's "all team members' reports for a selected week". */
    public static Specification<Report> forWeek(LocalDate weekStart) {
        if (weekStart == null) {
            return Specification.unrestricted();
        }
        return (root, query, builder) -> builder.equal(root.get("weekStart"), weekStart);
    }

    /**
     * Interval overlap rather than a plain BETWEEN on week_start, so a range that partially
     * covers a week still matches it.
     */
    public static Specification<Report> weekOverlaps(LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return Specification.unrestricted();
        }
        return (root, query, builder) -> {
            if (from == null) {
                return builder.lessThanOrEqualTo(root.get("weekStart"), to);
            }
            if (to == null) {
                return builder.greaterThanOrEqualTo(root.get("weekEnd"), from);
            }
            return builder.and(
                    builder.lessThanOrEqualTo(root.get("weekStart"), to),
                    builder.greaterThanOrEqualTo(root.get("weekEnd"), from)
            );
        };
    }
}
