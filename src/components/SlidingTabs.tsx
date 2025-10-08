import React, { useRef, useEffect, useState } from 'react';
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

interface SlidingTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface SlidingTabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface SlidingTabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const SlidingTabsContext = React.createContext<{
  activeValue: string;
  registerTab: (value: string, element: HTMLElement) => void;
  unregisterTab: (value: string) => void;
}>({
  activeValue: '',
  registerTab: () => {},
  unregisterTab: () => {},
});

export const SlidingTabs: React.FC<SlidingTabsProps> = ({ value, onValueChange, children, className }) => {
  const [tabElements, setTabElements] = useState<Map<string, HTMLElement>>(new Map());
  const [borderStyle, setBorderStyle] = useState({ width: 0, left: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  const registerTab = (value: string, element: HTMLElement) => {
    setTabElements(prev => new Map(prev.set(value, element)));
  };

  const unregisterTab = (value: string) => {
    setTabElements(prev => {
      const newMap = new Map(prev);
      newMap.delete(value);
      return newMap;
    });
  };

  useEffect(() => {
    const activeElement = tabElements.get(value);
    const listElement = listRef.current;

    if (activeElement && listElement) {
      const listRect = listElement.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      setBorderStyle({
        width: activeRect.width,
        left: activeRect.left - listRect.left,
      });
    }
  }, [value, tabElements]);

  return (
    <SlidingTabsContext.Provider value={{ activeValue: value, registerTab, unregisterTab }}>
      <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
        {children}
      </TabsPrimitive.Root>
    </SlidingTabsContext.Provider>
  );
};

export const SlidingTabsList: React.FC<SlidingTabsListProps> = ({ children, className }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { activeValue } = React.useContext(SlidingTabsContext);
  const [borderStyle, setBorderStyle] = useState({ width: 0, left: 0 });

  useEffect(() => {
    const updateBorderPosition = () => {
      if (!listRef.current) return;

      const activeTab = listRef.current.querySelector(`[data-value="${activeValue}"]`) as HTMLElement;
      if (activeTab) {
        const listRect = listRef.current.getBoundingClientRect();
        const activeRect = activeTab.getBoundingClientRect();

        setBorderStyle({
          width: activeRect.width,
          left: activeRect.left - listRect.left,
        });
      }
    };

    updateBorderPosition();

    // Update on window resize
    window.addEventListener('resize', updateBorderPosition);
    return () => window.removeEventListener('resize', updateBorderPosition);
  }, [activeValue]);

  return (
    <div className="relative">
      <TabsPrimitive.List
        ref={listRef}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm border border-cyan-400/20 p-1 text-muted-foreground relative",
          className
        )}
      >
        {children}
        {/* Sliding border */}
        <div
          className="absolute top-1 bottom-1 border-2 border-primary rounded-md transition-all duration-300 ease-out pointer-events-none"
          style={{
            width: `${borderStyle.width}px`,
            transform: `translateX(${borderStyle.left}px)`,
          }}
        />
      </TabsPrimitive.List>
    </div>
  );
};

export const SlidingTabsTrigger: React.FC<SlidingTabsTriggerProps> = ({ value, children, className }) => {
  const { registerTab, unregisterTab } = React.useContext(SlidingTabsContext);
  const elementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      registerTab(value, elementRef.current);
    }
    return () => unregisterTab(value);
  }, [value, registerTab, unregisterTab]);

  return (
    <TabsPrimitive.Trigger
      ref={elementRef}
      value={value}
      data-value={value}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-400 relative z-10",
        className
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
};

export const SlidingTabsContent = TabsPrimitive.Content;