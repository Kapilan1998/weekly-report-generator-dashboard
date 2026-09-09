package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * A user editing their own name and email.
 *
 * <p>Role and the enabled flag are deliberately absent, and that is the whole security point
 * of having a separate DTO from {@link UpdateUserRequest}: this endpoint is open to any
 * signed-in user, so a role field here would let a team member promote themselves and walk
 * through every {@code hasRole('MANAGER')} gate in the application. Access is administered by
 * a manager through {@code /api/users}; identity is edited here.
 *
 * <p>The constraints are the same ones self-registration applies, so an account cannot be
 * edited into a state it could not have been created in.
 */
public record UpdateProfileRequest(
        @NotBlank(message = "Name is required")
        @Pattern(regexp = "^[A-Za-z]+( [A-Za-z]+)*$", message = "Name must contain only letters and spaces")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        String email
) {
}
