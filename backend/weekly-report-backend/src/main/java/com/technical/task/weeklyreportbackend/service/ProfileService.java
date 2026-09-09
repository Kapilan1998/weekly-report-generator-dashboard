package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.AuthResponse;
import com.technical.task.weeklyreportbackend.dto.ChangePasswordRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateProfileRequest;
import com.technical.task.weeklyreportbackend.exception.EmailAlreadyExistsException;
import com.technical.task.weeklyreportbackend.exception.IncorrectPasswordException;
import com.technical.task.weeklyreportbackend.exception.UserNotFoundException;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import com.technical.task.weeklyreportbackend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Self-service account editing: your own name, email and password.
 *
 * <p>Separate from {@link UserAdminService} because the two answer different questions.
 * That one administers <em>access</em> — who is a manager, whose account is disabled — and is
 * manager-only. This one edits <em>identity</em>, is open to any signed-in user, and can only
 * ever touch the caller's own row: it re-reads the actor by id and never accepts a user id
 * from the request, so there is no parameter to tamper with.
 *
 * <h2>Why both methods return a whole AuthResponse</h2>
 * The JWT's subject is the user's email (see {@link JwtService}). Change the email and the
 * token in the caller's hands names a user that no longer exists, so the next request fails
 * authentication and the client signs them out — editing your email would look like being
 * logged out at random. Returning a freshly signed token lets the client swap it in and carry
 * on, and it keeps the cached display name and email in step at the same time.
 */
@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * @param actor the caller, as resolved from their token — the only account this can edit
     */
    @Transactional
    public AuthResponse updateProfile(UpdateProfileRequest request, User actor) {
        // Re-read rather than trusting the detached entity the JWT filter built: the row may
        // have changed since the token was issued, and this method is about to save it.
        User user = userRepository.findById(actor.getId()).orElseThrow(UserNotFoundException::new);

        // Normalised the same way UserAdminService.create does it, so an address cannot exist
        // twice in different cases and then fail to match at login.
        String email = request.email().trim().toLowerCase();

        // Only checked when the address actually changes. Comparing against the stored value
        // first is what makes "save without touching the email" work — otherwise the account
        // would collide with itself and every save would 409.
        if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        user.setName(request.name().trim());
        user.setEmail(email);
        User saved = userRepository.save(user);

        return toAuthResponse(saved);
    }

    @Transactional
    public AuthResponse changePassword(ChangePasswordRequest request, User actor) {
        User user = userRepository.findById(actor.getId()).orElseThrow(UserNotFoundException::new);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IncorrectPasswordException();
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        User saved = userRepository.save(user);

        /*
         * A new token, though nothing in it has changed — the subject is the email, which this
         * method leaves alone, so the old one keeps working. It is issued anyway so the client
         * has one uniform way to finish either edit, and so the fresh expiry reflects the
         * moment the password changed.
         *
         * What this does NOT do is end the account's other sessions. Tokens are stateless and
         * carry no version, so an already-issued one stays valid until it expires; revoking
         * them would need a token version on the user row, checked in JwtAuthFilter. Noted as
         * a future improvement rather than half-done.
         */
        return toAuthResponse(saved);
    }

    private AuthResponse toAuthResponse(User user) {
        return new AuthResponse(
                jwtService.generateToken(user),
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole());
    }
}
