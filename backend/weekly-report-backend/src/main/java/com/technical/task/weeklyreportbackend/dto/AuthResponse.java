package com.technical.task.weeklyreportbackend.dto;

import com.technical.task.weeklyreportbackend.domain.Role;

public record AuthResponse(
        String token,
        Long userId,
        String name,
        String email,
        Role role
) {
}
