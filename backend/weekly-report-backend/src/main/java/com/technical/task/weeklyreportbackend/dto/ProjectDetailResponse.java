package com.technical.task.weeklyreportbackend.dto;

/**
 * The manager's view of a project. {@code reportCount} is what tells them whether a project
 * can be deleted outright or only deactivated.
 */
public record ProjectDetailResponse(
        Long id,
        String name,
        String description,
        boolean active,
        long reportCount
) {
}
