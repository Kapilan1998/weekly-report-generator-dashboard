package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AuthResponse;
import com.technical.task.weeklyreportbackend.dto.LoginRequest;
import com.technical.task.weeklyreportbackend.dto.RegisterRequest;
import com.technical.task.weeklyreportbackend.exception.EmailAlreadyExistsException;
import com.technical.task.weeklyreportbackend.exception.InvalidCredentialsException;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import com.technical.task.weeklyreportbackend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @InjectMocks
    AuthService authService;

    @Mock
    UserRepository userRepository;

    @Mock
    org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Mock
    JwtService jwtService;

    private User existing(boolean enabled) {
        return User.builder()
                .id(1L)
                .name("Alice Member")
                .email("alice@example.com")
                .passwordHash("$2a$10$hashed")
                .role(Role.TEAM_MEMBER)
                .enabled(enabled)
                .build();
    }

    // ---- register ----

    @Test
    void registerHashesThePasswordAndReturnsAToken() {
        RegisterRequest request = new RegisterRequest("Alice Member", "alice@example.com", "Str0ng!Pass");
        Mockito.when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        Mockito.when(passwordEncoder.encode("Str0ng!Pass")).thenReturn("$2a$10$hashed");
        Mockito.when(userRepository.save(Mockito.any(User.class))).thenReturn(existing(true));
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("jwt-token");

        AuthResponse response = authService.register(request);

        assertEquals("jwt-token", response.token());
        assertEquals(1L, response.userId());
        assertEquals("alice@example.com", response.email());

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        // The raw password must never reach the entity.
        assertEquals("$2a$10$hashed", saved.getValue().getPasswordHash());
        assertNotEquals("Str0ng!Pass", saved.getValue().getPasswordHash());
    }

    @Test
    void registerAlwaysCreatesATeamMember() {
        // This is the Phase 1 privilege escalation, pinned. Registration is a permitAll
        // endpoint; if it could set a role, anyone could mint themselves a MANAGER and walk
        // through every hasRole('MANAGER') gate in the application.
        RegisterRequest request = new RegisterRequest("Evil Escalator", "evil@example.com", "Str0ng!Pass");
        Mockito.when(userRepository.existsByEmail("evil@example.com")).thenReturn(false);
        Mockito.when(passwordEncoder.encode(Mockito.anyString())).thenReturn("$2a$10$hashed");
        Mockito.when(userRepository.save(Mockito.any(User.class))).thenAnswer(call -> call.getArgument(0));
        Mockito.when(jwtService.generateToken(Mockito.any(User.class))).thenReturn("jwt-token");

        authService.register(request);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        assertEquals(Role.TEAM_MEMBER, saved.getValue().getRole());
    }

    @Test
    void registerRejectsAnEmailThatIsAlreadyTaken() {
        RegisterRequest request = new RegisterRequest("Alice Member", "alice@example.com", "Str0ng!Pass");
        Mockito.when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyExistsException.class, () -> authService.register(request));

        // Nothing hashed, nothing saved, no token minted.
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any());
        Mockito.verifyNoInteractions(passwordEncoder, jwtService);
    }

    // ---- login ----

    @Test
    void loginReturnsATokenForTheRightPassword() {
        LoginRequest request = new LoginRequest("alice@example.com", "Str0ng!Pass");
        User user = existing(true);
        Mockito.when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        Mockito.when(passwordEncoder.matches("Str0ng!Pass", "$2a$10$hashed")).thenReturn(true);
        Mockito.when(jwtService.generateToken(user)).thenReturn("jwt-token");

        AuthResponse response = authService.login(request);

        assertEquals("jwt-token", response.token());
        assertEquals(Role.TEAM_MEMBER, response.role());
    }

    @Test
    void loginRejectsAWrongPassword() {
        LoginRequest request = new LoginRequest("alice@example.com", "wrong");
        Mockito.when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing(true)));
        Mockito.when(passwordEncoder.matches("wrong", "$2a$10$hashed")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> authService.login(request));
        Mockito.verifyNoInteractions(jwtService);
    }

    @Test
    void loginRejectsAnUnknownEmailWithTheSameExceptionAsAWrongPassword() {
        LoginRequest request = new LoginRequest("nobody@example.com", "Str0ng!Pass");
        Mockito.when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        // Same exception type as a wrong password, deliberately: a different answer here
        // would turn the login endpoint into a way to test whether an address has an account.
        assertThrows(InvalidCredentialsException.class, () -> authService.login(request));
        Mockito.verifyNoInteractions(passwordEncoder, jwtService);
    }

    @Test
    void loginRejectsADisabledAccountEvenWithTheRightPassword() {
        LoginRequest request = new LoginRequest("alice@example.com", "Str0ng!Pass");
        Mockito.when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing(false)));
        Mockito.when(passwordEncoder.matches("Str0ng!Pass", "$2a$10$hashed")).thenReturn(true);

        // Checked here as well as in CustomUserDetails and JwtAuthFilter, because this method
        // verifies the password directly rather than going through an AuthenticationProvider
        // that would have applied it.
        assertThrows(InvalidCredentialsException.class, () -> authService.login(request));
        Mockito.verifyNoInteractions(jwtService);
    }

    @Test
    void loginChecksThePasswordBeforeTheEnabledFlag() {
        // Order matters for what it discloses: if enabled were checked first, a wrong password
        // against a disabled account would still reveal that the account is disabled.
        LoginRequest request = new LoginRequest("alice@example.com", "wrong");
        Mockito.when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing(false)));
        Mockito.when(passwordEncoder.matches("wrong", "$2a$10$hashed")).thenReturn(false);

        assertThrows(InvalidCredentialsException.class, () -> authService.login(request));
        Mockito.verify(passwordEncoder).matches("wrong", "$2a$10$hashed");
    }
}
