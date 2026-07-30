package com.washalert.washalertbackend.announcement;

import com.washalert.washalertbackend.announcement.dto.AnnouncementResponse;
import com.washalert.washalertbackend.announcement.dto.CreateAnnouncementRequest;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AnnouncementService {

    private static final List<Role> ANNOUNCEMENT_AUDIENCE_ROLES = List.of(Role.CUSTOMER, Role.DRIVER, Role.STAFF);

    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;
    private final JobOrderRepository jobOrderRepository;
    private final AnnouncementNotificationGateway notificationGateway;

    public AnnouncementService(
            AnnouncementRepository announcementRepository,
            UserRepository userRepository,
            JobOrderRepository jobOrderRepository,
            AnnouncementNotificationGateway notificationGateway
    ) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
        this.jobOrderRepository = jobOrderRepository;
        this.notificationGateway = notificationGateway;
    }

    @Transactional
    public AnnouncementResponse create(CreateAnnouncementRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();
        if (actor.getRole() != Role.ADMIN && actor.getRole() != Role.STAFF) {
            throw new IllegalArgumentException("Only admin or staff can create announcements.");
        }

        String requestedBranch = blankToNull(req.branch());
        boolean targetAllBranches = requestedBranch == null;
        String targetBranch = requestedBranch;

        if (actor.getRole() == Role.STAFF) {
            String staffBranch = blankToNull(actor.getBranch());
            if (staffBranch == null) {
                throw new IllegalArgumentException("Staff account has no assigned branch.");
            }
            targetAllBranches = false;
            targetBranch = staffBranch;
        }

        Announcement announcement = Announcement.builder()
                .title(req.title().trim())
                .message(req.message().trim())
                .type(req.type())
                .targetAllBranches(targetAllBranches)
                .branch(targetBranch)
                .createdByUserId(actor.getId())
                .createdByName(actor.getFullName())
                .build();

        Announcement saved = announcementRepository.save(announcement);

        List<User> recipients = resolveRecipients(saved);
        notificationGateway.dispatchInApp(saved, recipients);
        notificationGateway.dispatchPush(saved, recipients);
        notificationGateway.dispatchSms(saved, recipients);

        return toResponse(saved);
    }

    public List<AnnouncementResponse> listHistory(AuthUserDetails principal) {
        User actor = principal.getUser();
        List<Announcement> rows;
        if (actor.getRole() == Role.ADMIN || actor.getRole() == Role.CUSTOMER || actor.getRole() == Role.DRIVER) {
            rows = announcementRepository.findTop100ByOrderByCreatedAtDesc();
        } else {
            String actorBranch = blankToNull(actor.getBranch());
            if (actorBranch == null) {
                rows = announcementRepository.findTop100ByOrderByCreatedAtDesc();
            } else {
                rows = announcementRepository.findTop100ByTargetAllBranchesTrueOrBranchIgnoreCaseOrderByCreatedAtDesc(
                        actorBranch
                );
            }
        }
        return rows.stream().map(this::toResponse).toList();
    }

    public List<Announcement> listForUser(User viewer) {
        if (viewer == null) {
            return List.of();
        }

        if (viewer.getRole() == Role.ADMIN || viewer.getRole() == Role.CUSTOMER || viewer.getRole() == Role.DRIVER) {
            return announcementRepository.findTop100ByOrderByCreatedAtDesc();
        }

        String audienceBranch = resolveAudienceBranch(viewer);
        if (audienceBranch == null) {
            return announcementRepository.findTop100ByOrderByCreatedAtDesc();
        }
        return announcementRepository.findTop100ByTargetAllBranchesTrueOrBranchIgnoreCaseOrderByCreatedAtDesc(audienceBranch);
    }

    private List<User> resolveRecipients(Announcement announcement) {
        List<User> audience = userRepository.findByRoleIn(ANNOUNCEMENT_AUDIENCE_ROLES);
        if (announcement.isTargetAllBranches()) {
            return audience;
        }

        String branch = blankToNull(announcement.getBranch());
        if (branch == null) {
            return audience;
        }

        return audience.stream()
                .filter(user -> sameBranch(resolveAudienceBranch(user), branch))
                .toList();
    }

    private String resolveAudienceBranch(User user) {
        String branch = blankToNull(user.getBranch());
        if (branch != null) {
            return branch;
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            return null;
        }

        return jobOrderRepository.findTopByCustomerEmailIgnoreCaseOrderByCreatedAtDesc(user.getEmail())
                .map(JobOrder::getBranch)
                .map(this::blankToNull)
                .orElse(null);
    }

    private AnnouncementResponse toResponse(Announcement announcement) {
        return new AnnouncementResponse(
                announcement.getId(),
                announcement.getTitle(),
                announcement.getMessage(),
                announcement.getType(),
                announcement.isTargetAllBranches(),
                announcement.getBranch(),
                announcement.getCreatedByUserId(),
                announcement.getCreatedByName(),
                announcement.getCreatedAt()
        );
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean sameBranch(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }
}
