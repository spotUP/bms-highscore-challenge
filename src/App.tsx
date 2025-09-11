import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AchievementProvider } from "@/contexts/AchievementContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import HyperspaceEffect from "@/components/HyperspaceEffect";
import VHSOverlay from "@/components/VHSOverlay";
import PerformanceWrapper from "@/components/PerformanceWrapper";
import TournamentAccessGuard from "@/components/TournamentAccessGuard";
import Index from "./pages/Index";
import "./styles/performance.css";

// Lazy load heavy components
const MobileEntry = lazy(() => import("./pages/MobileEntry"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthVerify = lazy(() => import("./pages/AuthVerify"));
const LinkExpired = lazy(() => import("./pages/LinkExpired"));
const Admin = lazy(() => import("./pages/Admin"));
const Statistics = lazy(() => import("./pages/Statistics"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard"));
const Achievements = lazy(() => import("./pages/Achievements"));
const DemolitionManSubmit = lazy(() => import("./pages/DemolitionManSubmit"));

const queryClient = new QueryClient();

// Loading component for lazy routes
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center relative z-10"
       style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
    <div className="text-white text-xl animate-pulse">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TournamentProvider>
        <AchievementProvider>
          <ThemeProvider>
          <PerformanceWrapper>
            <TooltipProvider>
            <HyperspaceEffect />
            <VHSOverlay />
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/mobile-entry" element={<MobileEntry />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/verify" element={<AuthVerify />} />
                  <Route path="/auth/expired" element={<LinkExpired />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/player" element={<PlayerDashboard />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/demolition-man-submit" element={<DemolitionManSubmit />} />
                  
                  {/* Tournament-scoped routes with access control */}
                  <Route path="/t/:slug" element={<TournamentAccessGuard><Index /></TournamentAccessGuard>} />
                  <Route path="/t/:slug/admin" element={<TournamentAccessGuard><Admin /></TournamentAccessGuard>} />
                  <Route path="/t/:slug/statistics" element={<TournamentAccessGuard><Statistics /></TournamentAccessGuard>} />
                  <Route path="/t/:slug/achievements" element={<TournamentAccessGuard><Achievements /></TournamentAccessGuard>} />
                  <Route path="/t/:slug/mobile-entry" element={<TournamentAccessGuard><MobileEntry /></TournamentAccessGuard>} />
                  <Route path="/t/:slug/demolition-man-submit" element={<TournamentAccessGuard><DemolitionManSubmit /></TournamentAccessGuard>} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            </TooltipProvider>
          </PerformanceWrapper>
          </ThemeProvider>
        </AchievementProvider>
      </TournamentProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
