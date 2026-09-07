package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.dto.CreateProjectRequest;
import com.technical.task.weeklyreportbackend.dto.ProjectDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ProjectSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.UpdateProjectRequest;
import com.technical.task.weeklyreportbackend.exception.ProjectInUseException;
import com.technical.task.weeklyreportbackend.exception.ProjectNameTakenException;
import com.technical.task.weeklyreportbackend.exception.ProjectNotFoundException;
import com.technical.task.weeklyreportbackend.repository.ProjectRepository;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ReportRepository reportRepository;

    /** Active projects only — this feeds the report form's project picker. */
    @Transactional(readOnly = true)
    public List<ProjectSummaryResponse> listActive() {
        return projectRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(project -> new ProjectSummaryResponse(project.getId(), project.getName()))
                .toList();
    }

    /** Everything, including inactive, for the management page. */
    @Transactional(readOnly = true)
    public List<ProjectDetailResponse> listAll() {
        return projectRepository.findAllByOrderByNameAsc().stream().map(this::toDetail).toList();
    }

    /**
     * Resolves a project for tagging. Filters on active, so archiving a project actually
     * stops new reports attaching to it rather than leaving the flag decorative.
     */
    @Transactional(readOnly = true)
    public Project requireActive(Long projectId) {
        return projectRepository.findByIdAndActiveTrue(projectId).orElseThrow(ProjectNotFoundException::new);
    }

    @Transactional
    public ProjectDetailResponse create(CreateProjectRequest request) {
        String name = request.name().trim();
        if (projectRepository.existsByNameIgnoreCase(name)) {
            throw new ProjectNameTakenException(name);
        }

        Project saved = projectRepository.save(Project.builder()
                .name(name)
                .description(trimToNull(request.description()))
                .active(true)
                .build());

        return toDetail(saved);
    }

    @Transactional
    public ProjectDetailResponse update(Long projectId, UpdateProjectRequest request) {
        Project project = projectRepository.findById(projectId).orElseThrow(ProjectNotFoundException::new);
        String name = request.name().trim();

        // Compared case-insensitively excluding itself, so re-saving without a rename is fine.
        if (!project.getName().equalsIgnoreCase(name)
                && projectRepository.existsByNameIgnoreCase(name)) {
            throw new ProjectNameTakenException(name);
        }

        project.setName(name);
        project.setDescription(trimToNull(request.description()));
        project.setActive(Boolean.TRUE.equals(request.active()));

        return toDetail(projectRepository.save(project));
    }

    /**
     * Deletes a project that nothing references. A project already used by reports cannot be
     * deleted — it would strip the tag off historical reports, and a reviewed version's
     * context has to stay as it was — so the caller is told to deactivate it instead.
     */
    @Transactional
    public void delete(Long projectId) {
        Project project = projectRepository.findById(projectId).orElseThrow(ProjectNotFoundException::new);

        long reportCount = reportRepository.countByProjectId(projectId);
        if (reportCount > 0) {
            throw new ProjectInUseException(reportCount);
        }

        projectRepository.delete(project);
    }

    private ProjectDetailResponse toDetail(Project project) {
        return new ProjectDetailResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.isActive(),
                reportRepository.countByProjectId(project.getId()));
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
