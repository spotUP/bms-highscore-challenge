import React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { Zap, ZapOff } from "lucide-react";

interface PerformanceModeToggleProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
  displayType?: "button" | "switch";
}

const PerformanceModeToggle = ({ 
  variant = "outline", 
  size = "default", 
  className = "",
  showText = true,
  displayType = "button"
}: PerformanceModeToggleProps) => {
  const { isPerformanceMode, togglePerformanceMode } = usePerformanceMode();

  const handleToggle = () => {
    togglePerformanceMode(!isPerformanceMode);
  };

  if (displayType === "switch") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Switch
          id="performance-mode"
          checked={isPerformanceMode}
          onCheckedChange={togglePerformanceMode}
          className="data-[state=checked]:bg-green-600"
        />
        {showText && (
          <Label htmlFor="performance-mode" className="text-white cursor-pointer">
            {isPerformanceMode ? 'Performance Mode' : 'Standard Mode'}
          </Label>
        )}
      </div>
    );
  }

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
