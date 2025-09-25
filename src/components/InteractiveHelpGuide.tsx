import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ChevronLeft, ChevronRight, HelpCircle, Lightbulb, Target, Trophy, BarChart3, Users } from 'lucide-react';
import { DESIGN_SYSTEM } from '@/utils/designSystem';

export interface HelpStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
  action?: () => void;
}

interface InteractiveHelpGuideProps {
  isOpen: boolean;
  onClose: () => void;
  steps: HelpStep[];
  autoStart?: boolean;
}

const InteractiveHelpGuide: React.FC<InteractiveHelpGuideProps> = ({
  isOpen,
  onClose,
  steps,
  autoStart = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && steps.length > 0) {
      highlightElement(steps[currentStep]);
    }
  }, [isOpen, currentStep, steps]);

  const highlightElement = (step: HelpStep) => {
    if (step.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        setHighlightedElement(element);
        calculateTooltipPosition(element, step.position);

        // Scroll element into view
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        });
      }
    } else {
      setHighlightedElement(null);
      // Center tooltip when no target element
      setTooltipPosition({
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150
      });
    }
  };

  const calculateTooltipPosition = (element: Element, position: string) => {
    const rect = element.getBoundingClientRect();
    const tooltipWidth = 400;
    const tooltipHeight = 200;
    const margin = 20;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        y = rect.top - tooltipHeight - margin;
        break;
      case 'bottom':
        x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        y = rect.bottom + margin;
        break;
      case 'left':
        x = rect.left - tooltipWidth - margin;
        y = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        break;
      case 'right':
        x = rect.right + margin;
        y = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        break;
      default:
        x = window.innerWidth / 2 - (tooltipWidth / 2);
        y = window.innerHeight / 2 - (tooltipHeight / 2);
    }

    // Keep tooltip within viewport bounds
    x = Math.max(margin, Math.min(x, window.innerWidth - tooltipWidth - margin));
    y = Math.max(margin, Math.min(y, window.innerHeight - tooltipHeight - margin));

    setTooltipPosition({ x, y });
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const executeAction = () => {
    const step = steps[currentStep];
    if (step.action) {
      step.action();
      nextStep();
    }
    // If no action, do nothing - let user manually trigger the advancement
  };

  if (!isOpen || steps.length === 0) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/80 z-[9998]"
        style={{
          clipPath: highlightedElement
            ? `polygon(0% 0%, 0% 100%, ${highlightedElement.getBoundingClientRect().left}px 100%, ${highlightedElement.getBoundingClientRect().left}px ${highlightedElement.getBoundingClientRect().top}px, ${highlightedElement.getBoundingClientRect().right}px ${highlightedElement.getBoundingClientRect().top}px, ${highlightedElement.getBoundingClientRect().right}px ${highlightedElement.getBoundingClientRect().bottom}px, ${highlightedElement.getBoundingClientRect().left}px ${highlightedElement.getBoundingClientRect().bottom}px, ${highlightedElement.getBoundingClientRect().left}px 100%, 100% 100%, 100% 0%)`
            : undefined
        }}
        onClick={highlightedElement ? undefined : onClose}
      />

      {/* Highlighted Element Border */}
      {highlightedElement && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: highlightedElement.getBoundingClientRect().left - 4,
            top: highlightedElement.getBoundingClientRect().top - 4,
            width: highlightedElement.getBoundingClientRect().width + 8,
            height: highlightedElement.getBoundingClientRect().height + 8,
            border: '3px solid #00ffff',
            borderRadius: '8px',
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.6)',
            animation: 'pulse 2s infinite'
          }}
        />
      )}

      {/* Tooltip */}
      <Card
        ref={tooltipRef}
        className={`fixed z-[10000] w-96 ${DESIGN_SYSTEM.cards.primary} border-2 border-arcade-neonCyan shadow-2xl`}
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          boxShadow: '0 0 30px rgba(0, 255, 255, 0.4)'
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentStepData.icon && (
                <div className="text-arcade-neonCyan">
                  {currentStepData.icon}
                </div>
              )}
              <CardTitle className={`${DESIGN_SYSTEM.typography.h4} text-white`}>
                {currentStepData.title}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <X size={16} />
            </Button>
          </div>
          <div className="text-xs text-arcade-neonCyan font-arcade">
            Step {currentStep + 1} of {steps.length}
          </div>
        </CardHeader>

        <CardContent>
          <p className={`${DESIGN_SYSTEM.typography.bodySecondary} mb-4 leading-relaxed`}>
            {currentStepData.content}
          </p>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-arcade-neonCyan h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft size={16} />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-gray-400"
              >
                Skip Tour
              </Button>

              {currentStepData.action ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={executeAction}
                  className="flex items-center gap-2 border-green-500 text-green-400 hover:bg-green-500/10"
                >
                  Try It!
                  <Target size={16} />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextStep}
                  className="flex items-center gap-2 border-green-500 text-green-400 hover:bg-green-500/10"
                >
                  {isLastStep ? 'Finish' : 'Next'}
                  {!isLastStep && <ChevronRight size={16} />}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating Help Button (when not in tour mode) */}
      {!highlightedElement && (
        <div className="fixed bottom-6 right-6 z-[10001]">
          <Button
            onClick={onClose}
            className={`${DESIGN_SYSTEM.buttons.arcade} rounded-full w-12 h-12 shadow-lg`}
            title="Get Help"
          >
            <HelpCircle size={20} />
          </Button>
        </div>
      )}
    </>
  );
};

export default InteractiveHelpGuide;