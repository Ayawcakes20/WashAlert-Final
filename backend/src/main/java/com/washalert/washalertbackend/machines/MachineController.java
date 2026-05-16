package com.washalert.washalertbackend.machines;

import com.washalert.washalertbackend.machines.dto.CreateMachineRequest;
import com.washalert.washalertbackend.machines.dto.MachineResponse;
import com.washalert.washalertbackend.machines.dto.MachineSummaryResponse;
import com.washalert.washalertbackend.machines.dto.UpdateMachineStatusRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/machines")
public class MachineController {

    private final MachineService service;

    public MachineController(MachineService service) {
        this.service = service;
    }

    // Returns sorted list of distinct branch names that have active machines.
    // Used by the admin UI to populate branch dropdowns dynamically.
    @GetMapping("/branches")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<String> listBranches() {
        return service.listBranches();
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<MachineResponse> list(
            @RequestParam(required = false) String branch,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.listByBranch(branch, principal);
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public MachineSummaryResponse summary(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.summary(principal);
    }

    @PutMapping("/{machineId}/status")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public MachineResponse updateStatus(
            @PathVariable String machineId,
            @Valid @RequestBody UpdateMachineStatusRequest req
    ) {
        return service.updateStatusByMachineId(machineId, req);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public MachineResponse create(@Valid @RequestBody CreateMachineRequest req) {
        return service.create(req);
    }
}
