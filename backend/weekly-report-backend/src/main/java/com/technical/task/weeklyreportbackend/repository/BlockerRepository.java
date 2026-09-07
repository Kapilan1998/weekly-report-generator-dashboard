package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.Blocker;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BlockerRepository extends JpaRepository<Blocker, Long> {

    /**
     * "Open blockers across the team", as the brief's summary metrics require.
     *
     * <p>There is no {@code resolved} column on a blocker, so "open" is defined as: a blocker
     * on the <strong>current version</strong> of a report that has not been approved yet.
     * Once a report is approved its blockers are considered closed along with it. This
     * definition is recorded in docs/PHASE2_SPEC.md — changing it means changing both.
     */
    @Query("""
            select count(b.id)
            from Blocker b
              join b.reportVersion rv
              join rv.report r
            where r.status <> :approvedStatus
              and rv.versionNumber = (
                  select max(v.versionNumber) from ReportVersion v where v.report = r)
            """)
    long countOpen(@Param("approvedStatus") ReportStatus approvedStatus);
}
