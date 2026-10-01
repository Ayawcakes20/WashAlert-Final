import { useEffect, useState, useMemo } from "react";
import {
  Search,
  MapPin,
  Pencil,
  Loader2,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  Building,
  Navigation,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { customersApi, type CustomerRecord } from "@/lib/api";

interface CustomerAddressManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerAddressManagerDialog({
  open,
  onOpenChange,
}: CustomerAddressManagerDialogProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Edit sub-dialog state
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [editForm, setEditForm] = useState({
    address: "",
    addressLine1: "",
    addressLine2: "",
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ address?: string }>({});

  const fetchCustomers = async (searchQuery: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await customersApi.search(searchQuery.trim());
      setCustomers(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchCustomers(query);
    }
  }, [open]);

  // Debounced search on query change
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void fetchCustomers(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleOpenEdit = (cust: CustomerRecord) => {
    setEditingCustomer(cust);
    const addr = cust.address || "";
    let line1 = cust.addressLine1 || "";
    if (line1 && addr && line1.toLowerCase() === addr.toLowerCase()) {
      line1 = "";
    }
    setEditForm({
      address: addr,
      addressLine1: line1,
      addressLine2: cust.addressLine2 || "",
    });
    setFormErrors({});
  };

  const handleSaveAddress = async () => {
    if (!editingCustomer) return;
    const trimmedAddress = editForm.address.trim();
    if (!trimmedAddress) {
      setFormErrors({ address: "Street address is required." });
      return;
    }

    setSaving(true);
    try {
      const trimmedLine1 = editForm.addressLine1.trim();
      const cleanLine1 =
        trimmedLine1.toLowerCase() === trimmedAddress.toLowerCase() ? "" : trimmedLine1;
      const trimmedLine2 = editForm.addressLine2.trim();

      const updated = await customersApi.updateAddress(editingCustomer.id, {
        address: trimmedAddress,
        addressLine1: cleanLine1,
        addressLine2: trimmedLine2,
      });

      // Update in local list
      setCustomers((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );

      toast.success("Default address updated successfully!", {
        description: `Updated address for ${editingCustomer.fullName}`,
      });
      setEditingCustomer(null);
    } catch (err: any) {
      toast.error("Failed to update address", {
        description: err?.message || "Unable to save customer address.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Customer Address Manager
                  <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
                    Staff & Admin
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Search customers by name, phone number, or email to directly update their default addresses.
                </DialogDescription>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative mt-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer by full name, phone number (09XXXXXXXXX), or email..."
                className="pl-10 pr-9 h-11 text-sm bg-background border-border shadow-xs focus-visible:ring-teal-500"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </DialogHeader>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-muted/20">
            {loading && customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-3" />
                <p className="text-sm font-medium">Looking up customers...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-destructive gap-2">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">No customers found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                  {query
                    ? `No customers matched "${query}". Try searching with a different name or phone number.`
                    : "No registered customers found yet."}
                </p>
              </div>
            ) : (
              customers.map((c) => {
                const hasAddress = Boolean(c.address && c.address.trim());
                const cleanLine1 =
                  c.addressLine1 && c.address && c.addressLine1.toLowerCase() === c.address.toLowerCase()
                    ? ""
                    : c.addressLine1;

                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-teal-500/30 transition-all duration-150 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-teal-500/20 to-teal-700/30 text-teal-700 font-bold flex items-center justify-center text-sm shrink-0">
                        {c.fullName
                          ?.split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "CU"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm text-foreground truncate">
                            {c.fullName || "WashAlert Customer"}
                          </h4>
                          <Badge
                            variant={c.status === "ACTIVE" ? "default" : "secondary"}
                            className="text-[10px] uppercase font-bold py-0 h-4.5 bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            {c.status || "ACTIVE"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          {c.mobileNumber ? (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3 text-teal-600" />
                              {c.mobileNumber}
                            </span>
                          ) : null}
                          {c.email ? (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {c.email}
                            </span>
                          ) : null}
                        </div>

                        {/* Address Display Box */}
                        <div className="mt-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                            <span>Default Address:</span>
                          </div>
                          {hasAddress ? (
                            <div className="mt-1 pl-5 space-y-0.5">
                              <p className="text-foreground font-medium">{c.address}</p>
                              {cleanLine1 ? (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground/80">Line 1:</span>{" "}
                                  {cleanLine1}
                                </p>
                              ) : null}
                              {c.addressLine2 ? (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground/80">Line 2:</span>{" "}
                                  {c.addressLine2}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-1 pl-5 text-amber-600 italic">
                              No default address on file. Click "Edit Address" to assign one.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center md:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(c)}
                        className="w-full md:w-auto font-medium border-teal-600/30 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit Address
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border bg-card flex justify-between items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {customers.length} customer{customers.length === 1 ? "" : "s"}
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Edit Address Modal */}
      <Dialog open={!!editingCustomer} onOpenChange={(o) => !o && setEditingCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Edit Default Address
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Update customer's delivery address on record.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingCustomer ? (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-1">
                <p className="font-semibold text-foreground text-sm">
                  {editingCustomer.fullName}
                </p>
                <div className="flex items-center gap-3 text-muted-foreground font-mono">
                  {editingCustomer.mobileNumber ? <span>{editingCustomer.mobileNumber}</span> : null}
                  {editingCustomer.email ? <span>{editingCustomer.email}</span> : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-street" className="text-xs font-semibold flex items-center gap-1">
                  Street Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cust-street"
                  value={editForm.address}
                  onChange={(e) => {
                    setEditForm((prev) => ({ ...prev, address: e.target.value }));
                    if (formErrors.address) setFormErrors({});
                  }}
                  placeholder="e.g. 305 ML Quezon St., San Antonio"
                  className={formErrors.address ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {formErrors.address ? (
                  <p className="text-[11px] text-destructive">{formErrors.address}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-line1" className="text-xs font-semibold flex items-center gap-1">
                  Address Line 1 <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="cust-line1"
                  value={editForm.addressLine1}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, addressLine1: e.target.value }))
                  }
                  placeholder="Unit, Floor, Building (e.g. Unit 4B, 3rd Floor)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-line2" className="text-xs font-semibold flex items-center gap-1">
                  Address Line 2 <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="cust-line2"
                  value={editForm.addressLine2}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, addressLine2: e.target.value }))
                  }
                  placeholder="Landmark, Delivery Notes (e.g. Near City Hall)"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingCustomer(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAddress}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Save Address
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
