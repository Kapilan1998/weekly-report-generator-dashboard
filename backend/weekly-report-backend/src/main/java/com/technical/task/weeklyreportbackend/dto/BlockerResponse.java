package com.technical.task.weeklyreportbackend.dto;

public record BlockerResponse(
        Long id,
        Integer displayOrder,
        String description,
        boolean keyIssue
) {
}
