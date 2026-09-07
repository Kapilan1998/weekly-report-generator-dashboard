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
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException(request.email());
        }

        // Self-registration always yields a TEAM_MEMBER. A client-supplied role here would let anyone
        // mint a MANAGER account against this permitAll endpoint and walk through every hasRole('MANAGER')
        // gate. Manager accounts come from the seed data and the admin user-management endpoint.
        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Role.TEAM_MEMBER)
                .build();

        User saved = userRepository.save(user);
        return toAuthResponse(saved, jwtService.generateToken(saved));
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        // Checked here because this method verifies the password directly rather than going
        // through an AuthenticationProvider, which would have applied it. Deliberately the
        // same generic error as a wrong password: telling a caller "this account is disabled"
        // confirms the address exists.
        if (!user.isEnabled()) {
            throw new InvalidCredentialsException();
        }

        return toAuthResponse(user, jwtService.generateToken(user));
    }

    private AuthResponse toAuthResponse(User user, String token) {
        return new AuthResponse(token, user.getId(), user.getName(), user.getEmail(), user.getRole());
    }
}
