import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/lib/auth-context";
import { PasscodeGate } from "@/components/passcode-gate";
import ComposePage from "@/pages/compose";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";
import ResultsPage from "@/pages/results";
import BenchmarkPage from "@/pages/benchmark";
import BenchmarkSubmissionPage from "@/pages/benchmark-submission";
import ProposalsAdminPage from "@/pages/proposals-admin";
import ArenaPage from "@/pages/arena";
import ToolkitPage from "@/pages/toolkit";
import LeaderboardPage from "@/pages/leaderboard";
import NotFound from "@/pages/not-found";

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/app" component={ComposePage} />
      <Route path="/compose" component={ComposePage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/results/:sessionId" component={ResultsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/benchmark" component={BenchmarkPage} />
      <Route path="/benchmarks" component={BenchmarkPage} />
      <Route path="/proposals" component={ProposalsAdminPage} />
      <Route path="/arena" component={ArenaPage} />
      <Route path="/toolkit" component={ToolkitPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <PasscodeGate>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto">
              <ProtectedRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </PasscodeGate>
  );
}

function AppRouter() {
  const [location] = useLocation();
  
  // Public routes - no authentication required
  if (location === "/" || location === "/benchmark-submit" || location === "/propose") {
    return <BenchmarkSubmissionPage />;
  }
  
  // All other routes require authentication
  return <ProtectedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRouter />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
