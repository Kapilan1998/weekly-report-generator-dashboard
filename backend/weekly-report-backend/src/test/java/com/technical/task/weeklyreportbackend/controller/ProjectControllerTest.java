package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.CreateProjectRequest;
import com.technical.task.weeklyreportbackend.dto.ProjectDetailResponse;
import com.technical.task.weeklyreportbackend.dto.ProjectSummaryResponse;
import com.technical.task.weeklyreportbackend.dto.UpdateProjectRequest;
import com.technical.task.weeklyreportbackend.service.ProjectService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * A controller has no logic of its own beyond mapping to a status code, so these tests check
 * exactly that: the right service method is called with the arguments that came in, and the
 * response carries the right status. Everything the service decides is tested in
 * {@link com.technical.task.weeklyreportbackend.service.ProjectServiceTest}.
 */
@ExtendWith(MockitoExtension.class)
class ProjectControllerTest {


    @InjectMocks
    ProjectController projectController;

    @Mock
    ProjectService projectService;

    @Test
    void listActive() {
        Mockito.when(projectService.listActive()).thenReturn(new ArrayList<>());
        List<ProjectSummaryResponse> list = projectController.listActive();
        assertNotNull(list);
    }

    @Test
    void listAll() {
        Mockito.when(projectService.listAll()).thenReturn(new ArrayList<>());
        assertNotNull(projectController.listAll());
    }

    @Test
    void listActiveReturnsWhatTheServiceReturns() {
        List<ProjectSummaryResponse> expected = List.of(new ProjectSummaryResponse(1L, "Client A"));
        Mockito.when(projectService.listActive()).thenReturn(expected);

        assertEquals(expected, projectController.listActive());
        Mockito.verify(projectService).listActive();
    }

    @Test
    void create() {
        CreateProjectRequest request = new CreateProjectRequest("Client A", "Delivery work");
        ProjectDetailResponse created = new ProjectDetailResponse(7L, "Client A", "Delivery work", true, 0);
        Mockito.when(projectService.create(request)).thenReturn(created);

        ResponseEntity<ProjectDetailResponse> response = projectController.create(request);

        // 201 rather than 200: the resource did not exist before this call.
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(created, response.getBody());
        Mockito.verify(projectService).create(request);
    }

    @Test
    void update() {
        UpdateProjectRequest request = new UpdateProjectRequest("Client A", "Renamed", false);
        ProjectDetailResponse updated = new ProjectDetailResponse(7L, "Client A", "Renamed", false, 3);
        Mockito.when(projectService.update(7L, request)).thenReturn(updated);

        ProjectDetailResponse response = projectController.update(7L, request);

        assertSame(updated, response);
        // The path variable has to reach the service, not just the body.
        Mockito.verify(projectService).update(7L, request);
    }

    @Test
    void delete() {
        projectController.delete(7L);

        // Returns void with @ResponseStatus(NO_CONTENT); the only observable effect is the call.
        Mockito.verify(projectService).delete(7L);
        Mockito.verifyNoMoreInteractions(projectService);
    }
}
