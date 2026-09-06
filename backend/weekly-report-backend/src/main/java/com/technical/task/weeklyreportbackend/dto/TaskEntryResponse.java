package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.TaskPriority;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;

import java.math.BigDecimal;

/**
 * Note for the frontend: {@code id} changes on every save, because an edit fully replaces
 * the child rows. Key form rows by array index or a client-generated id, never by this.
 */
public record TaskEntryResponse(
        Long id,
        Integer displayOrder,
        String taskName,
        TaskPriority priority,
        TaskStatus status,
        Integer plannedPercent,
        Integer actualPercent,
        BigDecimal timePlannedHours,
        BigDecimal timeSpentHours,
        String outputDeliverable
) {
}
