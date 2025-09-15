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
import { useLocation } from "react-router-dom";

export function AppLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const path = location.pathname;
  return (
    <SidebarProvider>
      <div className="group/sidebar-wrapper flex min-h-svh w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <a href="/" className="flex items-center gap-2 px-3 py-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-fuchsia-500" />
              <span className="font-semibold tracking-tight">Admin</span>
            </a>
          </SidebarHeader>
          <SidebarContent>
            <nav className="px-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/"}>
                    <a href="/">
                      <Home />
                      <span>Dashboard</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/generate"}>
                    <a href="/generate">
                      <FileText />
                      <span>Generate</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <SidebarSeparator className="my-2" />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/settings"}>
                    <a href="/settings">
                      <Settings />
                      <span>Settings</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-3 py-2" />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="font-semibold">Dashboard</div>
            <div className="ml-auto" />
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
