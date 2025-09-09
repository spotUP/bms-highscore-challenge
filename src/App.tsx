import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AchievementProvider } from "@/contexts/AchievementContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import HyperspaceEffect from "@/components/HyperspaceEffect";
import PerformanceWrapper from "@/components/PerformanceWrapper";
import Index from "./pages/Index";
import "./styles/performance.css";

// Lazy load heavy components
const MobileEntry = lazy(() => import("./pages/MobileEntry"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Statistics = lazy(() => import("./pages/Statistics"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard"));
const Achievements = lazy(() => import("./pages/Achievements"));
const DemolitionManSubmit = lazy(() => import("./pages/DemolitionManSubmit"));
const TournamentLanding = lazy(() => import("./pages/TournamentLanding"));

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
          <PerformanceWrapper>
            <TooltipProvider>
            <HyperspaceEffect />
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
                  <Route path="/tournaments" element={<TournamentLanding />} />
                  <Route path="/mobile-entry" element={<MobileEntry />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/player" element={<PlayerDashboard />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/demolition-man-submit" element={<DemolitionManSubmit />} />
                  
                  {/* Tournament-scoped routes */}
                  <Route path="/t/:slug" element={<Index />} />
                  <Route path="/t/:slug/admin" element={<Admin />} />
                  <Route path="/t/:slug/statistics" element={<Statistics />} />
                  <Route path="/t/:slug/achievements" element={<Achievements />} />
                  <Route path="/t/:slug/mobile-entry" element={<MobileEntry />} />
                  <Route path="/t/:slug/demolition-man-submit" element={<DemolitionManSubmit />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            </TooltipProvider>
          </PerformanceWrapper>
        </AchievementProvider>
      </TournamentProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
