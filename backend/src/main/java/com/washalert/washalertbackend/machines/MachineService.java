package com.washalert.washalertbackend.machines;

import com.washalert.washalertbackend.common.BranchNames;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.machines.dto.CreateMachineRequest;
import com.washalert.washalertbackend.machines.dto.MachineResponse;
import com.washalert.washalertbackend.machines.dto.MachineSummaryResponse;
import com.washalert.washalertbackend.machines.dto.UpdateMachineStatusRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
public class MachineService {

    private final MachineRepository repo;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;

    public MachineService(
            MachineRepository repo,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties
    ) {
        this.repo = repo;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
    }

    // Returns distinct branch names from active (non-maintenance) machines.
    public List<String> listBranches() {
        return repo.findDistinctActiveBranches();
    }

    public List<MachineResponse> listByBranch(String branch, AuthUserDetails principal) {
        User actor = principal.getUser();
        String effectiveBranch = resolveEffectiveBranch(branch, actor);

        if (!dataReadProperties.prefersFirestoreReads()) {
            return listFromMysql(effectiveBranch);
        }

        List<MachineResponse> firestoreRows = listFromFirestore(effectiveBranch);
        if (!firestoreRows.isEmpty()) {
            return firestoreRows;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return listFromMysql(effectiveBranch);
        }

        return firestoreRows;
    }

    public MachineSummaryResponse summary(AuthUserDetails principal) {
        List<MachineResponse> machines = listByBranch(null, principal);
        long available = machines.stream().filter(m -> m.status() == MachineStatus.AVAILABLE).count();
        long inUse = machines.stream().filter(m -> m.status() == MachineStatus.IN_USE).count();
        long maintenance = machines.stream().filter(m -> m.status() == MachineStatus.MAINTENANCE).count();
        return new MachineSummaryResponse(available, inUse, maintenance);
    }

    @Transactional
    public MachineResponse updateStatusByMachineId(String machineId, UpdateMachineStatusRequest req, AuthUserDetails principal) {
        Machine m = repo.findByMachineId(machineId)
                .orElseThrow(() -> new IllegalArgumentException("Machine not found."));

        // Reads are already branch-scoped via resolveEffectiveBranch(); this write path
        // previously had no such check, letting Branch-A staff flip any Branch-B machine to
        // MAINTENANCE — which also silently shrinks that branch's booking slot capacity.
        User actor = principal.getUser();
        if (actor.getRole() == Role.STAFF && !sameBranch(actor.getBranch(), m.getBranch())) {
            throw new IllegalArgumentException("You can only manage machines in your branch.");
        }

        if (m.getStatus() == req.status()) {
            return toResponse(m);
        }

        m.setStatus(req.status());
        m.setUpdatedAt(LocalDateTime.now());
        Machine saved = repo.save(m);
        firestoreSyncService.upsert("machines", saved.getMachineId(), toResponse(saved));

        return toResponse(saved);
    }

    @Transactional
    public MachineResponse create(CreateMachineRequest req) {
        String mid = (req.machineId() == null) ? "" : req.machineId().trim();
        if (mid.isEmpty()) throw new IllegalArgumentException("Machine ID is required.");

        repo.findByMachineId(mid).ifPresent(existing -> {
            throw new IllegalArgumentException("Machine ID already exists.");
        });

        Machine m = Machine.builder()
                .machineId(mid)
                .branch(req.branch().trim())
                .type(req.type())
                .status(req.status() == null ? MachineStatus.AVAILABLE : req.status())
                .updatedAt(LocalDateTime.now())
                .build();

        Machine saved = repo.save(m);
        firestoreSyncService.upsert("machines", saved.getMachineId(), toResponse(saved));
        return toResponse(saved);
    }

    private List<MachineResponse> listFromMysql(String effectiveBranch) {
        if (effectiveBranch == null) {
            return repo.findAll().stream()
                    .map(this::toResponse)
                    .sorted(Comparator.comparing(MachineResponse::machineId, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        }

        return repo.findByNormalizedBranch(effectiveBranch).stream()
                .map(this::toResponse)
                .sorted(Comparator.comparing(MachineResponse::machineId, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<MachineResponse> listFromFirestore(String effectiveBranch) {
        return firestoreReadService.listMachines().stream()
                .filter(m -> effectiveBranch == null || sameBranch(m.branch(), effectiveBranch))
                .sorted(Comparator.comparing(MachineResponse::machineId, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private String resolveEffectiveBranch(String requestedBranch, User actor) {
        if (actor.getRole() == Role.STAFF) {
            return actor.getBranch();
        }
        if (requestedBranch == null || requestedBranch.isBlank() || requestedBranch.equalsIgnoreCase("All")) {
            return null;
        }
        return requestedBranch.trim();
    }

    private boolean sameBranch(String a, String b) {
        return BranchNames.matches(a, b);
    }

    private MachineResponse toResponse(Machine m) {
        return new MachineResponse(
                m.getId(),
                m.getMachineId(),
                m.getBranch(),
                m.getType(),
                m.getStatus(),
                m.getUpdatedAt()
        );
    }
}
