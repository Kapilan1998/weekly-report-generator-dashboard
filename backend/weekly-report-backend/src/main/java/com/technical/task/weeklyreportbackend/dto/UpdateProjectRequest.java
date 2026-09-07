package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code active} is part of the update rather than a separate endpoint: deactivating is how
 * a project that reports already reference gets retired, since deleting it would orphan
 * their history.
 */
public record UpdateProjectRequest(
        @NotBlank(message = "Project name is required")
        @Size(max = 120, message = "Project name must be at most 120 characters")
        String name,

        @Size(max = 500, message = "Description must be at most 500 characters")
        String description,

        @NotNull(message = "Active flag is required")
        Boolean active
) {
}
