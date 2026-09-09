package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AuthResponse;
import com.technical.task.weeklyreportbackend.dto.ChangePasswordRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateProfileRequest;
import com.technical.task.weeklyreportbackend.exception.EmailAlreadyExistsException;
import com.technical.task.weeklyreportbackend.exception.IncorrectPasswordException;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import com.technical.task.weeklyreportbackend.service.ProfileService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The self-service profile endpoints.
 *
 * <p>Two of these tests are about what the controller must <em>not</em> do: it must not carry
 * a manager-only role gate (a team member has to be able to edit their own name), and it must
 * not resolve the user from anything but the authenticated principal.
 */
@ExtendWith(MockitoExtension.class)
class ProfileControllerTest {

    @InjectMocks
    ProfileController profileController;

    @Mock
    ProfileService profileService;

    private User actor() {
        return User.builder()
                .id(7L)
                .name("Alice Member")
                .email("alice@example.com")
                .passwordHash("$2a$10$currentHash")
                .role(Role.TEAM_MEMBER)
                .enabled(true)
                .build();
    }

    private AuthResponse response() {
        return new AuthResponse("fresh-jwt", 7L, "Alice Renamed", "alice.renamed@example.com",
                Role.TEAM_MEMBER);
    }

    // ---- update ----

    @Test
    void updateDelegatesAndReturnsTheFreshSession() {
        UpdateProfileRequest request = new UpdateProfileRequest("Alice Renamed", "alice.renamed@example.com");
        AuthResponse expected = response();
        Mockito.when(profileService.updateProfile(Mockito.eq(request), Mockito.any(User.class)))
                .thenReturn(expected);

        AuthResponse actual = profileController.update(request, new CustomUserDetails(actor()));

        // Returned whole, token included: the client has to store it, because the old token's
        // subject is the previous email address.
        assertSame(expected, actual);
        assertEquals("fresh-jwt", actual.token());
    }

    @Test
    void updateActsOnThePrincipalNotOnAnythingInTheBody() {
        UpdateProfileRequest request = new UpdateProfileRequest("Alice Renamed", "alice.renamed@example.com");
        Mockito.when(profileService.updateProfile(Mockito.eq(request), Mockito.any(User.class)))
                .thenReturn(response());

        profileController.update(request, new CustomUserDetails(actor()));

        ArgumentCaptor<User> passed = ArgumentCaptor.forClass(User.class);
        Mockito.verify(profileService).updateProfile(Mockito.eq(request), passed.capture());
        assertEquals(7L, passed.getValue().getId());
    }

    @Test
    void updateLetsAConflictThroughUntouched() {
        UpdateProfileRequest request = new UpdateProfileRequest("Alice Member", "taken@example.com");
        Mockito.when(profileService.updateProfile(Mockito.eq(request), Mockito.any(User.class)))
                .thenThrow(new EmailAlreadyExistsException("taken@example.com"));

        // Caught here it would surface as a 200 or a 500; GlobalExceptionHandler turns it into
        // the 409 the form shows against the email field.
        assertThrows(EmailAlreadyExistsException.class,
                () -> profileController.update(request, new CustomUserDetails(actor())));
    }

    @Test
    void updateRequiresNoRoleSoATeamMemberCanEditTheirOwnDetails() {
        // UserController is annotated hasRole('MANAGER') at the class level, which is why
        // these endpoints live on their own controller rather than as a /me path inside it.
        // If anyone copies that annotation across, every team member loses profile editing -
        // so it is asserted rather than left to a code review.
        assertNull(AnnotatedElementUtils.findMergedAnnotation(ProfileController.class, PreAuthorize.class),
                "ProfileController must not carry a class-level role gate");
    }

    // ---- changePassword ----

    @Test
    void changePasswordDelegatesAndReturnsTheFreshSession() {
        ChangePasswordRequest request = new ChangePasswordRequest("Str0ng!Current", "Str0ng!New");
        AuthResponse expected = response();
        Mockito.when(profileService.changePassword(Mockito.eq(request), Mockito.any(User.class)))
                .thenReturn(expected);

        AuthResponse actual = profileController.changePassword(request, new CustomUserDetails(actor()));

        assertSame(expected, actual);
        Mockito.verify(profileService).changePassword(Mockito.eq(request), Mockito.any(User.class));
    }

    @Test
    void changePasswordSurfacesAWrongCurrentPasswordAsFourHundred() {
        ChangePasswordRequest request = new ChangePasswordRequest("wrong", "Str0ng!New");
        Mockito.when(profileService.changePassword(Mockito.eq(request), Mockito.any(User.class)))
                .thenThrow(new IncorrectPasswordException());

        IncorrectPasswordException thrown = assertThrows(IncorrectPasswordException.class,
                () -> profileController.changePassword(request, new CustomUserDetails(actor())));

        // Not 401. The frontend's API client signs the user out on a 401, so returning one for
        // a mistyped form field would end the session instead of showing an error.
        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
    }
}
