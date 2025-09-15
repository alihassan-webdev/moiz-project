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

export function AppLayout({ children }: PropsWithChildren) {
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
                  <SidebarMenuButton asChild isActive>
                    <a href="/">
                      <Home />
                      <span>Dashboard</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="/">
                      <FileText />
                      <span>Generate</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <SidebarSeparator className="my-2" />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="#settings">
                      <Settings />
                      <span>Settings</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <div className="px-3 py-2 text-xs text-muted-foreground">
              PDF Question Generator
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="font-semibold">Dashboard</div>
            <div className="ml-auto">
              <Button variant="outline" asChild>
                <a href="https://api-va5v.onrender.com/generate-questions" target="_blank" rel="noreferrer">API</a>
              </Button>
            </div>
          </header>
          <main className={cn("container mx-auto px-4 py-6")}>{children}</main>
          <footer className="border-t bg-background/50">
            <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-center sm:text-left">Upload a PDF and generate questions with your query.</p>
                <a
                  href="https://api-va5v.onrender.com/generate-questions"
                  target="_blank"
                  className="text-primary hover:underline"
                  rel="noreferrer"
                >
                  API: /generate-questions
                </a>
              </div>
            </div>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default AppLayout;
