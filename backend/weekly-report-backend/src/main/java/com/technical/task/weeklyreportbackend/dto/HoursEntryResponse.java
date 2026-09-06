package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.TaskType;

import java.math.BigDecimal;

public record HoursEntryResponse(
        TaskType taskType,
        BigDecimal hours
) {
}
