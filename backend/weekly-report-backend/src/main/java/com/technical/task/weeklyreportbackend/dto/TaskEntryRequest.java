package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.TaskPriority;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** One row of the task-level table. display_order comes from the list index, not the payload. */
public record TaskEntryRequest(
        @NotBlank(message = "Task name is required")
        @Size(max = 255, message = "Task name must be at most 255 characters")
        String taskName,

        @NotNull(message = "Priority is required")
        TaskPriority priority,

        @NotNull(message = "Task status is required")
        TaskStatus status,

        @NotNull(message = "Planned % is required")
        @Min(value = 0, message = "Planned % must be between 0 and 100")
        @Max(value = 100, message = "Planned % must be between 0 and 100")
        Integer plannedPercent,

        @NotNull(message = "Actual % is required")
        @Min(value = 0, message = "Actual % must be between 0 and 100")
        @Max(value = 100, message = "Actual % must be between 0 and 100")
        Integer actualPercent,

        @NotNull(message = "Time planned is required")
        @DecimalMin(value = "0.00", message = "Time planned must be between 0 and 999.99 hours")
        @DecimalMax(value = "999.99", message = "Time planned must be between 0 and 999.99 hours")
        BigDecimal timePlannedHours,

        @NotNull(message = "Time spent is required")
        @DecimalMin(value = "0.00", message = "Time spent must be between 0 and 999.99 hours")
        @DecimalMax(value = "999.99", message = "Time spent must be between 0 and 999.99 hours")
        BigDecimal timeSpentHours,

        @Size(max = 500, message = "Output/deliverable must be at most 500 characters")
        String outputDeliverable
) {
}
