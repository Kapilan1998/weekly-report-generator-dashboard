package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AchievementRequest(
        @NotBlank(message = "Achievement description is required")
        @Size(max = 1000, message = "Achievement description must be at most 1000 characters")
        String description,

        @NotNull(message = "keyAchievement is required")
        Boolean keyAchievement
) {
}
