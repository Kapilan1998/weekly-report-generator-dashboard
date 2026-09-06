package com.technical.task.weeklyreportbackend.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One submission's worth of report content.
 *
 * <p>{@code submittedAt == null} marks the single open working copy, which is edited in
 * place. A version with {@code submittedAt != null} is frozen: no code path updates it or
 * its children, which is what keeps earlier versions visible after a correction cycle.
 */
@Entity
@Table(name = "report_versions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private Report report;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "tasks_planned_next_week", length = 4000)
    private String tasksPlannedNextWeek;

    @Column(length = 4000)
    private String notes;

    @Column(length = 1000)
    private String links;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Setter(AccessLevel.NONE)
    @Builder.Default
    @OneToMany(mappedBy = "reportVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private List<TaskEntry> taskEntries = new ArrayList<>();

    @Setter(AccessLevel.NONE)
    @Builder.Default
    @OneToMany(mappedBy = "reportVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private List<Blocker> blockers = new ArrayList<>();

    @Setter(AccessLevel.NONE)
    @Builder.Default
    @OneToMany(mappedBy = "reportVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private List<Achievement> achievements = new ArrayList<>();

    @Setter(AccessLevel.NONE)
    @Builder.Default
    @OneToMany(mappedBy = "reportVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<HoursEntry> hoursEntries = new ArrayList<>();

    public boolean isFrozen() {
        return submittedAt != null;
    }

    /**
     * Collections are replaced through these methods rather than via setters: reassigning a
     * collection mapped with orphanRemoval throws "collection with cascade=all-delete-orphan
     * was no longer referenced".
     */
    public void replaceTaskEntries(List<TaskEntry> replacements) {
        taskEntries.clear();
        replacements.forEach(entry -> entry.setReportVersion(this));
        taskEntries.addAll(replacements);
    }

    public void replaceBlockers(List<Blocker> replacements) {
        blockers.clear();
        replacements.forEach(entry -> entry.setReportVersion(this));
        blockers.addAll(replacements);
    }

    public void replaceAchievements(List<Achievement> replacements) {
        achievements.clear();
        replacements.forEach(entry -> entry.setReportVersion(this));
        achievements.addAll(replacements);
    }

    public void replaceHoursEntries(List<HoursEntry> replacements) {
        hoursEntries.clear();
        replacements.forEach(entry -> entry.setReportVersion(this));
        hoursEntries.addAll(replacements);
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
