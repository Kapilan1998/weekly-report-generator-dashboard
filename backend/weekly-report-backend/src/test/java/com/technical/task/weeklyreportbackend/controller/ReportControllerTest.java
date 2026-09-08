package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.ApproveRequest;
import com.technical.task.weeklyreportbackend.dto.CreateReportRequest;
import com.technical.task.weeklyreportbackend.dto.PageResponse;
import com.technical.task.weeklyreportbackend.dto.ReportDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.ReportVersionDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ReportVersionSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.RequestChangesRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateReportRequest;
import com.technical.task.weeklyreportbackend.dto.WeekStatusResponse;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import com.technical.task.weeklyreportbackend.service.ReportReviewService;
import com.technical.task.weeklyreportbackend.service.ReportService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {

    @InjectMocks
    ReportController reportController;

    @Mock
    ReportService reportService;

    @Mock
    ReportReviewService reviewService;

    @Mock
    CustomUserDetails principal;

    @Mock
    ReportDetailResponse detail;

    private static final LocalDate WEEK = LocalDate.of(2026, 9, 7);

    private User actor() {
        return User.builder().id(1L).name("Alice Member").email("alice@example.com")
                .role(Role.TEAM_MEMBER).enabled(true).build();
    }

    private CreateReportRequest createRequest() {
        return new CreateReportRequest(WEEK, 1L, "Next week's plan", null, null,
                List.of(), List.of(), List.of(), List.of());
    }

    // ---- write endpoints ----

    @Test
    void create() {
        CreateReportRequest request = createRequest();
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.createDraft(request, actor)).thenReturn(detail);

        ResponseEntity<ReportDetailResponse> response = reportController.create(request, principal);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertSame(detail, response.getBody());
        Mockito.verify(reportService).createDraft(request, actor);
    }

    @Test
    void update() {
        UpdateReportRequest request = new UpdateReportRequest(1L, "Plan", null, null,
                List.of(), List.of(), List.of(), List.of());
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.updateReport(5L, request, actor)).thenReturn(detail);

        assertSame(detail, reportController.update(5L, request, principal));
        Mockito.verify(reportService).updateReport(5L, request, actor);
    }

    @Test
    void submit() {
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.submit(5L, actor)).thenReturn(detail);

        assertSame(detail, reportController.submit(5L, principal));
        Mockito.verify(reportService).submit(5L, actor);
    }

    // ---- read endpoints ----

    @Test
    void detail() {
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.getDetail(5L, actor)).thenReturn(detail);

        assertSame(detail, reportController.detail(5L, principal));
    }

    @Test
    void versions() {
        User actor = actor();
        List<ReportVersionSummaryResponse> expected = List.of();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.listVersions(5L, actor)).thenReturn(expected);

        assertSame(expected, reportController.versions(5L, principal));
    }

    @Test
    void version() {
        User actor = actor();
        ReportVersionDetailResponse expected = Mockito.mock(ReportVersionDetailResponse.class);
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.getVersion(5L, 2, actor)).thenReturn(expected);

        assertSame(expected, reportController.version(5L, 2, principal));
        Mockito.verify(reportService).getVersion(5L, 2, actor);
    }

    @Test
    void weekStatus() {
        List<WeekStatusResponse> expected = List.of();
        Mockito.when(reportService.weekStatus(WEEK)).thenReturn(expected);

        assertSame(expected, reportController.weekStatus(WEEK));
    }

    // ---- list endpoints: the sort whitelist runs before the service is called ----

    @Test
    void listMinePassesEveryFilterThroughAndSanitisesTheSort() {
        User actor = actor();
        Pageable incoming = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "weekStart"));
        PageResponse<ReportSummaryResponse> expected =
                new PageResponse<>(List.of(), 0, 20, 0, 0, true, true);

        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reportService.listMine(eq(actor), eq(3L), eq(List.of(ReportStatus.DRAFT)),
                eq(WEEK), isNull(), isNull(), any(Pageable.class))).thenReturn(expected);

        PageResponse<ReportSummaryResponse> response = reportController.listMine(
                3L, List.of(ReportStatus.DRAFT), WEEK, null, null, incoming, principal);

        assertSame(expected, response);

        // ReportSortWhitelist.sanitize appends an id tiebreak, so the service must receive a
        // different Pageable from the incoming one - not the caller's instance untouched.
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        Mockito.verify(reportService).listMine(any(), any(), any(), any(), any(), any(), captor.capture());
        assertNotNull(captor.getValue().getSort().getOrderFor("id"));
    }

    @Test
    void listTeamPassesTheUserFilterThrough() {
        Pageable incoming = PageRequest.of(1, 10, Sort.by(Sort.Direction.DESC, "weekStart"));
        PageResponse<ReportSummaryResponse> expected =
                new PageResponse<>(List.of(), 1, 10, 0, 0, true, true);

        Mockito.when(reportService.listTeam(eq(7L), isNull(), isNull(), isNull(),
                eq(WEEK), eq(WEEK.plusWeeks(4)), any(Pageable.class))).thenReturn(expected);

        assertSame(expected, reportController.listTeam(
                7L, null, null, null, WEEK, WEEK.plusWeeks(4), incoming));

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        Mockito.verify(reportService).listTeam(any(), any(), any(), any(), any(), any(), captor.capture());
        assertEquals(1, captor.getValue().getPageNumber());
        assertEquals(10, captor.getValue().getPageSize());
    }

    @Test
    void listEndpointsRejectAnUnknownSortProperty() {
        Pageable malicious = PageRequest.of(0, 20, Sort.by("user.passwordHash"));

        // Rejected inside the controller, before the service is reached - so ordering rows by
        // another user's password hash never becomes a query at all.
        assertThrows(RuntimeException.class,
                () -> reportController.listTeam(null, null, null, null, null, null, malicious));
        Mockito.verifyNoInteractions(reportService);
    }

    // ---- review endpoints ----

    @Test
    void approve() {
        ApproveRequest request = new ApproveRequest("Looks good");
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reviewService.approve(5L, request, actor)).thenReturn(detail);

        assertSame(detail, reportController.approve(5L, request, principal));
        Mockito.verify(reviewService).approve(5L, request, actor);
    }

    @Test
    void approveWithNoBodyAtAllSubstitutesAnEmptyComment() {
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reviewService.approve(eq(5L), any(ApproveRequest.class), eq(actor)))
                .thenReturn(detail);

        // The body is optional on approve - unlike request-changes, where a comment is
        // required - so an approval sent with no JSON at all must still work.
        assertSame(detail, reportController.approve(5L, null, principal));

        ArgumentCaptor<ApproveRequest> captor = ArgumentCaptor.forClass(ApproveRequest.class);
        Mockito.verify(reviewService).approve(eq(5L), captor.capture(), eq(actor));
        assertNull(captor.getValue().comment());
    }

    @Test
    void requestChanges() {
        RequestChangesRequest request = new RequestChangesRequest("Please split the tasks up");
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(reviewService.requestChanges(5L, request, actor)).thenReturn(detail);

        assertSame(detail, reportController.requestChanges(5L, request, principal));
        Mockito.verify(reviewService).requestChanges(5L, request, actor);
    }
}
