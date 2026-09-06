package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.Report;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ReportRepository extends JpaRepository<Report, Long>, JpaSpecificationExecutor<Report> {

    /**
     * Every mutating path (create, edit, submit, approve, request-changes) acquires the
     * report row through this before touching anything, so an edit and a submit cannot
     * interleave and leave a frozen version whose children changed after submission.
     *
     * <p>Declared explicitly rather than annotating the inherited findById — a {@code @Lock}
     * on an inherited method has no effect.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Report r where r.id = :id")
    Optional<Report> findWithLockById(Long id);

    boolean existsByUserIdAndWeekStart(Long userId, LocalDate weekStart);

    /** Fetches the to-ones the list rows render, so a page of reports is not an N+1. */
    @Override
    @EntityGraph(attributePaths = {"user", "project"})
    Page<Report> findAll(Specification<Report> specification, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"user", "project"})
    Optional<Report> findById(Long id);

    @EntityGraph(attributePaths = {"user", "project"})
    List<Report> findByWeekStart(LocalDate weekStart);
}
