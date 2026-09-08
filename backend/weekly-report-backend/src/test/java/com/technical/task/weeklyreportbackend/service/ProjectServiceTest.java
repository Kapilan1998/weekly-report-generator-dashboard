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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @InjectMocks
    ProjectService projectService;

    @Mock
    ProjectRepository projectRepository;

    @Mock
    ReportRepository reportRepository;

    private Project project(long id, String name, boolean active) {
        return Project.builder().id(id).name(name).description("Delivery work").active(active).build();
    }

    // ---- reads ----

    @Test
    void listActiveReturnsNameAndIdOnly() {
        Mockito.when(projectRepository.findByActiveTrueOrderByNameAsc())
                .thenReturn(List.of(project(1L, "Client A", true)));

        List<ProjectSummaryResponse> list = projectService.listActive();

        assertEquals(1, list.size());
        assertEquals(new ProjectSummaryResponse(1L, "Client A"), list.get(0));
        // This feeds the report form's picker, so it must not go near report counts.
        Mockito.verifyNoInteractions(reportRepository);
    }

    @Test
    void listAllIncludesInactiveProjectsAndTheirReportCounts() {
        Mockito.when(projectRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(project(1L, "Client A", true), project(2L, "Retired", false)));
        Mockito.when(reportRepository.countByProjectId(1L)).thenReturn(4L);
        Mockito.when(reportRepository.countByProjectId(2L)).thenReturn(0L);

        List<ProjectDetailResponse> list = projectService.listAll();

        assertEquals(2, list.size());
        assertTrue(list.get(0).active());
        assertEquals(4, list.get(0).reportCount());
        assertFalse(list.get(1).active());
        // A zero count is what tells the UI it is safe to offer Delete.
        assertEquals(0, list.get(1).reportCount());
    }

    @Test
    void requireActiveFiltersOnActive() {
        Project active = project(1L, "Client A", true);
        Mockito.when(projectRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(active));

        assertSame(active, projectService.requireActive(1L));
    }

    @Test
    void requireActiveRefusesAnInactiveOrMissingProject() {
        // Filtered on active so that archiving actually stops new reports attaching, rather
        // than leaving the flag decorative.
        Mockito.when(projectRepository.findByIdAndActiveTrue(2L)).thenReturn(Optional.empty());

        assertThrows(ProjectNotFoundException.class, () -> projectService.requireActive(2L));
    }

    // ---- create ----

    @Test
    void createTrimsTheNameAndStartsActive() {
        Mockito.when(projectRepository.existsByNameIgnoreCase("Client A")).thenReturn(false);
        Mockito.when(projectRepository.save(Mockito.any(Project.class)))
                .thenAnswer(call -> call.getArgument(0));
        Mockito.when(reportRepository.countByProjectId(Mockito.any())).thenReturn(0L);

        projectService.create(new CreateProjectRequest("  Client A  ", "  Delivery work  "));

        ArgumentCaptor<Project> saved = ArgumentCaptor.forClass(Project.class);
        Mockito.verify(projectRepository).save(saved.capture());
        assertEquals("Client A", saved.getValue().getName());
        assertEquals("Delivery work", saved.getValue().getDescription());
        assertTrue(saved.getValue().isActive());
    }

    @Test
    void createTurnsABlankDescriptionIntoNull() {
        // Null and "   " mean the same thing to a reader, so only one of them is stored.
        Mockito.when(projectRepository.existsByNameIgnoreCase("Client A")).thenReturn(false);
        Mockito.when(projectRepository.save(Mockito.any(Project.class)))
                .thenAnswer(call -> call.getArgument(0));
        Mockito.when(reportRepository.countByProjectId(Mockito.any())).thenReturn(0L);

        projectService.create(new CreateProjectRequest("Client A", "   "));

        ArgumentCaptor<Project> saved = ArgumentCaptor.forClass(Project.class);
        Mockito.verify(projectRepository).save(saved.capture());
        assertNull(saved.getValue().getDescription());
    }

    @Test
    void createRejectsANameThatDiffersOnlyByCase() {
        Mockito.when(projectRepository.existsByNameIgnoreCase("client a")).thenReturn(true);

        assertThrows(ProjectNameTakenException.class,
                () -> projectService.create(new CreateProjectRequest("client a", null)));
        Mockito.verify(projectRepository, Mockito.never()).save(Mockito.any());
    }

    // ---- update ----

    @Test
    void updateAppliesTheNewNameDescriptionAndActiveFlag() {
        Project existing = project(1L, "Client A", true);
        Mockito.when(projectRepository.findById(1L)).thenReturn(Optional.of(existing));
        Mockito.when(projectRepository.existsByNameIgnoreCase("Client B")).thenReturn(false);
        Mockito.when(projectRepository.save(existing)).thenReturn(existing);
        Mockito.when(reportRepository.countByProjectId(1L)).thenReturn(2L);

        ProjectDetailResponse response =
                projectService.update(1L, new UpdateProjectRequest("Client B", "Renamed", false));

        assertEquals("Client B", response.name());
        assertEquals("Renamed", response.description());
        assertFalse(response.active());
        assertEquals(2, response.reportCount());
    }

    @Test
    void updateAllowsSavingWithoutRenaming() {
        // The duplicate check excludes the project itself, or toggling `active` on a project
        // would fail with "that name is taken" - by its own name.
        Project existing = project(1L, "Client A", true);
        Mockito.when(projectRepository.findById(1L)).thenReturn(Optional.of(existing));
        Mockito.when(projectRepository.save(existing)).thenReturn(existing);
        Mockito.when(reportRepository.countByProjectId(1L)).thenReturn(2L);

        assertDoesNotThrow(() ->
                projectService.update(1L, new UpdateProjectRequest("client a", "Delivery work", false)));
        Mockito.verify(projectRepository, Mockito.never()).existsByNameIgnoreCase(Mockito.any());
    }

    @Test
    void updateRejectsARenameOntoAnotherProjectsName() {
        Mockito.when(projectRepository.findById(1L)).thenReturn(Optional.of(project(1L, "Client A", true)));
        Mockito.when(projectRepository.existsByNameIgnoreCase("Marketing")).thenReturn(true);

        assertThrows(ProjectNameTakenException.class,
                () -> projectService.update(1L, new UpdateProjectRequest("Marketing", null, true)));
        Mockito.verify(projectRepository, Mockito.never()).save(Mockito.any());
    }

    @Test
    void updateRejectsAMissingProject() {
        Mockito.when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ProjectNotFoundException.class,
                () -> projectService.update(99L, new UpdateProjectRequest("Anything", null, true)));
    }

    // ---- delete ----

    @Test
    void deleteRemovesAProjectNothingReferences() {
        Project unused = project(5L, "Support", true);
        Mockito.when(projectRepository.findById(5L)).thenReturn(Optional.of(unused));
        Mockito.when(reportRepository.countByProjectId(5L)).thenReturn(0L);

        projectService.delete(5L);

        Mockito.verify(projectRepository).delete(unused);
    }

    @Test
    void deleteRefusesAProjectThatReportsReference() {
        // Deleting it would strip the tag off reports whose reviewed content has to stay as it
        // was, so the caller is told to deactivate instead - and the count goes in the message.
        Project used = project(1L, "Client A", true);
        Mockito.when(projectRepository.findById(1L)).thenReturn(Optional.of(used));
        Mockito.when(reportRepository.countByProjectId(1L)).thenReturn(11L);

        ProjectInUseException thrown =
                assertThrows(ProjectInUseException.class, () -> projectService.delete(1L));

        assertTrue(thrown.getMessage().contains("11"));
        Mockito.verify(projectRepository, Mockito.never()).delete(Mockito.any());
    }

    @Test
    void deleteRejectsAMissingProject() {
        Mockito.when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ProjectNotFoundException.class, () -> projectService.delete(99L));
        Mockito.verifyNoInteractions(reportRepository);
    }
}
