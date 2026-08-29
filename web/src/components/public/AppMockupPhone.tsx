import svcWash from "@/assets/app-preview/svc-wash.jpg";
import svcDry from "@/assets/app-preview/svc-dry.jpg";

const TABS = [
  {
    label: "Home",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9v-5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V20h2.5a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    label: "Orders",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </svg>
    ),
  },
  {
    label: "Book",
    center: true,
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-full h-full" stroke="#fff" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="13" r="5" />
        <circle cx="8.5" cy="6.5" r="0.8" fill="#fff" />
      </svg>
    ),
  },
  {
    label: "Alerts",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: "Profile",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
];

/** Code-rendered preview of the real customer Home tab (mobile/src/screens/customer/HomeScreen.jsx). */
export default function AppMockupPhone({ compact = false }: { compact?: boolean }) {
  const t = compact
    ? { title: "text-[11px]", greet: "text-[9px]", price: "text-[10px]", name: "text-[9px]", section: "text-[10px]", order: "text-[7px]", status: "text-[9px]" }
    : { title: "text-sm", greet: "text-[11px]", price: "text-[12px]", name: "text-[11px]", section: "text-[13px]", order: "text-[9px]", status: "text-[11px]" };

  return (
    <div className="w-full h-full bg-[#f3f5f7] flex flex-col text-left">
      {/* Header */}
      <div className="bg-[#16283c] px-3 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-[#2E86C1]" />
          </div>
          <span className={`text-white font-extrabold tracking-tight ${t.title}`}>WashAlert</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.38 8.5 8.5 0 0 1-4-1L3 20l1.12-5.5a8.38 8.38 0 0 1-1-4A8.38 8.38 0 0 1 11.5 2a8.5 8.5 0 0 1 8.5 8.5Z" />
            </svg>
          </div>
          <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Hero / greeting + services card */}
        <div className="bg-[#16283c] px-3 pb-4">
          <p className={`text-white/70 ${t.greet} leading-tight`}>
            Hi <span className="text-white font-semibold">Jeya</span>, <span className="text-[#7ec8e3] font-semibold">Here's</span>
          </p>
          <p className={`text-white font-extrabold ${t.section} mb-2.5`}>Our Laundry Services.</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl overflow-hidden bg-white">
              <div className="h-10 w-full overflow-hidden">
                <img src={svcWash} alt="Wash service" className="w-full h-full object-cover" />
              </div>
              <div className="p-1.5">
                <span className="inline-block text-[6.5px] font-semibold px-1 py-0.5 rounded-full bg-[#D6EAF8] text-[#2E86C1] mb-1">Standard</span>
                <p className={`font-bold text-[#2E86C1] ${t.price}`}>₱80 / 7kg</p>
                <p className={`font-bold text-foreground ${t.name}`}>Wash</p>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden bg-white">
              <div className="h-10 w-full overflow-hidden">
                <img src={svcDry} alt="Dry service" className="w-full h-full object-cover" />
              </div>
              <div className="p-1.5">
                <span className="inline-block text-[6.5px] font-semibold px-1 py-0.5 rounded-full bg-[#FFF1F2] text-[#E11D48] mb-1">Standard</span>
                <p className={`font-bold text-[#E11D48] ${t.price}`}>₱90 / 7kg</p>
                <p className={`font-bold text-foreground ${t.name}`}>Dry</p>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-1 rounded-full bg-white/10 py-1.5">
            <span className={`text-white/90 font-medium ${t.order}`}>View Package Details &amp; Inclusions</span>
          </div>
        </div>

        {/* Active orders */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`font-extrabold text-foreground ${t.status}`}>Active Orders</span>
            <span className={`font-semibold text-[#2E86C1] ${t.order}`}>See all</span>
          </div>
          <div className="rounded-xl bg-white p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`inline-flex items-center gap-1 font-bold text-[#2E86C1] ${t.order}`}>
                <span className="w-1 h-1 rounded-full bg-[#2E86C1]" /> PRICE CONFIRMED
              </span>
              <span className="inline-flex items-center gap-0.5 bg-[#16283c] text-white rounded-full px-1.5 py-0.5 text-[6.5px] font-semibold">
                Track Live
              </span>
            </div>
            <p className={`font-extrabold text-foreground ${t.status}`}>Price Confirmed</p>
            <p className={`text-muted-foreground ${t.order} mb-1.5`}>Order #WA-10261</p>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i === 0 ? "bg-[#16283c]" : "bg-border"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-end justify-around border-t border-border py-1.5 bg-white flex-shrink-0">
        {TABS.map((tab, i) =>
          tab.center ? (
            <div key={tab.label} className="flex flex-col items-center -mt-3">
              <div className="w-7 h-7 rounded-xl bg-[#16283c] flex items-center justify-center p-1.5 shadow">
                {tab.icon(true)}
              </div>
            </div>
          ) : (
            <div key={tab.label} className="flex flex-col items-center gap-0.5 p-1">
              <div className={`w-3 h-3 ${i === 0 ? "text-[#16283c]" : "text-muted-foreground/50"}`}>{tab.icon(i === 0)}</div>
              <span className={`text-[5.5px] font-semibold ${i === 0 ? "text-[#16283c]" : "text-muted-foreground/60"}`}>{tab.label}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
