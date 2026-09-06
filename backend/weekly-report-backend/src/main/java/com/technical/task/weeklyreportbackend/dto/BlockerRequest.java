package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BlockerRequest(
        @NotBlank(message = "Blocker description is required")
        @Size(max = 1000, message = "Blocker description must be at most 1000 characters")
        String description,

        @NotNull(message = "keyIssue is required")
        Boolean keyIssue
) {
}
