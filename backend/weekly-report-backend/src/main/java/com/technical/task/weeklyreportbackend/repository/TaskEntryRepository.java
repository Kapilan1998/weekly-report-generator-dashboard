package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.TaskEntry;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Aggregates over task rows for the dashboard charts.
 *
 * <p>Every query restricts to each report's highest version number. Task rows hang off a
 * <em>version</em>, so without that restriction a report that went through one correction
 * cycle would contribute its tasks twice.
 */
public interface TaskEntryRepository extends JpaRepository<TaskEntry, Long> {

    interface WeeklyCount {
        LocalDate getWeekStart();

        long getCompletedTasks();
    }

    interface ProjectHours {
        Long getProjectId();

        BigDecimal getHoursSpent();
    }

    @Query("""
            select r.weekStart as weekStart, count(t.id) as completedTasks
            from TaskEntry t
              join t.reportVersion rv
              join rv.report r
            where r.weekStart between :from and :to
              and t.status = :status
              and rv.versionNumber = (
                  select max(v.versionNumber) from ReportVersion v where v.report = r)
            group by r.weekStart
            order by r.weekStart
            """)
    List<WeeklyCount> countCompletedTasksByWeek(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("status") TaskStatus status);

    @Query("""
            select p.id as projectId, coalesce(sum(t.timeSpentHours), 0) as hoursSpent
            from TaskEntry t
              join t.reportVersion rv
              join rv.report r
              join r.project p
            where r.weekStart between :from and :to
              and rv.versionNumber = (
                  select max(v.versionNumber) from ReportVersion v where v.report = r)
            group by p.id
            """)
    List<ProjectHours> sumHoursSpentByProject(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
