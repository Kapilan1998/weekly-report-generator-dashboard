package com.technical.task.weeklyreportbackend.dto;

/**
 * Deliberately carries no email: this is embedded on every row of the manager's report
 * list, so including it would ship every team member's address on every page load.
 */
public record UserSummaryResponse(
        Long id,
        String name
) {
}
