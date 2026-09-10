package com.technical.task.weeklyreportbackend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    /**
     * A disabled account cannot sign in and its existing tokens stop being accepted. This is
     * how a team member is retired — deleting them is impossible once they have filed a
     * report, since their authorship is part of the audit trail.
     *
     * <p>{@code @Builder.Default} matters here: Lombok defaults a primitive boolean to
     * {@code false}, so without it every account created through the builder would be born
     * unable to log in.
     */
    @Builder.Default
    @Column(nullable = false)
    private boolean enabled = true;

    /**
     * Bumped whenever a manager changes this account's role or enabled flag, which
     * invalidates every token already issued for it.
     *
     * <p>A JWT cannot be revoked - once signed it is valid until it expires - so the token
     * carries this number as a claim and {@code JwtAuthFilter} compares it against the row on
     * every request. A mismatch is treated as unauthenticated, so the holder is asked to sign
     * in again and picks up their new role on the way back.
     *
     * <p>{@code @Builder.Default} for the same reason as {@code enabled}: Lombok would
     * otherwise default the primitive to 0, which happens to be right today but would break
     * silently the moment the starting value changed.
     */
    @Builder.Default
    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
