import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { usePageTransitions } from "@/hooks/usePageTransitions";
import { AuthProvider } from "@/hooks/useAuth";
import { AchievementProvider } from "@/contexts/AchievementContext";
import { TournamentProvider } from "@/contexts/TournamentContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FullscreenProvider } from "@/contexts/FullscreenContext";
import HyperspaceEffect from "@/components/HyperspaceEffect";
import VHSOverlay from "@/components/VHSOverlay";
import PerformanceWrapper from "@/components/PerformanceWrapper";
import TournamentAccessGuard from "@/components/TournamentAccessGuard";
import { ScoreNotificationsListener } from "@/components/ScoreNotification";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import CompetitionRulesModal from "@/components/CompetitionRulesModal";
import CompetitionStatus from "@/components/CompetitionStatus";
import ManualRefreshButton from "@/components/ManualRefreshButton";
import TournamentDropdown from "@/components/TournamentDropdown";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { useTournamentGameData } from "@/hooks/useTournamentGameData";
import { useIsMobile } from "@/hooks/use-mobile";
import PerformanceMonitor from "@/components/PerformanceMonitor";
import { WelcomeModal } from "@/components/WelcomeModal";
import InteractiveHelpGuide from "@/components/InteractiveHelpGuide";
import { useHelpGuide, HelpGuideProvider } from "@/hooks/useHelpGuide";
import "./styles/performance.css";
import { BracketProvider } from "@/contexts/BracketContext";

