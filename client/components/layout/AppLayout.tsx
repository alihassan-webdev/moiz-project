import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      <SiteHeader />
      <main className={cn("container mx-auto px-4 py-8")}>{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href="/" className="group inline-flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-fuchsia-500 transition-transform group-hover:scale-105" />
          <span className="text-lg font-semibold tracking-tight">PDF Question Generator</span>
        </a>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground">Home</a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-background/50">
      <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-center sm:text-left">Built for uploading a PDF and generating questions with your query.</p>
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
  );
}

export default AppLayout;
