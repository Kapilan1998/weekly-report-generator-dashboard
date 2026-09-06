package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.domain.ReportStatus;
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
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Report endpoints.
 *
 * <p>Filters are declared as explicit request parameters rather than bound into a shared
 * filter object: {@code /mine} then has no {@code userId} parameter to bind at all, so
 * {@code GET /api/reports/mine?userId=<someone-else>} cannot reach the query. A shared
 * filter DTO would bind it and rely on the service remembering not to read it.
 *
 * <p>The write endpoints are not role-gated — the brief says every user has their own
 * report page, so a manager may file one too. Ownership is what protects the data, and it
 * is enforced in the service layer. Self-approval is blocked separately.
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final ReportReviewService reviewService;

    @PostMapping
    public ResponseEntity<ReportDetailResponse> create(
            @Valid @RequestBody CreateReportRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        ReportDetailResponse created = reportService.createDraft(request, principal.getUser());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ReportDetailResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateReportRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reportService.updateReport(id, request, principal.getUser());
    }

    @PostMapping("/{id}/submit")
    public ReportDetailResponse submit(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reportService.submit(id, principal.getUser());
    }

    @GetMapping("/mine")
    public PageResponse<ReportSummaryResponse> listMine(
            @RequestParam(required = false) Long projectId,
            @RequestParam(name = "status", required = false) List<ReportStatus> status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekTo,
            @PageableDefault(size = 20, sort = {"weekStart"}, direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reportService.listMine(
                principal.getUser(), projectId, status, weekStart, weekFrom, weekTo,
                ReportSortWhitelist.sanitize(pageable));
    }

    @GetMapping("/{id}")
    public ReportDetailResponse detail(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reportService.getDetail(id, principal.getUser());
    }

    @GetMapping("/{id}/versions")
    public List<ReportVersionSummaryResponse> versions(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reportService.listVersions(id, principal.getUser());
    }

    @GetMapping("/{id}/versions/{versionNumber}")
    public ReportVersionDetailResponse version(
            @PathVariable Long id,
            @PathVariable Integer versionNumber,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reportService.getVersion(id, versionNumber, principal.getUser());
    }

    @GetMapping
    @PreAuthorize("hasRole('MANAGER')")
    public PageResponse<ReportSummaryResponse> listTeam(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(name = "status", required = false) List<ReportStatus> status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekTo,
            @PageableDefault(size = 20, sort = {"weekStart"}, direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return reportService.listTeam(
                userId, projectId, status, weekStart, weekFrom, weekTo,
                ReportSortWhitelist.sanitize(pageable));
    }

    /** Includes members with no report for the week — the brief's "not yet started" state. */
    @GetMapping("/week-status")
    @PreAuthorize("hasRole('MANAGER')")
    public List<WeekStatusResponse> weekStatus(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return reportService.weekStatus(weekStart);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('MANAGER')")
    public ReportDetailResponse approve(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) ApproveRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        ApproveRequest body = request == null ? new ApproveRequest(null) : request;
        return reviewService.approve(id, body, principal.getUser());
    }

    @PostMapping("/{id}/request-changes")
    @PreAuthorize("hasRole('MANAGER')")
    public ReportDetailResponse requestChanges(
            @PathVariable Long id,
            @Valid @RequestBody RequestChangesRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return reviewService.requestChanges(id, request, principal.getUser());
    }
}
