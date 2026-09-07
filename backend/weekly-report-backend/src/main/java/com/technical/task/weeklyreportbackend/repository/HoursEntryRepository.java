package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.HoursEntry;
import com.technical.task.weeklyreportbackend.domain.TaskType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface HoursEntryRepository extends JpaRepository<HoursEntry, Long> {

    interface TaskTypeHours {
        TaskType getTaskType();

        BigDecimal getHours();
    }

    /** Current versions only — see the note on TaskEntryRepository. */
    @Query("""
            select h.taskType as taskType, coalesce(sum(h.hours), 0) as hours
            from HoursEntry h
              join h.reportVersion rv
              join rv.report r
            where r.weekStart between :from and :to
              and rv.versionNumber = (
                  select max(v.versionNumber) from ReportVersion v where v.report = r)
            group by h.taskType
            """)
    List<TaskTypeHours> sumHoursByTaskType(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
