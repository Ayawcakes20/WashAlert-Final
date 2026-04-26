import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { authApi, notificationsApi, type AppNotification, type MeResponse } from "@/lib/api";
import {
  clearFirebaseWebSession,
  clearSessionUser,
  getSessionUser,
  saveSessionUser,
} from "@/lib/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NOTIFICATION_SEEN_KEY = "washalert_seen_notifications";
const NOTIFICATIONS_PAGE_SIZE = 6;

const readSeenIds = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SEEN_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
};

const writeSeenIds = (ids: Set<string>) => {
  localStorage.setItem(NOTIFICATION_SEEN_KEY, JSON.stringify(Array.from(ids)));
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<MeResponse | null>(getSessionUser());
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => readSeenIds());
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [totalNotificationPages, setTotalNotificationPages] = useState(1);
  const [hasNextNotifications, setHasNextNotifications] = useState(false);
  const [hasPreviousNotifications, setHasPreviousNotifications] = useState(false);

  const loadNotifications = async (requestedPage = 0) => {
    setNotificationsLoading(true);
    try {
      const response = await notificationsApi.listPaged({
        page: requestedPage,
        size: NOTIFICATIONS_PAGE_SIZE,
      });
      setNotifications(response.content || []);
      setNotificationsPage((response.page || 0) + 1);
      setTotalNotificationPages(Math.max(1, response.totalPages || 1));
      setHasNextNotifications(Boolean(response.hasNext));
      setHasPreviousNotifications(Boolean(response.hasPrevious));
    } catch {
      setNotifications([]);
      setNotificationsPage(1);
      setTotalNotificationPages(1);
      setHasNextNotifications(false);
      setHasPreviousNotifications(false);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    const validateSession = async () => {
      try {
        const me = await authApi.me();
        saveSessionUser(me);
        setUser(me);
        await loadNotifications();
      } catch {
        clearSessionUser();
        clearFirebaseWebSession();
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    void validateSession();
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      void loadNotifications(Math.max(0, notificationsPage - 1));
    }, 45000);
    return () => clearInterval(timer);
  }, [notificationsPage]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenIds.has(n.id)).length,
    [notifications, seenIds],
  );

  const markRead = (notificationId: string) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(notificationId);
      writeSeenIds(next);
      return next;
    });
  };

  const markAllRead = () => {
    const next = new Set(seenIds);
    notifications.forEach((n) => next.add(n.id));
    writeSeenIds(next);
    setSeenIds(next);
  };

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);
    navigate(notification.route || "/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  const initials =
    user?.fullName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "WA";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b border-border/50 px-6 bg-card/60 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden md:flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 w-72">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search orders, customers..."
                  className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadCount > 0 ? (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-semibold text-white flex items-center justify-center">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-96">
                  <div className="flex items-center justify-between px-2">
                    <DropdownMenuLabel className="px-0">Notifications</DropdownMenuLabel>
                    {!!notifications.length ? (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <DropdownMenuSeparator />

                  {notificationsLoading ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">Loading notifications...</div>
                  ) : notifications.length ? (
                    notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        onClick={() => openNotification(notification)}
                        className="flex flex-col items-start gap-1 py-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              seenIds.has(notification.id) ? "bg-muted-foreground/30" : "bg-destructive"
                            }`}
                          />
                          <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground pl-4">{notification.message}</p>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground">No notifications available.</div>
                  )}
                  {totalNotificationPages > 1 ? (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-3 py-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="text-[11px] font-medium text-foreground disabled:opacity-50"
                          onClick={() => void loadNotifications(Math.max(0, notificationsPage - 2))}
                          disabled={!hasPreviousNotifications}
                        >
                          Previous
                        </button>
                        <span className="text-[11px] text-muted-foreground">
                          {notificationsPage}/{totalNotificationPages}
                        </span>
                        <button
                          type="button"
                          className="text-[11px] font-medium text-foreground disabled:opacity-50"
                          onClick={() => void loadNotifications(notificationsPage)}
                          disabled={!hasNextNotifications}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full gradient-navy flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {initials}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-foreground leading-none">{user?.fullName || "WashAlert User"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {user?.role === "ADMIN" ? "All Branches" : user?.branch || "Branch not set"}
                  </p>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 lg:p-8 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
