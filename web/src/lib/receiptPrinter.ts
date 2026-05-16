// Receipt printer utility — builds a full print-ready HTML receipt and opens
// it in a new window for browser printing. No external PDF library required.

type ReceiptOrder = {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  branch?: string;
  serviceType?: string;
  serviceName?: string;
  loadSize?: string;
  laundryType?: string;
  estimatedWeightKg?: number;
  actualWeightKg?: number;
  detergent?: string;
  detergentQuantity?: number;
  conditioner?: string;
  conditionerQuantity?: number;
  rushPrice?: number;
  deliveryPrice?: number;
  servicePrice?: number;
  extraWeightCost?: number;
  systemFee?: number;
  finalPrice?: number;
  totalPrice?: number;
  paymentMethod?: string;
  paymentStatus?: string | null;
  isPaid?: boolean;
  status?: string;
  createdAt?: string;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending Booking",
  ORDER_RECEIVED: "Received at Branch",
  AWAITING_PRICE_CONFIRMATION: "Awaiting Confirmation",
  PRICE_CONFIRMED: "Price Approved",
  WASHING: "Washing",
  DRYING: "Drying",
  READY: "Ready for Pickup",
  ASSIGNED_FOR_DELIVERY: "Assigned",
  EN_ROUTE_TO_BRANCH: "Heading to Branch",
  PICKED_UP_FROM_BRANCH: "Picked Up",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  COLLECTION_FAILED: "Delivery Failed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

function fmtDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  try {
    return d.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

function fmtMoney(n: number): string {
  return "₱" + n.toFixed(2);
}

function infoRow(label: string, value: string): string {
  if (!value || value === "N/A" || value.trim() === "") return "";
  return `
    <tr>
      <td class="info-label">${label}</td>
      <td class="info-value">${value}</td>
    </tr>`;
}

function chargeRow(label: string, amount: number, muted = false): string {
  const cls = muted ? "charge-muted" : "";
  return `
    <tr class="${cls}">
      <td class="charge-label">${label}</td>
      <td class="charge-amount">${fmtMoney(amount)}</td>
    </tr>`;
}

function computeLoadsDisplay(order: ReceiptOrder): string {
  const actualKg = order.actualWeightKg ?? 0;
  if (actualKg <= 0) return "N/A";
  const name = (order.serviceName ?? "").toLowerCase();
  if (name.includes("handwash")) return "1 load (by kg)";
  const limit = name.includes("ecowash")
    ? 5
    : name.includes("wash") && !name.includes("full")
    ? 7
    : 8;
  const loads = Math.ceil(actualKg / limit);
  return `${loads} load${loads !== 1 ? "s" : ""}`;
}

function buildReceiptHtml(order: ReceiptOrder, autoPrint = true): { html: string; trackingDisplay: string } {
  const trackingDisplay = String(order.orderId || "").replace(/^WA-/, "");

  const detPPP =
    order.detergent && order.detergent.toLowerCase() !== "none"
      ? order.detergent.toLowerCase().includes("ariel")
        ? 30
        : 25
      : 0;
  const detCost = detPPP * (order.detergentQuantity || 1);

  const conPPP =
    order.conditioner && order.conditioner.toLowerCase() !== "none"
      ? order.conditioner.toLowerCase().includes("downy")
        ? 25
        : 15
      : 0;
  const conCost = conPPP * (order.conditionerQuantity || 1);

  const serviceBase = order.servicePrice ?? 0;
  const extraWeight = order.extraWeightCost ?? 0;
  const rush = order.rushPrice ?? 0;
  const delivery = order.deliveryPrice ?? 0;
  const subtotal = serviceBase + extraWeight + rush + detCost + conCost + delivery;
  const sysFee =
    order.systemFee ?? Math.round(subtotal * 0.02 * 100) / 100;
  const total = order.finalPrice ?? order.totalPrice ?? subtotal + sysFee;

  const paymentMethodDisplay = String(order.paymentMethod || "Cash on Delivery").replace(/_/g, " ");
  const paymentStatusDisplay = order.paymentStatus
    ? String(order.paymentStatus)
    : order.isPaid
    ? "PAID"
    : "PENDING";
  const orderStatusDisplay = statusLabels[order.status ?? ""] ?? (order.status ?? "N/A");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>WashAlert Receipt — WA-${trackingDisplay}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #111;
      background: #fff;
    }
    .page {
      width: 72mm;
      margin: 10mm auto;
      padding: 0 2mm;
    }
    .center { text-align: center; }
    hr.dash {
      border: none;
      border-top: 1px dashed #bbb;
      margin: 9px 0;
    }
    hr.solid {
      border: none;
      border-top: 2px solid #111;
      margin: 9px 0;
    }
    .brand {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .receipt-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #666;
      margin-top: 3px;
    }
    .branch-line {
      font-size: 10px;
      color: #888;
      margin-top: 2px;
    }
    .tracking {
      font-size: 21px;
      font-weight: 900;
      color: #1a56db;
      letter-spacing: -0.5px;
      margin: 5px 0 2px;
    }
    .receipt-date { font-size: 10px; color: #888; }
    .section-label {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 4px;
    }
    .info-table, .charge-table {
      width: 100%;
      border-collapse: collapse;
    }
    .info-label {
      font-size: 10px;
      color: #777;
      padding: 2px 0;
      vertical-align: top;
      width: 42%;
    }
    .info-value {
      font-size: 10px;
      font-weight: 700;
      color: #111;
      text-align: right;
      padding: 2px 0;
    }
    .charge-label {
      font-size: 11px;
      color: #555;
      padding: 3px 0;
    }
    .charge-amount {
      font-size: 11px;
      font-weight: 700;
      text-align: right;
      padding: 3px 0;
      font-family: 'Courier New', monospace;
    }
    .charge-muted .charge-label,
    .charge-muted .charge-amount {
      color: #aaa;
    }
    .total-wrap {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 4px 0;
    }
    .total-label {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #888;
    }
    .total-amount {
      font-size: 22px;
      font-weight: 900;
      color: #1a56db;
    }
    .payment-block { text-align: right; }
    .payment-method {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .payment-status { font-size: 10px; color: #666; }
    .footer {
      text-align: center;
      font-size: 9px;
      color: #aaa;
      line-height: 1.6;
      margin-top: 6px;
    }
    .footer .stars { letter-spacing: 3px; }
    @media print {
      body { margin: 0; }
      .page { margin: 0 auto; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="center">
    <div class="brand">WashAlert</div>
    <div class="receipt-title">Official Receipt / Transaction Record</div>
    <div class="branch-line">${order.branch || "Branch N/A"} &mdash; Open 7:00 AM &ndash; 10:00 PM</div>
  </div>

  <hr class="dash"/>

  <div class="center">
    <div class="tracking">WA-${trackingDisplay}</div>
    <div class="receipt-date">${fmtDate(order.createdAt)}</div>
  </div>

  <hr class="dash"/>

  <p class="section-label">Order Information</p>
  <table class="info-table">
    <tbody>
      ${infoRow("Customer", order.customerName || "N/A")}
      ${order.customerPhone ? infoRow("Contact", order.customerPhone) : ""}
      ${infoRow("Branch", order.branch || "N/A")}
      ${infoRow("Service", order.serviceName || "N/A")}
      ${infoRow(
        "Service Type",
        order.serviceType === "PICKUP_DELIVERY" ? "Pickup &amp; Delivery" : "Drop-Off"
      )}
      ${order.loadSize ? infoRow(
        "Load Classification",
        String(order.loadSize).charAt(0).toUpperCase() + String(order.loadSize).slice(1).toLowerCase()
      ) : ""}
      ${order.laundryType ? infoRow("Laundry Type", order.laundryType) : ""}
      ${infoRow(
        "Est. Weight",
        order.estimatedWeightKg ? `${order.estimatedWeightKg} kg` : "N/A"
      )}
      ${infoRow(
        "Actual Weight",
        order.actualWeightKg ? `${order.actualWeightKg} kg` : "N/A"
      )}
      ${infoRow("No. of Loads", computeLoadsDisplay(order))}
      ${
        order.detergent && order.detergent.toLowerCase() !== "none"
          ? infoRow(
              "Detergent",
              `${order.detergent} &times; ${order.detergentQuantity || 1} pack(s) &mdash; ${fmtMoney(detPPP)}/pack`
            )
          : ""
      }
      ${
        order.conditioner && order.conditioner.toLowerCase() !== "none"
          ? infoRow(
              "Fabric Conditioner",
              `${order.conditioner} &times; ${order.conditionerQuantity || 1} pack(s) &mdash; ${fmtMoney(conPPP)}/pack`
            )
          : ""
      }
      ${infoRow("Order Status", orderStatusDisplay)}
    </tbody>
  </table>

  <hr class="dash"/>

  <p class="section-label">Charges</p>
  <table class="charge-table">
    <tbody>
      ${serviceBase > 0 ? chargeRow(order.serviceName || "Service Fee", serviceBase) : ""}
      ${extraWeight > 0 ? chargeRow("Extra Weight Surcharge", extraWeight) : ""}
      ${rush > 0 ? chargeRow("Rush Service Fee", rush) : ""}
      ${
        detCost > 0
          ? chargeRow(
              `${order.detergent} Detergent &times;${order.detergentQuantity || 1}`,
              detCost
            )
          : ""
      }
      ${
        conCost > 0
          ? chargeRow(
              `${order.conditioner} Conditioner &times;${order.conditionerQuantity || 1}`,
              conCost
            )
          : ""
      }
      ${delivery > 0 ? chargeRow("Pickup / Delivery Fee", delivery) : ""}
      ${chargeRow("System &amp; Convenience Fee (2%)", sysFee, true)}
    </tbody>
  </table>

  <hr class="solid"/>

  <div class="total-wrap">
    <div>
      <div class="total-label">Total Amount Due</div>
      <div class="total-amount">${fmtMoney(total)}</div>
    </div>
    <div class="payment-block">
      <div class="payment-method">${paymentMethodDisplay}</div>
      <div class="payment-status">${paymentStatusDisplay}</div>
    </div>
  </div>

  <hr class="dash"/>

  <div class="footer">
    <div class="stars">* * * * * * * * * * * *</div>
    <p>Thank you for choosing WashAlert!</p>
    <p style="margin-top:4px;font-style:italic;">This receipt is system-generated.</p>
    <p>WA-${trackingDisplay} &mdash; ${new Date().getFullYear()}</p>
  </div>

</div>
${autoPrint ? `<script>
  window.onload = function () {
    window.print();
    setTimeout(function () { window.close(); }, 600);
  };
</script>` : ""}
</body>
</html>`;

  return { html, trackingDisplay };
}

export function printOrderReceipt(order: ReceiptOrder): void {
  const { html } = buildReceiptHtml(order);
  const win = window.open("", "_blank", "width=440,height=680,toolbar=0,menubar=0");
  if (!win) {
    alert("Please allow pop-ups for this site to print receipts, then try again.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function downloadOrderReceipt(order: ReceiptOrder): void {
  const { html, trackingDisplay } = buildReceiptHtml(order, false);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WashAlert-Receipt-WA-${trackingDisplay}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
