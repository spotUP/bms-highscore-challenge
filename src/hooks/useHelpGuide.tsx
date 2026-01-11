import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { HelpStep } from '@/components/InteractiveHelpGuide';
import { Lightbulb, Target, Trophy, BarChart3, Users, Home, Settings, Zap } from 'lucide-react';

export interface HelpTour {
  id: string;
  name: string;
  description: string;
  steps: HelpStep[];
}

interface HelpGuideContextType {
  isOpen: boolean;
  currentTour: HelpTour | null;
  currentStepIndex: number;
  tours: HelpTour[];
  hasSeenIntro: boolean;
  startTour: (tour: HelpTour) => void;
  closeTour: () => void;
  markIntroAsSeen: () => void;
  advanceToStep: (stepId: string) => void;
}

const HelpGuideContext = createContext<HelpGuideContextType | undefined>(undefined);

export const HelpGuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTour, setCurrentTour] = useState<HelpTour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [waitingForScoreSubmission, setWaitingForScoreSubmission] = useState(false);

  // Define advanceToStep function first
  const advanceToStep = useCallback((stepId: string) => {
    if (!currentTour) return;

    const stepIndex = currentTour.steps.findIndex(step => step.id === stepId);
    if (stepIndex !== -1) {
      console.log('🎯 Advancing to step:', stepId, 'at index:', stepIndex);
      setCurrentStepIndex(stepIndex);
    }
  }, [currentTour]);

  // Function to hide modal temporarily for user interaction
  const hideModalForInteraction = useCallback(() => {
    console.log('🎯 Hiding modal for user interaction');
    setIsOpen(false);
    setWaitingForScoreSubmission(true);
    console.log('🎯 Now waiting for score submission...');
  }, []);

  useEffect(() => {
    // Check if user has seen the intro tour
    const seen = localStorage.getItem('help_intro_seen');
    setHasSeenIntro(!!seen);

    // Listen for score submission events to advance the tour
    const handleScoreSubmitted = () => {
      console.log('🎯 Score submitted event received in help guide');
      console.log('🎯 Current tour:', currentTour?.id);
      console.log('🎯 Current step index:', currentStepIndex);
      console.log('🎯 Current step data:', currentTour?.steps[currentStepIndex]);

      if (currentTour && currentTour.id === 'welcome') {
        const currentStepData = currentTour.steps[currentStepIndex];
        console.log('🎯 Step ID check:', currentStepData?.id, '=== game-cards?', currentStepData?.id === 'game-cards');
        console.log('🎯 Step index check:', currentStepIndex, '=== 1 (game-cards)?', currentStepIndex === 1);
        console.log('🎯 Waiting for score submission?', waitingForScoreSubmission);

        // Check if we're waiting for score submission or if we're on the game-cards step
        if (waitingForScoreSubmission || currentStepData?.id === 'game-cards' || currentStepIndex === 1) {
          console.log('🎯 Score submitted while waiting! Showing congratulations modal');
          // Show the modal again and advance to congratulations
          setIsOpen(true);
          setWaitingForScoreSubmission(false); // Reset the flag
          advanceToStep('score-submitted');

          // Auto-advance to next step after 3 seconds
          setTimeout(() => {
            console.log('🎯 Auto-advancing from congratulations to next step');
            // Use advanceToStep instead of directly setting index to ensure proper state management
            advanceToStep('leaderboard');
          }, 3000);
        } else {
          console.log('🎯 Not on game-cards step and not waiting for score submission, ignoring event');
        }
      } else {
        console.log('🎯 Not in welcome tour, ignoring score submission event');
      }
    };

    window.addEventListener('scoreSubmitted', handleScoreSubmitted);
    return () => window.removeEventListener('scoreSubmitted', handleScoreSubmitted);
  }, [currentTour, currentStepIndex, advanceToStep, waitingForScoreSubmission]);

  // Debug effect to track state changes
  useEffect(() => {
    console.log('🎯 useHelpGuide state changed:', {
      isOpen,
      currentTourId: currentTour?.id,
      stepsCount: currentTour?.steps?.length,
      currentStepIndex,
      waitingForScoreSubmission
    });
  }, [isOpen, currentTour, currentStepIndex, waitingForScoreSubmission]);

  const markIntroAsSeen = () => {
    localStorage.setItem('help_intro_seen', 'true');
    setHasSeenIntro(true);
  };

  const startTour = (tour: HelpTour) => {
    console.log('🎯 useHelpGuide: startTour called with tour ID:', tour.id);
    console.log('Tour steps count:', tour.steps.length);
    console.log('🎯 Before state update:', { isOpen, currentTour: currentTour?.id });

    // Use flushSync to force immediate, synchronous state updates
    flushSync(() => {
      setCurrentTour(tour);
      setCurrentStepIndex(0); // Reset to first step
      setIsOpen(true);
    });

    console.log('✅ useHelpGuide: Tour state updated, isOpen should be true');
  };

  const closeTour = () => {
    setIsOpen(false);
    setCurrentTour(null);
  };

  const tours: HelpTour[] = [
    {
      id: 'welcome',
      name: 'Welcome Tour',
      description: 'Get started with Retro Ranks - learn the basics of submitting scores and competing!',
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Retro Ranks! 🎮',
          content: 'Ready to dominate the leaderboards? This quick tour will show you everything you need to know to start competing in retro arcade tournaments!',
          position: 'center',
          icon: <Trophy className="w-5 h-5" />
        },
        {
          id: 'game-cards',
          title: 'Game Cards',
          content: 'Each game has its own card showing the current leaderboard. Click "Try It!" to interact with the games and submit your high score!',
          targetSelector: '[data-game-id]',
          position: 'top',
          icon: <Target className="w-5 h-5" />,
          action: hideModalForInteraction
        },
        {
          id: 'score-submitted',
          title: 'Excellent! 🎉',
          content: 'Great job submitting your score! You\'re now part of the competition. Your score will appear on the leaderboard and contribute to your overall tournament ranking.',
          position: 'center',
          icon: <Trophy className="w-5 h-5" />
        },
        {
          id: 'leaderboard',
          title: 'Overall Leaderboard',
          content: 'Check out the overall tournament standings here. Earn points by placing high on individual game leaderboards!',
          targetSelector: '[data-testid="overall-leaderboard"]',
          position: 'right',
          icon: <BarChart3 className="w-5 h-5" />
        },
        {
          id: 'navigation',
          title: 'Quick Navigation',
          content: 'Use the hamburger menu to quickly jump between different sections like Statistics, Achievements, and Admin tools.',
          targetSelector: '[data-testid="desktop-menu-button"]',
          position: 'bottom',
          icon: <Home className="w-5 h-5" />
        },
        {
          id: 'competition-status',
          title: 'Competition Status',
          content: 'Keep an eye on the tournament status bar to see when competitions start, end, and current phase information.',
          targetSelector: '[data-testid="competition-status"]',
          position: 'bottom',
          icon: <Zap className="w-5 h-5" />
        }
      ]
    },
    {
      id: 'score-submission',
      name: 'Score Submission Guide',
      description: 'Learn how to submit scores and what makes a valid submission.',
      steps: [
        {
          id: 'score-intro',
          title: 'Submitting High Scores 🏆',
          content: 'Submitting scores is easy! Let me show you the process and what you need to know.',
          position: 'center',
          icon: <Target className="w-5 h-5" />
        },
        {
          id: 'click-game',
          title: 'Step 1: Choose Your Game',
          content: 'Click on any game logo to open the score submission dialog. You can submit scores for any active tournament game.',
          targetSelector: '[data-game-id]:first-child',
          position: 'top',
          icon: <Target className="w-5 h-5" />
        },
        {
          id: 'score-rules',
          title: 'Score Submission Rules',
          content: 'Remember: Submit only legitimate scores from actual gameplay. Screenshots or video proof may be required for very high scores.',
          position: 'center',
          icon: <Lightbulb className="w-5 h-5" />
        },
        {
          id: 'leaderboard-update',
          title: 'Instant Updates',
          content: 'Once submitted, your score appears immediately on the leaderboard. Beat other players to climb the rankings!',
          targetSelector: '[data-testid="overall-leaderboard"]',
          position: 'right',
          icon: <BarChart3 className="w-5 h-5" />
        }
      ]
    },
    {
      id: 'features-overview',
      name: 'Features Overview',
      description: 'Explore all the powerful features available in Retro Ranks.',
      steps: [
        {
          id: 'features-intro',
          title: 'Discover All Features 🌟',
          content: 'Retro Ranks is packed with features to enhance your competitive gaming experience. Let\'s explore what\'s available!',
          position: 'center',
          icon: <Lightbulb className="w-5 h-5" />
        },
        {
          id: 'statistics',
          title: 'Statistics & Analytics',
          content: 'View detailed statistics about your performance, game popularity, and tournament trends.',
          targetSelector: '[href="/statistics"]',
          position: 'bottom',
          icon: <BarChart3 className="w-5 h-5" />
        },
        {
          id: 'achievements',
          title: 'Achievement System',
          content: 'Unlock achievements by reaching milestones, winning tournaments, and demonstrating skill across different games.',
          targetSelector: '[href="/achievements"]',
          position: 'bottom',
          icon: <Trophy className="w-5 h-5" />
        },
        {
          id: 'brackets',
          title: 'Tournament Brackets',
          content: 'For bracket-style tournaments, view matchups, track progress, and see elimination paths.',
          targetSelector: '[href="/admin/brackets"]',
          position: 'bottom',
          icon: <Users className="w-5 h-5" />
        }
      ]
    }
  ];

  const value: HelpGuideContextType = {
    isOpen,
    currentTour,
    currentStepIndex,
    tours,
    hasSeenIntro,
    startTour,
    closeTour,
    markIntroAsSeen,
    advanceToStep
  };

  return (
    <HelpGuideContext.Provider value={value}>
      {children}
    </HelpGuideContext.Provider>
  );
};

export const useHelpGuide = () => {
  const context = useContext(HelpGuideContext);
  if (context === undefined) {
    throw new Error('useHelpGuide must be used within a HelpGuideProvider');
  }
  return context;
};