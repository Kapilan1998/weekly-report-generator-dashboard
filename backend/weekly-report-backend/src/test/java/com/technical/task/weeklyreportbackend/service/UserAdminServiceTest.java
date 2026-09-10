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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The three guards here each block a change that cannot be undone from the UI afterwards, so
 * they get a test apiece plus the cases that must still be allowed — a guard that blocks
 * everything is as broken as one that blocks nothing.
 */
@ExtendWith(MockitoExtension.class)
class UserAdminServiceTest {

    @InjectMocks
    UserAdminService userAdminService;

    @Mock
    UserRepository userRepository;

    @Mock
    ReportRepository reportRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    private User user(long id, String name, Role role, boolean enabled) {
        return User.builder()
                .id(id).name(name).email(name.toLowerCase().replace(' ', '.') + "@example.com")
                .passwordHash("$2a$10$hashed").role(role).enabled(enabled)
                .build();
    }

    private User manager() {
        return user(2L, "Mia Manager", Role.MANAGER, true);
    }

    // ---- list ----

    @Test
    void listReportsEachAccountsReportCount() {
        Mockito.when(userRepository.findAllByOrderByNameAsc())
                .thenReturn(List.of(user(1L, "Alice Member", Role.TEAM_MEMBER, true)));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(16L);

        List<UserDetailResponse> list = userAdminService.list();

        assertEquals(1, list.size());
        // What tells the UI whether to offer Delete or only Disable.
        assertEquals(16, list.get(0).reportCount());
        assertEquals("alice.member@example.com", list.get(0).email());
    }

    // ---- create ----

    @Test
    void createNormalisesTheEmailHashesThePasswordAndEnablesTheAccount() {
        CreateUserRequest request = new CreateUserRequest(
                "  Alice Member  ", "  Alice@Example.COM  ", "Str0ng!Pass", Role.TEAM_MEMBER);
        Mockito.when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        Mockito.when(passwordEncoder.encode("Str0ng!Pass")).thenReturn("$2a$10$hashed");
        Mockito.when(userRepository.save(Mockito.any(User.class))).thenAnswer(call -> call.getArgument(0));
        Mockito.when(reportRepository.countByUserId(Mockito.any())).thenReturn(0L);

        userAdminService.create(request);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        Mockito.verify(userRepository).save(saved.capture());
        assertEquals("alice@example.com", saved.getValue().getEmail());
        assertEquals("Alice Member", saved.getValue().getName());
        assertEquals("$2a$10$hashed", saved.getValue().getPasswordHash());
        // A new account that could not sign in would be useless; Lombok defaults a primitive
        // boolean to false, so this is set explicitly rather than left to the builder.
        assertTrue(saved.getValue().isEnabled());
    }

    @Test
    void createMayAssignTheManagerRole() {
        // Unlike self-registration - this endpoint is manager-only, and assigning a role is
        // the whole point of it.
        CreateUserRequest request = new CreateUserRequest(
                "Mia Manager", "mia@example.com", "Str0ng!Pass", Role.MANAGER);
        Mockito.when(userRepository.existsByEmail("mia@example.com")).thenReturn(false);
        Mockito.when(passwordEncoder.encode(Mockito.anyString())).thenReturn("$2a$10$hashed");
        Mockito.when(userRepository.save(Mockito.any(User.class))).thenAnswer(call -> call.getArgument(0));
        Mockito.when(reportRepository.countByUserId(Mockito.any())).thenReturn(0L);

        assertEquals(Role.MANAGER, userAdminService.create(request).role());
    }

