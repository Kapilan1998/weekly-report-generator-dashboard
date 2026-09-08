package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.CreateUserRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateUserRequest;
import com.technical.task.weeklyreportbackend.dto.UserDetailResponse;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import com.technical.task.weeklyreportbackend.service.UserAdminService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @InjectMocks
    UserController userController;

    @Mock
    UserAdminService userAdminService;

    @Mock
    CustomUserDetails principal;

    private User actor() {
        return User.builder().id(2L).name("Mia Manager").email("mia@example.com")
                .role(Role.MANAGER).enabled(true).build();
    }

    private UserDetailResponse detail(long id, String name) {
        return new UserDetailResponse(id, name, name.toLowerCase().replace(' ', '.') + "@example.com",
                Role.TEAM_MEMBER, true, 0, LocalDateTime.now());
    }

    @Test
    void list() {
        List<UserDetailResponse> expected = List.of(detail(1L, "Alice Member"));
        Mockito.when(userAdminService.list()).thenReturn(expected);

        assertSame(expected, userController.list());
        Mockito.verify(userAdminService).list();
    }

    @Test
    void create() {
        CreateUserRequest request = new CreateUserRequest(
                "Alice Member", "alice@example.com", "Str0ng!Pass", Role.TEAM_MEMBER);
        UserDetailResponse created = detail(1L, "Alice Member");
        Mockito.when(userAdminService.create(request)).thenReturn(created);

        ResponseEntity<UserDetailResponse> response = userController.create(request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertSame(created, response.getBody());
    }

    @Test
    void update() {
        UpdateUserRequest request = new UpdateUserRequest(Role.MANAGER, true);
        UserDetailResponse updated = detail(1L, "Alice Member");
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);
        Mockito.when(userAdminService.update(1L, request, actor)).thenReturn(updated);

        assertSame(updated, userController.update(1L, request, principal));

        // The actor has to be threaded through: the no-self-administration guard is the only
        // thing standing between a manager and demoting themselves irreversibly.
        Mockito.verify(userAdminService).update(1L, request, actor);
    }

    @Test
    void delete() {
        User actor = actor();
        Mockito.when(principal.getUser()).thenReturn(actor);

        userController.delete(1L, principal);

        Mockito.verify(userAdminService).delete(1L, actor);
    }
}
