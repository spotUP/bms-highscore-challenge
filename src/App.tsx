import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { AchievementProvider } from "@/contexts/AchievementContext";
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
                  <Route path="/mobile-entry" element={<MobileEntry />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/player" element={<PlayerDashboard />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/demolition-man-submit" element={<DemolitionManSubmit />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </PerformanceWrapper>
      </AchievementProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