// Lazy load heavy components
const MobileEntry = lazy(() => import("./pages/MobileEntry"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthVerify = lazy(() => import("./pages/AuthVerify"));
const LinkExpired = lazy(() => import("./pages/LinkExpired"));
const Admin = lazy(() => import("./pages/Admin"));
const Statistics = lazy(() => import("./pages/Statistics"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Brackets = lazy(() => import("./pages/Brackets"));
const BracketAdmin = lazy(() => import("./pages/BracketAdmin"));
const Competition = lazy(() => import("./pages/Competition"));
const RAWGGamesBrowser = lazy(() => import("./pages/RAWGGamesBrowser"));
const GamesBrowser = lazy(() => import("./pages/GamesBrowser"));
const ClearLogoTest = lazy(() => import("./components/ClearLogoTest"));

const queryClient = new QueryClient();

// Wrapper component for Index page with rules modal
const IndexWithRules = ({ isExiting }: { isExiting?: boolean }) => {
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const { isPerformanceMode } = usePerformanceMode();
  const { refetch } = useTournamentGameData();
  const isMobile = useIsMobile();

  return (
    <Layout topNavProps={{
      hideTournamentSelector: true,
      onShowRules: () => setIsRulesModalOpen(true),
      leftActions: !isMobile ? (
        <>
          <TournamentDropdown />
          <CompetitionStatus />
          {!isPerformanceMode && (
            <ManualRefreshButton onRefresh={refetch} />
          )}
        </>
      ) : undefined
    }}>
      <Index isExiting={isExiting} />
      <CompetitionRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </Layout>
  );
};

// Component for Bracket Admin specific actions
const BracketAdminActions = () => {
  const { animatedNavigate } = usePageTransitions({ exitDuration: 600 });

  return (
    <Button variant="outline" onClick={() => animatedNavigate('/')}>
      Highscores
    </Button>
  );
};

// Loading component for lazy routes
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center relative z-10"
       style={{ background: 'radial-gradient(ellipse at center, rgba(26, 16, 37, 0.9) 0%, rgba(26, 16, 37, 0.7) 100%)' }}>
    <div></div>
  </div>
);

// Persist and restore last visited route (e.g., Admin page) across reloads
function RoutePersistence() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestoredRef = useRef(false);

  // Save path on every navigation
  useEffect(() => {
    try {
      localStorage.setItem('lastPath', location.pathname + location.search + location.hash);
    } catch {}
  }, [location.pathname, location.search, location.hash]);

  // Restore saved path on first load if user landed on root
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const saved = localStorage.getItem('lastPath');
      // Only restore if we are at the root route and we actually have something saved
      if (location.pathname === '/' && saved && saved !== '/') {
        navigate(saved, { replace: true });
      }
    } catch {}
  // Run only on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// Global UI Components (no router dependency)
const GlobalUIComponents = () => {
  const location = useLocation();

  return (
    <>
      <HyperspaceEffect />
      <VHSOverlay />
      <Toaster />
      <Sonner />
      {/* Add Score Notifications Listener */}
      <ScoreNotificationsListener />
      {/* Welcome Modal for new users */}
      <WelcomeModal />
      {/* Performance Monitor (Ctrl+Shift+P to toggle) */}
      <PerformanceMonitor />
    </>
  );
};

// Help Guide Integration Component (inside router context)
const HelpGuideRenderer = () => {
  const { isOpen, currentTour, currentStepIndex, closeTour } = useHelpGuide();

  return (
    <InteractiveHelpGuide
      isOpen={isOpen}
      onClose={closeTour}
      steps={currentTour?.steps || []}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BracketProvider>
        <TournamentProvider>
          <AchievementProvider>
            <ThemeProvider>
              <FullscreenProvider>
                <PerformanceWrapper>
                  <TooltipProvider>
                    <HelpGuideProvider>
                      <BrowserRouter
                        future={{
                          v7_startTransition: true,
                          v7_relativeSplatPath: true,
                        }}
                      >
                        <GlobalUIComponents />
                        {/* Help Guide Renderer - inside router context */}
                        <HelpGuideRenderer />
                        {/* Persist and restore last visited route so reload returns to Admin if that was the last page */}
                        <RoutePersistence />
                      <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                          <Route path="/" element={<IndexWithRules />} />
                          <Route path="/admin/brackets" element={<Layout topNavProps={{ hideBracketsLink: true, rightActions: <BracketAdminActions /> }}><BracketAdmin /></Layout>} />
                          <Route path="/mobile-entry" element={<Layout><MobileEntry /></Layout>} />
                          <Route path="/auth" element={<Layout hideTopNav><Auth /></Layout>} />
                          <Route path="/auth/verify" element={<Layout hideTopNav><AuthVerify /></Layout>} />
                          <Route path="/auth/expired" element={<Layout hideTopNav><LinkExpired /></Layout>} />
                          <Route path="/admin" element={<Layout><Admin /></Layout>} />
                          <Route path="/statistics" element={<Layout topNavProps={{ hideStatistics: true }}><Statistics /></Layout>} />
                          <Route path="/player" element={<Layout><PlayerDashboard /></Layout>} />
                          <Route path="/achievements" element={<Layout><Achievements /></Layout>} />
                          <Route path="/competition" element={<Layout><Competition /></Layout>} />
                          <Route path="/brackets" element={<Layout><Brackets /></Layout>} />
                          <Route path="/games" element={<Layout><GamesBrowser /></Layout>} />
                          <Route path="/clear-logos" element={<Layout><ClearLogoTest /></Layout>} />
                          {/* Tournament-scoped routes with access control */}
                          <Route path="/t/:slug" element={<Layout topNavProps={{
                            onShowRules: () => {
                              // Create a custom event for tournament routes
                              const rulesEvent = new CustomEvent('showTournamentRules');
                              document.dispatchEvent(rulesEvent);
                            }
                          }}><TournamentAccessGuard><Index /></TournamentAccessGuard></Layout>} />
                          <Route path="/t/:slug/admin" element={<Layout><TournamentAccessGuard><Admin /></TournamentAccessGuard></Layout>} />
                          <Route path="/t/:slug/statistics" element={<Layout topNavProps={{ hideStatistics: true }}><TournamentAccessGuard><Statistics /></TournamentAccessGuard></Layout>} />
                          <Route path="/t/:slug/achievements" element={<Layout><TournamentAccessGuard><Achievements /></TournamentAccessGuard></Layout>} />
                          <Route path="/t/:slug/mobile-entry" element={<Layout><TournamentAccessGuard><MobileEntry /></TournamentAccessGuard></Layout>} />
                          {/* 404 Catch-all route */}
                          <Route path="*" element={<IndexWithRules />} />
                        </Routes>
                      </Suspense>
                    </BrowserRouter>
                    </HelpGuideProvider>
                  </TooltipProvider>
                </PerformanceWrapper>
              </FullscreenProvider>
            </ThemeProvider>
          </AchievementProvider>
        </TournamentProvider>
      </BracketProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
