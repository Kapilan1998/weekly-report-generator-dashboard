package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Trivial endpoints proving the JWT + RBAC setup works end to end, ahead of building
 * the real report/dashboard endpoints on top of it. See docs/PLAN.md Phase 1.
 */
@RestController
public class PingController {

    @GetMapping("/api/ping/me")
    public Map<String, Object> me(@AuthenticationPrincipal CustomUserDetails principal) {
        return Map.of(
                "email", principal.getUsername(),
                "role", principal.getUser().getRole().name()
        );
    }

    @GetMapping("/api/ping/manager")
    @PreAuthorize("hasRole('MANAGER')")
    public Map<String, String> managerOnly() {
        return Map.of("message", "Hello manager - RBAC is working");
    }
}
