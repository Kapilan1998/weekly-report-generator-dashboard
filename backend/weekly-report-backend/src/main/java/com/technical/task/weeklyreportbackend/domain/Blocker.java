package com.technical.task.weeklyreportbackend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "blockers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Blocker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_version_id", nullable = false)
    private ReportVersion reportVersion;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(nullable = false, length = 1000)
    private String description;

    /** At most one blocker per version may be the week's key issue; enforced in the service. */
    @Column(name = "key_issue", nullable = false)
    private boolean keyIssue;
}
