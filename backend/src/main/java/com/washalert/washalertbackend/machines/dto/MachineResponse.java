package com.washalert.washalertbackend.machines.dto;

import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.machines.MachineType;

import java.time.LocalDateTime;

public record MachineResponse(
        Long id,
        String machineId,
        String branch,
        MachineType type,
        MachineStatus status,
        LocalDateTime updatedAt
) {}