    @Test
    void createRejectsATakenEmailCaseInsensitively() {
        CreateUserRequest request = new CreateUserRequest(
                "Alice Member", "ALICE@example.com", "Str0ng!Pass", Role.TEAM_MEMBER);
        Mockito.when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyExistsException.class, () -> userAdminService.create(request));
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any());
    }

    // ---- update: guard 1, no self-administration ----

    @Test
    void updateRefusesToChangeYourOwnRole() {
        User self = manager();
        Mockito.when(userRepository.findById(2L)).thenReturn(Optional.of(self));

        // Demoting yourself removes the access needed to reverse it.
        assertThrows(SelfAdministrationException.class,
                () -> userAdminService.update(2L, new UpdateUserRequest(Role.TEAM_MEMBER, true), self));
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any());
    }

    @Test
    void updateRefusesToDisableYourself() {
        User self = manager();
        Mockito.when(userRepository.findById(2L)).thenReturn(Optional.of(self));

        assertThrows(SelfAdministrationException.class,
                () -> userAdminService.update(2L, new UpdateUserRequest(Role.MANAGER, false), self));
    }

    @Test
    void updateAllowsANoopSaveOnYourOwnAccount() {
        // Same role, still enabled: nothing is being taken away, so the guard must not fire.
        User self = manager();
        Mockito.when(userRepository.findById(2L)).thenReturn(Optional.of(self));
        Mockito.when(userRepository.save(self)).thenReturn(self);
        Mockito.when(reportRepository.countByUserId(2L)).thenReturn(0L);

        assertDoesNotThrow(() ->
                userAdminService.update(2L, new UpdateUserRequest(Role.MANAGER, true), self));
    }

    // ---- update: guard 2, never zero enabled managers ----

    @Test
    void updateRefusesToDemoteTheLastEnabledManager() {
        User other = user(3L, "Tom Becker", Role.MANAGER, true);
        Mockito.when(userRepository.findById(3L)).thenReturn(Optional.of(other));
        Mockito.when(userRepository.countByRoleAndEnabledTrue(Role.MANAGER)).thenReturn(1L);

        // With nobody left to review, no report could be approved and no access restored.
        assertThrows(LastManagerException.class,
                () -> userAdminService.update(3L, new UpdateUserRequest(Role.TEAM_MEMBER, true), manager()));
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any());
    }

    @Test
    void updateRefusesToDisableTheLastEnabledManager() {
        User other = user(3L, "Tom Becker", Role.MANAGER, true);
        Mockito.when(userRepository.findById(3L)).thenReturn(Optional.of(other));
        Mockito.when(userRepository.countByRoleAndEnabledTrue(Role.MANAGER)).thenReturn(1L);

        assertThrows(LastManagerException.class,
                () -> userAdminService.update(3L, new UpdateUserRequest(Role.MANAGER, false), manager()));
    }

    @Test
    void updateAllowsDemotingAManagerWhenAnotherRemains() {
        User other = user(3L, "Tom Becker", Role.MANAGER, true);
        Mockito.when(userRepository.findById(3L)).thenReturn(Optional.of(other));
        Mockito.when(userRepository.countByRoleAndEnabledTrue(Role.MANAGER)).thenReturn(2L);
        Mockito.when(userRepository.save(other)).thenReturn(other);
        Mockito.when(reportRepository.countByUserId(3L)).thenReturn(0L);

        UserDetailResponse response =
                userAdminService.update(3L, new UpdateUserRequest(Role.TEAM_MEMBER, true), manager());

        assertEquals(Role.TEAM_MEMBER, response.role());
    }

    @Test
    void updateDoesNotCountManagersWhenNoManagerIsBeingLost() {
        // Promoting a team member cannot reduce the manager count, so the guard should not
        // even run the query.
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, true);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(userRepository.save(member)).thenReturn(member);
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(0L);

        userAdminService.update(1L, new UpdateUserRequest(Role.MANAGER, true), manager());

        Mockito.verify(userRepository, Mockito.never()).countByRoleAndEnabledTrue(Mockito.any());
    }

    @Test
    void updateRejectsAMissingAccount() {
        Mockito.when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class,
                () -> userAdminService.update(99L, new UpdateUserRequest(Role.TEAM_MEMBER, true), manager()));
    }

    // ---- delete: guard 3, authorship is part of the audit trail ----

    @Test
    void deleteRemovesAnAccountWithNoReports() {
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, true);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(0L);

        userAdminService.delete(1L, manager());

        Mockito.verify(userRepository).delete(member);
    }

    @Test
    void deleteRefusesAnAccountThatHasFiledReports() {
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, true);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(16L);

        // reports.user_id is NOT NULL with no cascade, and a submitted report's authorship is
        // part of the audit trail - so "remove" means disable for anyone who has ever filed.
        UserInUseException thrown =
                assertThrows(UserInUseException.class, () -> userAdminService.delete(1L, manager()));

        assertTrue(thrown.getMessage().contains("16"));
        Mockito.verify(userRepository, Mockito.never()).delete(Mockito.any());
    }

    @Test
    void deleteRefusesYourOwnAccount() {
        User self = manager();
        Mockito.when(userRepository.findById(2L)).thenReturn(Optional.of(self));

        assertThrows(SelfAdministrationException.class, () -> userAdminService.delete(2L, self));
        // Checked before the report count, so it cannot be worked around by having no reports.
        Mockito.verifyNoInteractions(reportRepository);
    }

    @Test
    void deleteRefusesTheLastEnabledManager() {
        User other = user(3L, "Tom Becker", Role.MANAGER, true);
        Mockito.when(userRepository.findById(3L)).thenReturn(Optional.of(other));
        Mockito.when(reportRepository.countByUserId(3L)).thenReturn(0L);
        Mockito.when(userRepository.countByRoleAndEnabledTrue(Role.MANAGER)).thenReturn(1L);

        assertThrows(LastManagerException.class, () -> userAdminService.delete(3L, manager()));
        Mockito.verify(userRepository, Mockito.never()).delete(Mockito.any());
    }

    @Test
    void deleteRejectsAMissingAccount() {
        Mockito.when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> userAdminService.delete(99L, manager()));
    }

    // ---- token version: a change to access ends the holder's session ----

    @Test
    void updateBumpsTheTokenVersionWhenTheRoleChanges() {
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, true);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(userRepository.save(Mockito.any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(0L);

        userAdminService.update(1L, new UpdateUserRequest(Role.MANAGER, true), manager());

        // Every token already issued for this account now carries a stale version, so the
        // promotion takes effect on their next request instead of up to an hour later.
        assertEquals(1, member.getTokenVersion());
    }

    @Test
    void updateBumpsTheTokenVersionWhenTheAccountIsDisabled() {
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, true);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(userRepository.save(Mockito.any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(0L);

        userAdminService.update(1L, new UpdateUserRequest(Role.TEAM_MEMBER, false), manager());

        assertEquals(1, member.getTokenVersion());
    }

    @Test
    void updateBumpsTheTokenVersionWhenTheAccountIsReEnabled() {
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, false);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(userRepository.save(Mockito.any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(0L);

        userAdminService.update(1L, new UpdateUserRequest(Role.TEAM_MEMBER, true), manager());

        assertEquals(1, member.getTokenVersion());
    }

    @Test
    void updateLeavesTheTokenVersionAloneWhenNothingChanged() {
        /*
         * The case that makes this feature tolerable to use. Saving the form without altering
         * anything - or re-selecting the role a member already has - must not sign them out.
         * Bumping unconditionally would log somebody out every time a manager looked at their
         * row and pressed save.
         */
        User member = user(1L, "Alice Member", Role.TEAM_MEMBER, true);
        Mockito.when(userRepository.findById(1L)).thenReturn(Optional.of(member));
        Mockito.when(userRepository.save(Mockito.any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        Mockito.when(reportRepository.countByUserId(1L)).thenReturn(0L);

        userAdminService.update(1L, new UpdateUserRequest(Role.TEAM_MEMBER, true), manager());

        assertEquals(0, member.getTokenVersion());
    }

    @Test
    void updateDoesNotBumpTheTokenVersionWhenItIsRefused() {
        // A refused change must not end anyone's session as a side effect: the guard throws
        // before anything is mutated, and this pins that ordering.
        User onlyManager = user(2L, "Mia Manager", Role.MANAGER, true);
        Mockito.when(userRepository.findById(2L)).thenReturn(Optional.of(onlyManager));
        Mockito.when(userRepository.countByRoleAndEnabledTrue(Role.MANAGER)).thenReturn(1L);

        assertThrows(LastManagerException.class, () -> userAdminService.update(
                2L, new UpdateUserRequest(Role.TEAM_MEMBER, true),
                user(9L, "Other Manager", Role.MANAGER, true)));

        assertEquals(0, onlyManager.getTokenVersion());
        Mockito.verify(userRepository, Mockito.never()).save(Mockito.any(User.class));
    }
}
