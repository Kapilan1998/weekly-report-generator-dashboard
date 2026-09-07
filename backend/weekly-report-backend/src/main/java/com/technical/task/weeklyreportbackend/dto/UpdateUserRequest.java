package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.Role;
import jakarta.validation.constraints.NotNull;

/**
 * Role assignment and enable/disable, which is what the brief's user-management page needs.
 *
 * <p>Name and email are deliberately not editable here: changing someone's identity is a
 * different concern from administering their access, and the report history is attributed by
 * user id regardless.
 */
public record UpdateUserRequest(
        @NotNull(message = "Role is required")
        Role role,

        @NotNull(message = "Enabled flag is required")
        Boolean enabled
) {
}
