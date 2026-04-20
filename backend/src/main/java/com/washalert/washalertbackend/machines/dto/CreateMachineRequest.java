package com.washalert.washalertbackend.machines.dto;

import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.machines.MachineType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateMachineRequest(
        @NotBlank(message = "Machine ID is required.")
        String machineId,

        @NotBlank(message = "Branch is required.")
        String branch,

        @NotNull(message = "Type is required.")
        MachineType type,

        // optional: if null -> defaults to AVAILABLE
        MachineStatus status
) {}
