import React from 'react';
import { Button } from "@/components/ui/button";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { Zap, ZapOff } from "lucide-react";

interface PerformanceModeToggleProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
}

const PerformanceModeToggle = ({ 
  variant = "outline", 
  size = "default", 
  className = "",
  showText = true 
}: PerformanceModeToggleProps) => {
  const { isPerformanceMode, togglePerformanceMode } = usePerformanceMode();

  const handleToggle = () => {
    togglePerformanceMode(!isPerformanceMode);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      className={`${className} ${isPerformanceMode ? 'bg-green-900/50 border-green-600 text-green-300' : ''}`}
      title={`${isPerformanceMode ? 'Disable' : 'Enable'} Performance Mode`}
    >
      {isPerformanceMode ? (
        <Zap className="w-4 h-4" />
      ) : (
        <ZapOff className="w-4 h-4" />
      )}
      {showText && (
        <span className="ml-2">
          {isPerformanceMode ? 'Performance' : 'Standard'}
        </span>
      )}
    </Button>
  );
};

export default PerformanceModeToggle;
