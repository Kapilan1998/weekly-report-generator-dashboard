package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.CreateProjectRequest;
import com.technical.task.weeklyreportbackend.dto.ProjectDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ProjectSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.UpdateProjectRequest;
import com.technical.task.weeklyreportbackend.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Projects / categories.
 *
 * <p>The plain list is readable by anyone signed in, because every team member needs it to
 * tag a report. Everything that changes a project is manager-only, as is the listing that
 * exposes inactive projects and report counts.
 */
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    /** Active projects only — feeds the report form's picker. */
    @GetMapping
    public List<ProjectSummaryResponse> listActive() {
        return projectService.listActive();
    }

    /** Everything including inactive, for the management page. */
    @GetMapping("/all")
    @PreAuthorize("hasRole('MANAGER')")
    public List<ProjectDetailResponse> listAll() {
        return projectService.listAll();
    }

    @PostMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ProjectDetailResponse> create(@Valid @RequestBody CreateProjectRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ProjectDetailResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProjectRequest request
    ) {
        return projectService.update(id, request);
    }

    /** Only possible for a project no report references; otherwise 409 with the count. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        projectService.delete(id);
    }
}
