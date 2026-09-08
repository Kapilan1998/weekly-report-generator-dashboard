package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.ActivityItemResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardChartsResponse;
import com.technical.task.weeklyreportbackend.dto.DashboardSummaryResponse;
import com.technical.task.weeklyreportbackend.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

    @InjectMocks
    DashboardController dashboardController;

    @Mock
    DashboardService dashboardService;

    private static final LocalDate WEEK = LocalDate.of(2026, 9, 7);

    @Test
    void summary() {
        DashboardSummaryResponse expected = new DashboardSummaryResponse(
                WEEK, WEEK.plusDays(6), 6, 2, 1, 3, 33, 3, 5);
        Mockito.when(dashboardService.summary(WEEK)).thenReturn(expected);

        assertSame(expected, dashboardController.summary(WEEK));
        Mockito.verify(dashboardService).summary(WEEK);
    }

    @Test
    void charts() {
        DashboardChartsResponse expected =
                new DashboardChartsResponse(List.of(), List.of(), List.of(), List.of());
        Mockito.when(dashboardService.charts(WEEK, 8)).thenReturn(expected);

        assertSame(expected, dashboardController.charts(WEEK, 8));
        Mockito.verify(dashboardService).charts(WEEK, 8);
    }

    @Test
    void chartsPassesTheWindowThroughUnchanged() {
        // The 1..52 bounds are @Min/@Max on the parameter, enforced by the validator rather
        // than by this method - so the controller must not clamp or default anything itself.
        Mockito.when(dashboardService.charts(WEEK, 52))
                .thenReturn(new DashboardChartsResponse(List.of(), List.of(), List.of(), List.of()));

        assertNotNull(dashboardController.charts(WEEK, 52));
        Mockito.verify(dashboardService).charts(WEEK, 52);
    }

    @Test
    void activity() {
        List<ActivityItemResponse> expected = List.of();
        Mockito.when(dashboardService.activity(15)).thenReturn(expected);

        assertSame(expected, dashboardController.activity(15));
        Mockito.verify(dashboardService).activity(15);
    }
}
