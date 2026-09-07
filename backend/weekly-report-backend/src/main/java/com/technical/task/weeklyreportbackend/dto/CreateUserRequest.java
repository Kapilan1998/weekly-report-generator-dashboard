package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A manager adding an account directly, with an initial password they pass on.
 *
 * <p>Unlike self-registration this <em>does</em> carry a role — that is the point of the
 * endpoint, and it is safe here because the endpoint is manager-only, whereas
 * {@code /api/auth/register} is public and therefore always creates a team member.
 *
 * <p>A production system would email an invitation token instead of setting a password on
 * the user's behalf; that needs mail infrastructure this project doesn't have.
 */
public record CreateUserRequest(
        @NotBlank(message = "Name is required")
        @Pattern(regexp = "^[A-Za-z]+( [A-Za-z]+)*$", message = "Name must contain only letters and spaces")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        String email,

        // Same rules as self-registration, so an account created either way is equally strong.
        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
                message = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
        )
        String password,

        @NotNull(message = "Role is required")
        Role role
) {
}
