package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A user changing their own password.
 *
 * <p>{@code currentPassword} is required even though the caller is already authenticated. A
 * bearer token proves the request came from a session, not that the person holding it knows
 * the password - so without this a stolen or borrowed token could be used to lock the real
 * owner out of their account permanently.
 */
public record ChangePasswordRequest(
        @NotBlank(message = "Current password is required")
        String currentPassword,

        // Same rules as registration: a password change must not be a way to weaken an
        // account below what creating it would have allowed.
        @NotBlank(message = "New password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
                message = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
        )
        String newPassword
) {
}
