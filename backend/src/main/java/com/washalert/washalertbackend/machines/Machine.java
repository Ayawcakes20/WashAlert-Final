package com.washalert.washalertbackend.machines;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "machines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Machine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Matches frontend "machineId": "L-W-01"
    @Column(name = "machine_id", nullable = false, unique = true, length = 30)
    private String machineId;

    // Branch name (Light / Shore)
    @Column(nullable = false, length = 60)
    private String branch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MachineType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MachineStatus status;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
