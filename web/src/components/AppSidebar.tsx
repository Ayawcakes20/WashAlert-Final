import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  BarChart3,
  MessageCircle,
  Info,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";
import { authApi } from "@/lib/api";
import { clearFirebaseWebSession, clearSessionUser, getSessionUser } from "@/lib/session";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);
  const currentUser = getSessionUser();
  const isAdmin = currentUser?.role === "ADMIN";

  const navModules = useMemo(
    () =>
      [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, visible: true },
        { title: "User Management", url: "/users", icon: Users, visible: isAdmin },
        { title: "Order Management", url: "/orders", icon: ClipboardList, visible: !isAdmin },
        { title: "Predictive Inventory", url: "/inventory", icon: Package, visible: true },
        { title: "AI Analytics & Reports", url: "/analytics", icon: BarChart3, visible: isAdmin },
        { title: "AI Chat Support", url: "/chat-support", icon: MessageCircle, visible: true },
      ].filter((item) => item.visible),
    [isAdmin],
  );

  const otherItems = [
    { title: "Profile Settings", url: "/profile", icon: UserCircle },
    { title: "About", url: "/about", icon: Info }
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    setLogoutSubmitting(true);
    try {
      await authApi.logout();
      toast.success("Signed out successfully.");
    } catch {
      // best effort logout
    } finally {
      clearSessionUser();
      clearFirebaseWebSession();
      setLogoutSubmitting(false);
      setConfirmLogoutOpen(false);
      navigate("/login");
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <img
              src={logoLaundryHubs}
              alt="WashAlert"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-sidebar-primary/30"
            />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground">WashAlert</span>
                <span className="text-[10px] font-medium text-sidebar-primary">Management System</span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 mb-1">
              Main Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navModules.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} className="h-10 rounded-lg transition-all duration-200">
                      <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {otherItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} className="h-10 rounded-lg transition-all duration-200">
                      <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="h-10 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <button
                  type="button"
                  onClick={() => setConfirmLogoutOpen(true)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Sign Out</span>}
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={confirmLogoutOpen} onOpenChange={setConfirmLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out now?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be logged out from this device and redirected to login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={logoutSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleSignOut(); }} disabled={logoutSubmitting}>
              {logoutSubmitting ? "Signing out..." : "Sign Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
