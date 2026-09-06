package com.technical.task.weeklyreportbackend.repository;

import com.technical.task.weeklyreportbackend.domain.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    /**
     * Reports may only be tagged with an active project, so the lookup filters on active
     * rather than leaving the flag decorative.
     */
    Optional<Project> findByIdAndActiveTrue(Long id);

    List<Project> findByActiveTrueOrderByNameAsc();
}
