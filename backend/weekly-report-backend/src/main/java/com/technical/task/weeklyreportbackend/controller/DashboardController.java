package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.ActivityItemResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardChartsResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardSummaryResponse;
import com.technical.task.weeklyreportbackend.service.DashboardService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Manager dashboard aggregates.
 *
 * <p>Manager-only in full: these endpoints deliberately expose data across the whole team,
 * which is exactly what a team member must not be able to read.
 *
 * <p>{@code @Validated} on the class is what makes the bounds on the individual request
 * parameters below take effect — without it, method-parameter constraints are ignored.
 */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("hasRole('MANAGER')")
@Validated
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /** The brief's four summary metrics, for the selected week. */
    @GetMapping("/summary")
    public DashboardSummaryResponse summary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return dashboardService.summary(weekStart);
    }

    /** Chart datasets. The window ends at weekStart and reaches {@code weeks} back. */
    @GetMapping("/charts")
    public DashboardChartsResponse charts(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(defaultValue = "8") @Min(1) @Max(52) int weeks
    ) {
        return dashboardService.charts(weekStart, weeks);
    }

    /** Recent submissions and review actions, newest first. */
    @GetMapping("/activity")
    public List<ActivityItemResponse> activity(
            @RequestParam(defaultValue = "15") @Min(1) @Max(50) int limit
    ) {
        return dashboardService.activity(limit);
    }
}
