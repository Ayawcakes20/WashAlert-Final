package com.washalert.washalertbackend.machines;

import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface MachineRepository extends JpaRepository<Machine, Long> {

    Optional<Machine> findByMachineId(String machineId);

    // Branch is free text with no canonical entity/FK (see BranchNames), so every query below
    // normalizes the same way JobOrderRepository/UserRepository already do — a raw match
    // silently returns empty/zero whenever the stored branch string uses a different naming
    // convention (e.g. "Quezon City" vs "Quezon City Branch"). lockByBranch in particular is
    // the other half of the booking-capacity check (paired with JobOrderRepository's slot
    // count) — an unnormalized lock here can serialize on the wrong (empty) machine set while
    // the real machines for that branch are never locked.
    @Query("select m from Machine m where replace(lower(m.branch), ' branch', '') = replace(lower(:branch), ' branch', '')")
    List<Machine> findByNormalizedBranch(@Param("branch") String branch);

    // Intentionally NOT normalized — MachineSeeder uses this to find rows still holding a
    // specific known-wrong branch string so it can rename them. Normalizing this particular
    // lookup would make it over-match rows that are already correctly named.
    List<Machine> findByBranchIgnoreCase(String branch);

    List<Machine> findByType(MachineType type);

    List<Machine> findByStatus(MachineStatus status);

    long countByStatus(MachineStatus status);

    @Query("select count(m) from Machine m where m.status = :status and replace(lower(m.branch), ' branch', '') = replace(lower(:branch), ' branch', '')")
    long countByStatusAndNormalizedBranch(@Param("status") MachineStatus status, @Param("branch") String branch);

    @Query("select count(m) from Machine m where replace(lower(m.branch), ' branch', '') = replace(lower(:branch), ' branch', '') and m.status <> :status")
    long countByNormalizedBranchAndStatusNot(@Param("branch") String branch, @Param("status") MachineStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Machine m where replace(lower(m.branch), ' branch', '') = replace(lower(:branch), ' branch', '')")
    List<Machine> lockByBranch(@Param("branch") String branch);

    // Returns distinct branch names that have at least one non-maintenance machine.
    // Used by GET /api/machines/branches to populate branch dropdowns in admin UI.
    @Query("select distinct m.branch from Machine m where m.branch is not null " +
           "and m.status <> com.washalert.washalertbackend.machines.MachineStatus.MAINTENANCE " +
           "order by m.branch")
    List<String> findDistinctActiveBranches();
}
