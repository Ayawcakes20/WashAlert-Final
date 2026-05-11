package com.washalert.washalertbackend.inventory;

import com.washalert.washalertbackend.inventory.dto.AdjustInventoryRequest;
import com.washalert.washalertbackend.inventory.dto.CreateInventoryItemRequest;
import com.washalert.washalertbackend.inventory.dto.InventoryForecastResponse;
import com.washalert.washalertbackend.inventory.dto.InventoryItemResponse;
import com.washalert.washalertbackend.inventory.dto.UpdateInventoryItemRequest;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<InventoryItemResponse> list(
            @RequestParam(required = false) String branch,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return inventoryService.list(branch, principal);
    }

    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public PagedResponse<InventoryItemResponse> listPaged(
            @RequestParam(required = false) String branch,
            @AuthenticationPrincipal AuthUserDetails principal,
            @PageableDefault(size = 20, sort = "itemName", direction = Sort.Direction.ASC) Pageable pageable
    ) {
        return inventoryService.listPaged(branch, principal, pageable);
    }

    @PostMapping("/items")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public InventoryItemResponse create(@Valid @RequestBody CreateInventoryItemRequest req) {
        return inventoryService.create(req);
    }

    @PutMapping("/items/{itemId}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public InventoryItemResponse update(
            @PathVariable Long itemId,
            @Valid @RequestBody UpdateInventoryItemRequest req
    ) {
        return inventoryService.update(itemId, req);
    }

    @PatchMapping("/items/{itemId}/adjust")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public InventoryItemResponse adjust(
            @PathVariable Long itemId,
            @Valid @RequestBody AdjustInventoryRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return inventoryService.adjust(itemId, req, principal);
    }

    @GetMapping("/alerts")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<InventoryItemResponse> lowStockAlerts(@AuthenticationPrincipal AuthUserDetails principal) {
        return inventoryService.lowStockAlerts(principal);
    }

    @GetMapping("/forecast")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<InventoryForecastResponse> forecast(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String days,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return inventoryService.forecast(branch, parsePositiveIntOrNull(days), principal);
    }

    private Integer parsePositiveIntOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        try {
            return Integer.parseInt(trimmed);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    @DeleteMapping("/items/{itemId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long itemId) {
        inventoryService.delete(itemId);
    }
}
