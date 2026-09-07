package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.Role;

import java.time.LocalDateTime;

/**
 * The manager's view of an account. {@code reportCount} is what tells them whether it can be
 * deleted outright or only disabled.
 *
 * <p>This is the one place email is exposed in a list — user management is inherently about
 * identifying people, unlike {@link UserSummaryResponse}, which is embedded on every report
 * row and deliberately carries name only.
 */
public record UserDetailResponse(
        Long id,
        String name,
        String email,
        Role role,
        boolean enabled,
        long reportCount,
        LocalDateTime createdAt
) {
}
