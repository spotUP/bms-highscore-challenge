import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>((props, ref) => {
  const [activeTab, setActiveTab] = React.useState<string>(props.defaultValue || '');
  const [previousTab, setPreviousTab] = React.useState<string>('');

  const handleValueChange = (value: string) => {
    setPreviousTab(activeTab);
    setActiveTab(value);
    props.onValueChange?.(value);
  };

  return (
    <TabsPrimitive.Root
      {...props}
      ref={ref}
      onValueChange={handleValueChange}
    />
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const [indicatorStyle, setIndicatorStyle] = React.useState({
    left: 0,
    width: 0,
    opacity: 0
  });
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateIndicator = () => {
      const activeTab = listRef.current?.querySelector('[data-state="active"]') as HTMLElement;
      if (activeTab && listRef.current) {
        const listRect = listRef.current.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();

        setIndicatorStyle({
          left: tabRect.left - listRect.left,
          width: tabRect.width,
          opacity: 1
        });
      }
    };

    // Initial position
    updateIndicator();

    // Update on window resize
    window.addEventListener('resize', updateIndicator);

    // Use MutationObserver to watch for data-state changes
    const observer = new MutationObserver(updateIndicator);
    if (listRef.current) {
      observer.observe(listRef.current, {
        attributes: true,
        attributeFilter: ['data-state'],
        subtree: true
      });
    }

    return () => {
      window.removeEventListener('resize', updateIndicator);
      observer.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg bg-card/80 backdrop-blur-sm border p-1 text-muted-foreground relative overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Animated border indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-md border-2 border-primary transition-all duration-300 ease-out pointer-events-none"
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
          opacity: indicatorStyle.opacity,
          transform: 'translateZ(0)' // Force hardware acceleration
        }}
      />
{/* Animated background indicator - removed for no background effect */}
      {props.children}
    </TabsPrimitive.List>
  );
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative z-10 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-400 hover:text-white/80",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
