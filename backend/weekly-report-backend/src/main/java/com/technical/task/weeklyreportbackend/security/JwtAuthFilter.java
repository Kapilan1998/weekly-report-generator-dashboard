package com.technical.task.weeklyreportbackend.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    /**
     * Request attribute set when a token was rejected because the account's access changed
     * under it - as opposed to the token simply expiring or being malformed.
     */
    public static final String ACCESS_CHANGED = "wrg.accessChanged";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            String email = jwtService.extractEmail(token);

            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                CustomUserDetails userDetails = userDetailsService.loadUserByUsername(email);

                // isEnabled() is checked here explicitly: this filter builds the
                // Authentication itself rather than going through an AuthenticationProvider,
                // so nothing else would apply it. Without this a disabled account would keep
                // working until its token happened to expire.
                // A manager changing this account's role or enabled flag bumps its
                // token version, so every token issued before that change stops working here
                // rather than lingering until it expires.
                boolean currentVersion =
                        jwtService.extractTokenVersion(token) == userDetails.getUser().getTokenVersion();

                if (!currentVersion || !userDetails.isEnabled()) {
                    // Read back by RestAuthenticationEntryPoint, so the 401 body can say what
                    // happened instead of a bare "authentication is required". Without it the
                    // user is bounced to the login screen with no idea why.
                    request.setAttribute(ACCESS_CHANGED, Boolean.TRUE);
                }

                if (currentVersion
                        && userDetails.isEnabled()
                        && jwtService.isTokenValid(token, userDetails.getUsername())) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (JwtException | UsernameNotFoundException ignored) {
            // Invalid/expired token: proceed unauthenticated, the endpoint's own auth check will reject as needed.
        }

        filterChain.doFilter(request, response);
    }
}
