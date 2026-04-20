package com.washalert.washalertbackend.audit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffAuditLogRepository extends JpaRepository<StaffAuditLog, Long> {}
