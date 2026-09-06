package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.ProjectSummaryResponse;
import com.technical.task.weeklyreportbackend.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only in Phase 2 — project CRUD (and its management page) is Phase 3. Readable by any
 * authenticated user because every team member needs the list to tag a report.
 */
@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectSummaryResponse> listActive() {
        return projectService.listActive();
    }
}
