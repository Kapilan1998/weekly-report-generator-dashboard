package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.exception.InvalidSortPropertyException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import static org.junit.jupiter.api.Assertions.*;

/**
 * No mocks here: this is a static utility with no collaborators. It is tested all the same
 * because it is a security control rather than a typo guard — Spring Data resolves a dotted
 * sort property into a join and will order rows by any mapped attribute, so an unvalidated
 * {@code ?sort=user.passwordHash} leaks information through the ordering itself.
 */
class ReportSortWhitelistTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "id", "weekStart", "weekEnd", "status",
            "createdAt", "updatedAt", "lastSubmittedAt",
            "user.name", "project.name",
    })
    void allowsEveryWhitelistedProperty(String property) {
        Pageable sanitized = ReportSortWhitelist.sanitize(
                PageRequest.of(0, 20, Sort.by(Sort.Direction.ASC, property)));

        assertNotNull(sanitized.getSort().getOrderFor(property));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "user.passwordHash",   // the one that actually leaks
            "user.email",
            "passwordHash",
            "user",                // a first-segment check would have let this through
            "weekstart",           // matching is exact, not case-insensitive
            "week_start",
    })
    void rejectsAnythingNotOnTheList(String property) {
        Pageable pageable = PageRequest.of(0, 20, Sort.by(property));

        InvalidSortPropertyException thrown = assertThrows(InvalidSortPropertyException.class,
                () -> ReportSortWhitelist.sanitize(pageable));

        // The message names the rejected property, which is caller input - safe here because
        // it is echoed back to the caller who sent it and nothing else.
        assertTrue(thrown.getMessage().contains(property));
    }

    @Test
    void rejectsMoreThanThreeSortParameters() {
        // Otherwise a caller can force one join per order and turn a list endpoint into a
        // cheap way to load the database.
        Pageable pageable = PageRequest.of(0, 20, Sort.by("id", "weekStart", "status", "updatedAt"));

        assertThrows(InvalidSortPropertyException.class, () -> ReportSortWhitelist.sanitize(pageable));
    }

    @Test
    void allowsExactlyThreeSortParameters() {
        Pageable sanitized = ReportSortWhitelist.sanitize(
                PageRequest.of(0, 20, Sort.by("weekStart", "status", "updatedAt")));

        assertNotNull(sanitized.getSort().getOrderFor("weekStart"));
        assertNotNull(sanitized.getSort().getOrderFor("status"));
        assertNotNull(sanitized.getSort().getOrderFor("updatedAt"));
    }

    @Test
    void alwaysAppendsAnIdTiebreak() {
        // With a whole team filing the same week, a single-property sort ties on every row and
        // MySQL's ordering between pages is unspecified - so paging would skip and duplicate.
        Pageable sanitized = ReportSortWhitelist.sanitize(
                PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "weekStart")));

        Sort.Order tiebreak = sanitized.getSort().getOrderFor("id");
        assertNotNull(tiebreak);
        assertEquals(Sort.Direction.DESC, tiebreak.getDirection());

        // Appended, not substituted: the caller's own ordering still comes first.
        assertEquals("weekStart", sanitized.getSort().stream().findFirst().orElseThrow().getProperty());
    }

    @Test
    void keepsThePageNumberAndSize() {
        Pageable sanitized = ReportSortWhitelist.sanitize(
                PageRequest.of(3, 15, Sort.by("weekStart")));

        assertEquals(3, sanitized.getPageNumber());
        assertEquals(15, sanitized.getPageSize());
    }

    @Test
    void addsTheTiebreakEvenWhenNoSortWasRequested() {
        Pageable sanitized = ReportSortWhitelist.sanitize(PageRequest.of(0, 20));

        assertNotNull(sanitized.getSort().getOrderFor("id"));
    }
}
