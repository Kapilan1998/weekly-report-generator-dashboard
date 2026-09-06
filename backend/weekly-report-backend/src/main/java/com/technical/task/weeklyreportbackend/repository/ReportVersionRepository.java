package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReportVersionRepository extends JpaRepository<ReportVersion, Long> {

    /** The report's current version — the working copy if one is open, else the last frozen one. */
    Optional<ReportVersion> findTopByReportIdOrderByVersionNumberDesc(Long reportId);

    /**
     * The single method every manager-facing content read goes through, so a manager can
     * never be served the member's half-typed correction.
     */
    Optional<ReportVersion> findTopByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(Long reportId);

    /** Version history: submitted snapshots only — the open working copy is not a version yet. */
    List<ReportVersion> findByReportIdAndSubmittedAtIsNotNullOrderByVersionNumberDesc(Long reportId);

    Optional<ReportVersion> findByReportIdAndVersionNumber(Long reportId, Integer versionNumber);
}
