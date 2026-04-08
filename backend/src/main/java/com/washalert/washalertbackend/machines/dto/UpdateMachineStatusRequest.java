package com.washalert.washalertbackend.machines.dto;

import com.washalert.washalertbackend.machines.MachineStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateMachineStatusRequest(
        @NotNull(message = "Status is required.")
        MachineStatus status
) {}
