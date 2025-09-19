import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle, Play, Target, Lightbulb } from 'lucide-react';
import { useHelpGuide } from '@/hooks/useHelpGuide';

interface HelpMenuProps {
  onClose: () => void;
}

const HelpMenu: React.FC<HelpMenuProps> = ({ onClose }) => {
  const { startTour, tours } = useHelpGuide();

  const handleStartTour = (tourId: string) => {
    const tour = tours.find(t => t.id === tourId);
    if (tour) {
      startTour(tour);
      onClose();
    }
  };

  const tourItems = [
    {
      tour: tours.find(t => t.id === 'welcome'),
      icon: <Play size={16} className="text-green-400" />,
      color: 'hover:bg-green-500/10'
    },
    {
      tour: tours.find(t => t.id === 'score-submission'),
      icon: <Target size={16} className="text-blue-400" />,
      color: 'hover:bg-blue-500/10'
    },
    {
      tour: tours.find(t => t.id === 'features-overview'),
      icon: <Lightbulb size={16} className="text-yellow-400" />,
      color: 'hover:bg-yellow-500/10'
    }
  ];

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-3 px-2 border-b border-white/20 pb-2">
        <div className="flex items-center gap-2">
          <HelpCircle size={14} className="text-arcade-neonCyan" />
          Interactive Help
        </div>
      </div>

      {tourItems.map((item, index) => {
        if (!item.tour) return null;

        return (
          <Button
            key={item.tour.id}
            variant="ghost"
            onClick={() => handleStartTour(item.tour!.id)}
            className={`w-full justify-start text-left transition-all duration-200 hover:scale-105 hover:shadow-sm hover:translate-x-1 ${item.color}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3 transition-all duration-200">
              {item.icon}
              <div>
                <div className="font-medium text-white text-sm">{item.tour.name}</div>
                <div className="text-xs text-gray-400 line-clamp-1">{item.tour.description}</div>
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
};

export default HelpMenu;