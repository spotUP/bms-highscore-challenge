import React from 'react';
import { cn } from "@/lib/utils";

interface AutocompleteDropdownProps {
  suggestions: string[];
  isOpen: boolean;
  onSelect: (suggestion: string) => void;
  loading?: boolean;
  className?: string;
}

export const AutocompleteDropdown = React.forwardRef<
  HTMLDivElement,
  AutocompleteDropdownProps
>(({ suggestions, isOpen, onSelect, loading = false, className }, ref) => {
  if (!isOpen || (suggestions.length === 0 && !loading)) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden",
        className
      )}
    >
      <div className="max-h-60 overflow-y-auto p-1">
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-transparent"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading suggestions...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No suggestions found</div>
        ) : (
          suggestions.map((suggestion, index) => (
            <div
              key={index}
              onMouseDown={(e) => { e.preventDefault(); onSelect(suggestion); }}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              {suggestion}
            </div>
          ))
        )}
      </div>
    </div>
  );
});

AutocompleteDropdown.displayName = "AutocompleteDropdown";