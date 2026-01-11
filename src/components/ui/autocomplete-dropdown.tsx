import React from 'react';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
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
        "absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md",
        className
      )}
    >
      <Command className="border-0">
        <CommandList className="max-h-60">
          {loading ? (
            <CommandEmpty>
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground border-t-transparent"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading suggestions...</span>
              </div>
            </CommandEmpty>
          ) : suggestions.length === 0 ? (
            <CommandEmpty>No suggestions found</CommandEmpty>
          ) : (
            <CommandGroup>
              {suggestions.map((suggestion, index) => (
                <CommandItem
                  key={index}
                  value={suggestion}
                  onSelect={() => onSelect(suggestion)}
                  className="cursor-pointer"
                >
                  {suggestion}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
});

AutocompleteDropdown.displayName = "AutocompleteDropdown";