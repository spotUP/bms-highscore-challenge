import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gamepad2, Trophy, Users, Zap, Play, BookOpen, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHelpGuide } from "@/hooks/useHelpGuide";

export const WelcomeModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { startTour, tours } = useHelpGuide();


  useEffect(() => {
    if (user) {
      // Check if this is the user's first login
      const hasSeenWelcome = localStorage.getItem(`welcome_seen_${user.id}`);

      if (!hasSeenWelcome) {
        setIsOpen(true);
      }
    }
  }, [user]);

  const handleClose = () => {
    if (user) {
      // Mark that the user has seen the welcome modal
      localStorage.setItem(`welcome_seen_${user.id}`, 'true');
    }
    setIsOpen(false);
  };

  const handleStartTour = () => {
    try {
      const welcomeTour = tours.find(tour => tour.id === 'welcome');

      if (welcomeTour) {
        startTour(welcomeTour);
        handleClose();
      } else {
        console.error('Welcome tour not found');
      }
    } catch (error) {
      console.error('Error in handleStartTour:', error);
    }
  };

  const handleSkipTour = () => {
    handleClose();
  };

  const features = [
    {
      icon: <Gamepad2 className="w-6 h-6" />,
      title: "Submit High Scores",
      description: "Upload your best scores and compete with players worldwide"
    },
    {
      icon: <Trophy className="w-6 h-6" />,
      title: "Earn Achievements",
      description: "Unlock badges and achievements for various gaming milestones"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Join Tournaments",
      description: "Participate in organized competitions and climb the leaderboards"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Track Progress",
      description: "Monitor your gaming stats and see your improvement over time"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl bg-gray-900 text-white border-white/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-4">
            Welcome to BMS Highscore Challenge! 🎮
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-300 text-lg">
              Ready to showcase your gaming skills? Here's what you can do:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-arcade-neonCyan mt-1">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-2">Ready to Get Started?</h3>
              <p className="text-sm text-gray-400">
                Take our interactive tour to learn the platform, or jump right in and start competing!
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  console.log('🔥 BUTTON CLICKED - Take the Tour');
                  handleStartTour();
                }}
                className="bg-arcade-neonCyan hover:bg-arcade-neonCyan/80 text-black font-semibold px-6 py-2 flex items-center gap-2"
              >
                <Play size={16} />
                Take the Tour
              </Button>

              <Button
                onClick={handleSkipTour}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 px-6 py-2 flex items-center gap-2"
              >
                <BookOpen size={16} />
                Skip Tour
              </Button>
            </div>

            <div className="text-xs text-gray-500">
              You can always access help later through the menu
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};