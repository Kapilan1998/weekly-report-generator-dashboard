package com.technical.task.weeklyreportbackend.security;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Ensures a request with no (or an invalid) JWT gets a proper 401, instead of Spring
 * Security's default 403 for unauthenticated requests - keeps 403 meaning "authenticated
 * but not allowed" and 401 meaning "not authenticated at all".
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpServletResponse.SC_UNAUTHORIZED);
        body.put("error", "Unauthorized");
        // Two different situations reach a 401, and they need different action from the
        // reader: "sign in" versus "your access was changed, sign in again to pick it up".
        boolean accessChanged = Boolean.TRUE.equals(request.getAttribute(JwtAuthFilter.ACCESS_CHANGED));
        body.put("message", accessChanged
                ? "Your access was changed, so you have been signed out. Please sign in again."
                : "Authentication is required to access this resource");

        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
