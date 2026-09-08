package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The ping endpoints have no service to mock — they only read the authenticated principal.
 * What is worth pinning is that {@code /me} reports the caller's own identity and role and
 * nothing else: it is the endpoint used to confirm a token resolves to the right user.
 */
@ExtendWith(MockitoExtension.class)
class PingControllerTest {

    @InjectMocks
    PingController pingController;

    @Mock
    CustomUserDetails principal;

    @Test
    void meReportsTheCallersOwnEmailAndRole() {
        User user = User.builder().id(1L).name("Alice Member").email("alice@example.com")
                .role(Role.TEAM_MEMBER).enabled(true).build();
        Mockito.when(principal.getUsername()).thenReturn("alice@example.com");
        Mockito.when(principal.getUser()).thenReturn(user);

        Map<String, Object> body = pingController.me(principal);

        assertEquals("alice@example.com", body.get("email"));
        assertEquals("TEAM_MEMBER", body.get("role"));
        // No password hash, no id, nothing else - this response is not a user dump.
        assertEquals(2, body.size());
    }

    @Test
    void meReportsManagerForAManager() {
        User user = User.builder().id(2L).name("Mia Manager").email("mia@example.com")
                .role(Role.MANAGER).enabled(true).build();
        Mockito.when(principal.getUsername()).thenReturn("mia@example.com");
        Mockito.when(principal.getUser()).thenReturn(user);

        assertEquals("MANAGER", pingController.me(principal).get("role"));
    }

    @Test
    void managerOnlyReturnsAFixedMessage() {
        // The role gate is @PreAuthorize, applied by the proxy rather than by this body, so
        // reaching the method at all is the assertion. The gate itself is covered by
        // RoleBasedAccessControlTest, which goes through the real filter chain.
        assertEquals(Map.of("message", "Hello manager - RBAC is working"),
                pingController.managerOnly());
    }
}
