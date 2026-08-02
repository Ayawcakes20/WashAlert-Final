package com.washalert.washalertbackend.common;

import java.util.Locale;

/**
 * Branch is stored as free text with no canonical entity/FK, so the same branch ends up
 * written inconsistently across rows — e.g. "Quezon City" in one place, "Quezon City Branch"
 * in another. A raw equals()/equalsIgnoreCase() comparison silently treats these as different
 * branches, which previously caused an empty driver dropdown in the Assign Delivery modal and
 * (audited separately) affects booking slot capacity, dashboards, inventory, payments,
 * deliveries, and announcements the same way.
 * <p>
 * This normalization — lowercase, trim, strip a trailing " branch" — mirrors the pattern
 * already proven correct in {@code UserRepository.findInternalUsersPaged} and
 * {@code JobOrderRepository.findPagedWithFilters}. Use {@link #matches(String, String)} for
 * in-Java comparisons (e.g. STAFF branch-authorization checks); for JPQL queries, inline the
 * equivalent {@code replace(lower(x.branch), ' branch', '')} expression directly, since JPQL
 * cannot call a Java method.
 */
public final class BranchNames {

    private BranchNames() {
    }

    public static String normalize(String branch) {
        if (branch == null) return null;
        return branch.trim().toLowerCase(Locale.ROOT).replace(" branch", "");
    }

    public static boolean matches(String a, String b) {
        if (a == null || b == null) return false;
        return normalize(a).equals(normalize(b));
    }
}
