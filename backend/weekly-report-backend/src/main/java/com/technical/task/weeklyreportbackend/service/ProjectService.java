package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.dto.ProjectSummaryResponse;
import com.technical.task.weeklyreportbackend.exception.ProjectNotFoundException;
import com.technical.task.weeklyreportbackend.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Read-only in Phase 2 — full project CRUD is Phase 3. This exists now because a report
 * must be tagged with a project, so the list has to be reachable for the report form.
 */
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public List<ProjectSummaryResponse> listActive() {
        return projectRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(project -> new ProjectSummaryResponse(project.getId(), project.getName()))
                .toList();
    }

    /**
     * Resolves a project for tagging. Filters on active, so archiving a project actually
     * stops new reports attaching to it rather than leaving the flag decorative.
     */
    @Transactional(readOnly = true)
    public Project requireActive(Long projectId) {
        return projectRepository.findByIdAndActiveTrue(projectId).orElseThrow(ProjectNotFoundException::new);
    }
}
