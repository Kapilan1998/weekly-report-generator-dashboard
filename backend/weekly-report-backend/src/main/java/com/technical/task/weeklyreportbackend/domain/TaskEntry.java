package com.technical.task.weeklyreportbackend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

import java.math.BigDecimal;

@Entity
@Table(name = "task_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaskEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_version_id", nullable = false)
    private ReportVersion reportVersion;

    /** Assigned by the service from the request list index; the payload does not carry it. */
    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "task_name", nullable = false, length = 255)
    private String taskName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status;

    @Column(name = "planned_percent", nullable = false)
    private Integer plannedPercent;

    @Column(name = "actual_percent", nullable = false)
    private Integer actualPercent;

    @Column(name = "time_planned_hours", nullable = false, precision = 5, scale = 2)
    private BigDecimal timePlannedHours;

    @Column(name = "time_spent_hours", nullable = false, precision = 5, scale = 2)
    private BigDecimal timeSpentHours;

    @Column(name = "output_deliverable", length = 500)
    private String outputDeliverable;
}
