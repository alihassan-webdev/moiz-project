import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AppLayout from "@/components/layout/AppLayout";
import Settings from "./pages/Settings";
import { AnimatePresence, motion } from "framer-motion";
import { isLoggedIn } from "@/lib/auth";

const queryClient = new QueryClient();

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="min-h-[60vh] bg-background"
    >
      {children}
    </motion.div>
  );
}

function useAuth() {
  const [authed, setAuthed] = useState(isLoggedIn());
  useEffect(() => {
    const onChange = () => setAuthed(isLoggedIn());
    window.addEventListener("storage", onChange);
    window.addEventListener("auth-changed", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("auth-changed", onChange as EventListener);
    };
  }, []);
  return authed;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const authed = useAuth();
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  const isLoginRoute = location.pathname === "/login";
  return (
    <>
      {!isLoginRoute ? (
        <AppLayout>
          <AnimatePresence initial={false} mode="wait">
            <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageWrapper>
                <Index />
              </PageWrapper>
            }
          />
          <Route
            path="/settings"
            element={
              <PageWrapper>
                <Settings />
              </PageWrapper>
            }
          />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <PageWrapper>
                      <Index />
                    </PageWrapper>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <PageWrapper>
                      <Settings />
                    </PageWrapper>
                  </RequireAuth>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route
                path="*"
                element={
                  <PageWrapper>
                    <NotFound />
                  </PageWrapper>
                }
              />
            </Routes>
          </AnimatePresence>
        </AppLayout>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/login"
              element={
                <PageWrapper>
                  <Login />
                </PageWrapper>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AnimatePresence>
      )}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
