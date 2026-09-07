package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findAllByOrderByNameAsc();

    /** Guards the "don't leave the system without a manager" rule. */
    long countByRoleAndEnabledTrue(Role role);
}
