package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.dto.CreateUserRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateUserRequest;
import com.technical.task.weeklyreportbackend.dto.UserDetailResponse;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import com.technical.task.weeklyreportbackend.service.UserAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * User administration — the backend for the brief's "invite/remove team members, assign
 * roles" page.
 *
 * <p>Manager-only in full, at the class level: every endpoint here reads or changes other
 * people's accounts, and the role field in particular is exactly what a team member must not
 * be able to set. (Self-registration stays public but always creates a team member.)
 */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('MANAGER')")
@RequiredArgsConstructor
public class UserController {

    private final UserAdminService userAdminService;

    @GetMapping
    public List<UserDetailResponse> list() {
        return userAdminService.list();
    }

    /** Adds an account with an initial password, since there is no mail infrastructure. */
    @PostMapping
    public ResponseEntity<UserDetailResponse> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userAdminService.create(request));
    }

    /** Role assignment and enable/disable. */
    @PutMapping("/{id}")
    public UserDetailResponse update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return userAdminService.update(id, request, principal.getUser());
    }

    /** Only for an account with no reports; otherwise 409 pointing at disabling instead. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails principal) {
        userAdminService.delete(id, principal.getUser());
    }
}
