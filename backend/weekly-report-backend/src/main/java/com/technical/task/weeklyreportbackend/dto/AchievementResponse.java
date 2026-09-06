package com.technical.task.weeklyreportbackend.dto;

public record AchievementResponse(
        Long id,
        Integer displayOrder,
        String description,
        boolean keyAchievement
) {
}
