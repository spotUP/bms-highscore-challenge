import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface SmartTabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'pills' | 'underline';
}

const SmartTabs: React.FC<SmartTabsProps> = ({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className = '',
  orientation = 'horizontal',
  variant = 'default'
}) => {
  const getTabsListClassName = () => {
    const baseClasses = 'grid w-full';
    const orientationClasses = orientation === 'vertical' ? 'grid-rows-auto' : `grid-cols-${tabs.length}`;

    switch (variant) {
      case 'pills':
        return `${baseClasses} ${orientationClasses} bg-black/30 backdrop-blur-sm border border-cyan-400/10 rounded-xl p-1`;
      case 'underline':
        return `${baseClasses} ${orientationClasses} bg-transparent border-b border-cyan-400/20 rounded-none p-0`;
      default:
        return `${baseClasses} ${orientationClasses}`;
    }
  };

  const getTabTriggerClassName = (isActive: boolean = false) => {
    const baseClasses = 'transition-all duration-200';

    switch (variant) {
      case 'pills':
        return `${baseClasses} rounded-lg`;
      case 'underline':
        return `${baseClasses} rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400/60 data-[state=active]:bg-transparent pb-2`;
      default:
        return baseClasses;
    }
  };

  return (
    <div className={className}>
      <Tabs
        defaultValue={defaultValue}
        value={value}
        onValueChange={onValueChange}
        orientation={orientation}
      >
        <TabsList className={getTabsListClassName()}>
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={getTabTriggerClassName()}
            >
              <div className="flex items-center gap-2">
                {tab.icon && <span className="text-sm">{tab.icon}</span>}
                <span>{tab.label}</span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SmartTabs;