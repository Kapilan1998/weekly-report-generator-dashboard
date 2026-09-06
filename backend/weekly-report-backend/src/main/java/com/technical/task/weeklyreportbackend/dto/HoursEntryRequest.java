package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.TaskType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record HoursEntryRequest(
        @NotNull(message = "Task type is required")
        TaskType taskType,

        @NotNull(message = "Hours are required")
        @DecimalMin(value = "0.00", message = "Hours must be between 0 and 999.99")
        @DecimalMax(value = "999.99", message = "Hours must be between 0 and 999.99")
        BigDecimal hours
) {
}
