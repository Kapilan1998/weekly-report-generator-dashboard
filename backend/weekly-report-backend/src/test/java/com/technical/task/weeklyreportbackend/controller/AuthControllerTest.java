package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.dto.AuthResponse;
import com.technical.task.weeklyreportbackend.dto.LoginRequest;
import com.technical.task.weeklyreportbackend.dto.RegisterRequest;
import com.technical.task.weeklyreportbackend.exception.InvalidCredentialsException;
import com.technical.task.weeklyreportbackend.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @InjectMocks
    AuthController authController;

    @Mock
    AuthService authService;

    @Test
    void register() {
        RegisterRequest request = new RegisterRequest("Alice Member", "alice@example.com", "Str0ng!Pass");
        AuthResponse expected =
                new AuthResponse("jwt-token", 1L, "Alice Member", "alice@example.com", Role.TEAM_MEMBER);
        Mockito.when(authService.register(request)).thenReturn(expected);

        ResponseEntity<AuthResponse> response = authController.register(request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertSame(expected, response.getBody());
        Mockito.verify(authService).register(request);
    }

    @Test
    void registerAlwaysProducesATeamMember() {
        // RegisterRequest has no role component at all, which is the fix for the Phase 1
        // privilege escalation. This test fails to compile the day someone adds one back.
        RegisterRequest request = new RegisterRequest("Evil Escalator", "evil@example.com", "Str0ng!Pass");
        Mockito.when(authService.register(request)).thenReturn(
                new AuthResponse("jwt-token", 9L, "Evil Escalator", "evil@example.com", Role.TEAM_MEMBER));

        ResponseEntity<AuthResponse> response = authController.register(request);

        assertNotNull(response.getBody());
        assertEquals(Role.TEAM_MEMBER, response.getBody().role());
    }

    @Test
    void login() {
        LoginRequest request = new LoginRequest("alice@example.com", "Str0ng!Pass");
        AuthResponse expected =
                new AuthResponse("jwt-token", 1L, "Alice Member", "alice@example.com", Role.TEAM_MEMBER);
        Mockito.when(authService.login(request)).thenReturn(expected);

        ResponseEntity<AuthResponse> response = authController.login(request);

        // 200, not 201: logging in creates nothing.
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(expected, response.getBody());
        Mockito.verify(authService).login(request);
    }

    @Test
    void loginLetsTheServiceExceptionThroughUntouched() {
        LoginRequest request = new LoginRequest("alice@example.com", "wrong");
        Mockito.when(authService.login(request)).thenThrow(new InvalidCredentialsException());

        // The controller must not catch this: GlobalExceptionHandler turns it into the 401
        // with a generic message, and swallowing it here would leak a 200 or a 500 instead.
        assertThrows(InvalidCredentialsException.class, () -> authController.login(request));
    }
}
