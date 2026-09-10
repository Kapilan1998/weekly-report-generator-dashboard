package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AuthResponse;
import com.technical.task.weeklyreportbackend.dto.ChangePasswordRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateProfileRequest;
import com.technical.task.weeklyreportbackend.exception.EmailAlreadyExistsException;
import com.technical.task.weeklyreportbackend.exception.IncorrectPasswordException;
import com.technical.task.weeklyreportbackend.exception.UserNotFoundException;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import com.technical.task.weeklyreportbackend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Self-service profile editing.
 *
 * <p>Three properties carry the weight here and each gets its own test: the endpoint can only
 * ever edit the caller's own row, saving without changing your email must not collide with
 * yourself, and a wrong current password must come back as 400 rather than 401 - a 401 signs
 * the user out of the application.
 */
@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @InjectMocks
    ProfileService profileService;

    @Mock
    UserRepository userRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    JwtService jwtService;

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

    /** Mirrors a real save, which returns the managed instance it was handed. */
    private void stubSaveReturningTheArgument() {
        Mockito.when(userRepository.save(Mockito.any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    // ---- updateProfile ----

    @Test
    void updateProfileTrimsTheNameAndNormalisesTheEmail() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(userRepository.existsByEmail("alice.member@example.com")).thenReturn(false);
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        AuthResponse response = profileService.updateProfile(
                new UpdateProfileRequest("  Alice Member  ", "  Alice.Member@Example.com  "),
                actor());

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        // Lower-cased and trimmed the same way UserAdminService.create does it, so one address
        // cannot exist twice in different cases and then fail to match at login.
        assertEquals("alice.member@example.com", saved.getValue().getEmail());
        assertEquals("Alice Member", saved.getValue().getName());
        assertEquals("alice.member@example.com", response.email());
        assertEquals("Alice Member", response.name());
    }

    @Test
    void updateProfileIssuesAFreshTokenBecauseTheSubjectIsTheEmail() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        AuthResponse response = profileService.updateProfile(
                new UpdateProfileRequest("Alice Member", "new@example.com"), actor());

        // Without this the caller keeps a token whose subject names an address that no longer
        // exists, so their very next request 401s and the client signs them out.
        assertEquals("fresh-jwt", response.token());
        ArgumentCaptor<User> tokenFor = ArgumentCaptor.forClass(User.class);
        Mockito.verify(jwtService).generateToken(tokenFor.capture());
        assertEquals("new@example.com", tokenFor.getValue().getEmail(),
                "the token must be signed for the new address, not the old one");
    }

    @Test
    void updateProfileWithAnUnchangedEmailDoesNotCollideWithItself() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        // Same address, different case - it normalises to what is already stored.
        assertDoesNotThrow(() -> profileService.updateProfile(
                new UpdateProfileRequest("Alice Renamed", "ALICE@example.com"), actor()));

        // The uniqueness check must be skipped entirely, not merely pass: the row itself owns
        // the address, so asking would answer "taken" and every plain rename would 409.
        Mockito.verify(userRepository, Mockito.never()).existsByEmail(Mockito.anyString());
    }

    @Test
    void updateProfileRejectsAnEmailAnotherAccountAlreadyUses() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);

        EmailAlreadyExistsException thrown = assertThrows(EmailAlreadyExistsException.class,
                () -> profileService.updateProfile(
                        new UpdateProfileRequest("Alice Member", "taken@example.com"), actor()));

        assertEquals(HttpStatus.CONFLICT, thrown.getStatus());
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any(User.class));
    }

    @Test
    void updateProfileOnlyEverReadsTheActorsOwnRow() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(userRepository.existsByEmail(Mockito.anyString())).thenReturn(false);
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        profileService.updateProfile(new UpdateProfileRequest("Alice Member", "a@example.com"), actor());

        // The id comes from the authenticated actor and from nowhere else. There is no request
        // field to tamper with, and this pins that down.
        Mockito.verify(userRepository).findById(7L);
        Mockito.verify(userRepository, Mockito.times(1)).findById(Mockito.anyLong());
    }

    @Test
    void updateProfileFailsWhenTheActorsRowIsGone() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> profileService.updateProfile(
                new UpdateProfileRequest("Alice Member", "a@example.com"), actor()));
    }

    @Test
    void updateProfileDoesNotTouchTheRoleOrThePassword() {
        User stored = actor();
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(stored));
        Mockito.when(userRepository.existsByEmail(Mockito.anyString())).thenReturn(false);
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        AuthResponse response = profileService.updateProfile(
                new UpdateProfileRequest("Alice Member", "a@example.com"), actor());

        // UpdateProfileRequest carries no role component at all - a team member must not be
        // able to promote themselves through an endpoint every signed-in user can reach.
        assertEquals(Role.TEAM_MEMBER, response.role());
        assertEquals("$2a$10$currentHash", stored.getPasswordHash());
        Mockito.verify(passwordEncoder, Mockito.never()).encode(Mockito.anyString());
    }

    // ---- changePassword ----

    @Test
    void changePasswordStoresTheNewHash() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(passwordEncoder.matches("Str0ng!Current", "$2a$10$currentHash")).thenReturn(true);
        Mockito.when(passwordEncoder.encode("Str0ng!New")).thenReturn("$2a$10$newHash");
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        AuthResponse response = profileService.changePassword(
                new ChangePasswordRequest("Str0ng!Current", "Str0ng!New"), actor());

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        assertEquals("$2a$10$newHash", saved.getValue().getPasswordHash());
        // Never the plaintext, however the encoder is configured.
        assertNotEquals("Str0ng!New", saved.getValue().getPasswordHash());
        assertEquals("fresh-jwt", response.token());
    }

    @Test
    void changePasswordRejectsAWrongCurrentPasswordAsBadRequestNotUnauthorized() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(passwordEncoder.matches("wrong", "$2a$10$currentHash")).thenReturn(false);

        IncorrectPasswordException thrown = assertThrows(IncorrectPasswordException.class,
                () -> profileService.changePassword(
                        new ChangePasswordRequest("wrong", "Str0ng!New"), actor()));

        /*
         * The status is the point of this test. The caller's token is perfectly valid - only
         * the form field is wrong - and this project's API client signs the user out on any
         * 401. A 401 here would throw someone back to the login screen for a typo.
         */
        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatus());
        assertNotEquals(HttpStatus.UNAUTHORIZED, thrown.getStatus());
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any(User.class));
        Mockito.verify(passwordEncoder, Mockito.never()).encode(Mockito.anyString());
    }

    @Test
    void changePasswordLeavesTheIdentityAlone() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(actor()));
        Mockito.when(passwordEncoder.matches(Mockito.anyString(), Mockito.anyString())).thenReturn(true);
        Mockito.when(passwordEncoder.encode(Mockito.anyString())).thenReturn("$2a$10$newHash");
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        AuthResponse response = profileService.changePassword(
                new ChangePasswordRequest("Str0ng!Current", "Str0ng!New"), actor());

        assertEquals("Alice Member", response.name());
        assertEquals("alice@example.com", response.email());
        assertEquals(Role.TEAM_MEMBER, response.role());
    }

    @Test
    void changePasswordFailsWhenTheActorsRowIsGone() {
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> profileService.changePassword(
                new ChangePasswordRequest("Str0ng!Current", "Str0ng!New"), actor()));
    }

    @Test
    void changePasswordSignsOutTheOtherDevicesButNotThisOne() {
        User stored = actor();
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(stored));
        Mockito.when(passwordEncoder.matches(Mockito.anyString(), Mockito.anyString())).thenReturn(true);
        Mockito.when(passwordEncoder.encode(Mockito.anyString())).thenReturn("$2a$10$newHash");
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        profileService.changePassword(
                new ChangePasswordRequest("Str0ng!Current", "Str0ng!New"), actor());

        // Bumped, so every token issued before now is rejected by JwtAuthFilter.
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        assertEquals(1, saved.getValue().getTokenVersion());

        /*
         * And the ordering is the part that matters: the token handed back must be minted
         * from the already-bumped user, or the caller would be signing themselves out by
         * changing their own password. Asserting the version on the instance passed to
         * generateToken is what pins that - a bump moved after this call would still leave
         * the assertion above passing.
         */
        ArgumentCaptor<User> tokenFor = ArgumentCaptor.forClass(User.class);
        Mockito.verify(jwtService).generateToken(tokenFor.capture());
        assertEquals(1, tokenFor.getValue().getTokenVersion());
    }

    @Test
    void aRefusedPasswordChangeDoesNotSignAnybodyOut() {
        User stored = actor();
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(stored));
        Mockito.when(passwordEncoder.matches("wrong", "$2a$10$currentHash")).thenReturn(false);

        assertThrows(IncorrectPasswordException.class, () -> profileService.changePassword(
                new ChangePasswordRequest("wrong", "Str0ng!New"), actor()));

        // A typo in the form must not end sessions on the account's other devices.
        assertEquals(0, stored.getTokenVersion());
    }

    @Test
    void updateProfileLeavesTheTokenVersionAlone() {
        // Renaming yourself or changing your email is not a credential change, so it has no
        // business ending sessions elsewhere - the fresh token is only about the new subject.
        User stored = actor();
        Mockito.when(userRepository.findById(7L)).thenReturn(Optional.of(stored));
        Mockito.when(userRepository.existsByEmail(Mockito.anyString())).thenReturn(false);
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("fresh-jwt");
        stubSaveReturningTheArgument();

        profileService.updateProfile(new UpdateProfileRequest("Alice Renamed", "a@example.com"), actor());

        assertEquals(0, stored.getTokenVersion());
    }
}
