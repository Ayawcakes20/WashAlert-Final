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

    List<Machine> findByBranchIgnoreCase(String branch);

    List<Machine> findByType(MachineType type);

    List<Machine> findByStatus(MachineStatus status);

    long countByStatus(MachineStatus status);

    long countByStatusAndBranchIgnoreCase(MachineStatus status, String branch);

    long countByBranchIgnoreCaseAndStatusNot(String branch, MachineStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Machine m where lower(m.branch) = lower(:branch)")
    List<Machine> lockByBranch(@Param("branch") String branch);
}
