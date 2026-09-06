package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.exception.InvalidSortPropertyException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Validates client-supplied sort properties for the report list endpoints.
 *
 * <p>This is a security control, not a typo guard. Spring Data resolves a dotted sort
 * property into a join and will order by any mapped attribute, so an unvalidated
 * {@code ?sort=user.passwordHash,asc} orders rows by another user's password hash and leaks
 * information through the ordering itself. Matching is exact on the full dotted path — a
 * prefix or first-segment check would not be enough.
 */
final class ReportSortWhitelist {

    private static final Set<String> ALLOWED = Set.of(
            "id",
            "weekStart",
            "weekEnd",
            "status",
            "createdAt",
            "updatedAt",
            "lastSubmittedAt",
            "user.name",
            "project.name"
    );

    /** A caller could otherwise send dozens of sort params and force a join per order. */
    private static final int MAX_ORDERS = 3;

    private ReportSortWhitelist() {
    }

    static Pageable sanitize(Pageable pageable) {
        Sort sort = pageable.getSort();

        if (sort.stream().count() > MAX_ORDERS) {
            throw new InvalidSortPropertyException("too many sort parameters");
        }
        sort.forEach(order -> {
            if (!ALLOWED.contains(order.getProperty())) {
                throw new InvalidSortPropertyException(order.getProperty());
            }
        });

        // Always tie-break on id: with a whole team filing the same week, a single-property
        // sort ties on every row and MySQL's ordering between pages is unspecified, so paging
        // would skip and duplicate rows.
        Sort deterministic = sort.and(Sort.by(Sort.Direction.DESC, "id"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), deterministic);
    }
}
