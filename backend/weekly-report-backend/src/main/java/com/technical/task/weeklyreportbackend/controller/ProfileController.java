package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.AuthResponse;
import com.technical.task.weeklyreportbackend.dto.ChangePasswordRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateProfileRequest;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import com.technical.task.weeklyreportbackend.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in user's own account.
 *
 * <p>A separate controller from {@link UserController} rather than a {@code /me} path inside
 * it, for two reasons. {@code UserController} carries {@code @PreAuthorize("hasRole('MANAGER')")}
 * at the class level, so anything added there would be manager-only — a team member could not
 * edit their own name. And the two have opposite subjects: everything under {@code /api/users}
 * acts on <em>other people's</em> accounts, everything here acts only on your own. Keeping
 * that split visible in the URL is what stops the manager-only rule from being weakened later
 * to let one endpoint through.
 *
 * <p>No annotation is needed to require a login: {@code SecurityConfig} authenticates every
 * request that is not under {@code /api/auth/**}.
 */
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    /**
     * Name and email. Returns a new token, because the old one names the user by their
     * previous email — see {@link ProfileService}.
     */
    @PutMapping
    public AuthResponse update(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return profileService.updateProfile(request, principal.getUser());
    }

    /** Requires the current password; 400 rather than 401 when it is wrong. */
    @PutMapping("/password")
    public AuthResponse changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return profileService.changePassword(request, principal.getUser());
    }
}
