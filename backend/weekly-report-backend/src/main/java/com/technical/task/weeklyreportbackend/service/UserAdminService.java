package com.technical.task.weeklyreportbackend.service;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.CreateUserRequest;
import com.technical.task.weeklyreportbackend.dto.UpdateUserRequest;
import com.technical.task.weeklyreportbackend.dto.UserDetailResponse;
import com.technical.task.weeklyreportbackend.exception.EmailAlreadyExistsException;
import com.technical.task.weeklyreportbackend.exception.LastManagerException;
import com.technical.task.weeklyreportbackend.exception.SelfAdministrationException;
import com.technical.task.weeklyreportbackend.exception.UserInUseException;
import com.technical.task.weeklyreportbackend.exception.UserNotFoundException;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Manager-facing account administration: add a team member, change a role, disable or delete
 * an account.
 *
 * <p>Three guards run through it, each protecting against a change that is hard or impossible
 * to undo:
 * <ul>
 *   <li>Nobody may change their own role or disable themselves — demoting yourself removes the
 *       access needed to reverse it.</li>
 *   <li>No change may leave zero enabled managers, after which no report could be reviewed and
 *       no access restored.</li>
 *   <li>A user who has filed reports cannot be deleted, only disabled — their authorship is
 *       part of the audit trail.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class UserAdminService {

    private final UserRepository userRepository;
    private final ReportRepository reportRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserDetailResponse> list() {
        return userRepository.findAllByOrderByNameAsc().stream().map(this::toDetail).toList();
    }

    @Transactional
    public UserDetailResponse create(CreateUserRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        User saved = userRepository.save(User.builder()
                .name(request.name().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(request.role())
                .enabled(true)
                .build());

        return toDetail(saved);
    }

    @Transactional
    public UserDetailResponse update(Long userId, UpdateUserRequest request, User actor) {
        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);

        boolean roleChanged = user.getRole() != request.role();
        boolean beingDisabled = !Boolean.TRUE.equals(request.enabled());

        // Compared by id: the actor comes from the JWT filter and is a detached entity.
        if (user.getId().equals(actor.getId()) && (roleChanged || beingDisabled)) {
            throw new SelfAdministrationException();
        }

        // Would this remove the last enabled manager? Checked before mutating anything.
        boolean losingAManager = user.getRole() == Role.MANAGER
                && user.isEnabled()
                && (request.role() != Role.MANAGER || beingDisabled);
        if (losingAManager && userRepository.countByRoleAndEnabledTrue(Role.MANAGER) <= 1) {
            throw new LastManagerException();
        }

        user.setRole(request.role());
        user.setEnabled(Boolean.TRUE.equals(request.enabled()));

        return toDetail(userRepository.save(user));
    }

    @Transactional
    public void delete(Long userId, User actor) {
        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);

        if (user.getId().equals(actor.getId())) {
            throw new SelfAdministrationException();
        }

        long reportCount = reportRepository.countByUserId(userId);
        if (reportCount > 0) {
            throw new UserInUseException(reportCount);
        }

        if (user.getRole() == Role.MANAGER
                && user.isEnabled()
                && userRepository.countByRoleAndEnabledTrue(Role.MANAGER) <= 1) {
            throw new LastManagerException();
        }

        userRepository.delete(user);
    }

    private UserDetailResponse toDetail(User user) {
        return new UserDetailResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.isEnabled(),
                reportRepository.countByUserId(user.getId()),
                user.getCreatedAt());
    }
}
