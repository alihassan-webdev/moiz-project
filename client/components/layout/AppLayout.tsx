import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileText, Home, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const path = location.pathname;
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    setRouteLoading(true);
    const t = setTimeout(() => setRouteLoading(false), 450);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <SidebarProvider>
      <div className="group/sidebar-wrapper flex min-h-svh w-full">
        <Sidebar collapsible="icon" className="bg-[radial-gradient(120%_80%_at_10%_10%,rgba(18,83,83,0.18),transparent),linear-gradient(180deg,rgba(12,34,46,0.95),rgba(8,20,28,0.95))] text-white border-0">
          <SidebarHeader>
            <Link to="/" className="flex items-center gap-3 px-4 py-3" aria-label="Home">
              {/* Logo and label removed as requested */}
              <span className="sr-only">Home</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <nav className="px-3">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/"}>
                    <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/6">
                      <Home />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <SidebarSeparator className="my-3" />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/settings"}>
                    <Link to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/6">
                      <Settings />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-4 py-3 text-sm text-secondary">v1.0</div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="font-semibold">Dashboard</div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="secondary" size="icon" aria-label="Settings">
                <Link to="/settings">
                  <Settings />
                </Link>
              </Button>
              {routeLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="opacity-25"
                    />
                    <path
                      d="M22 12a10 10 0 0 1-10 10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-75"
                    />
                  </svg>
                </div>
              )}
            </div>
          </header>
          <main className={cn("container mx-auto px-4 py-6")}>{children}</main>
          <footer className="border-t bg-background/50">
            <div className="container mx-auto px-4 py-6" />
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default AppLayout;
