import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

interface AdvancedSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  enableSuggestions?: boolean;
  enableRealTimeSearch?: boolean;
  debounceMs?: number;
  maxSuggestions?: number;
  searchHint?: string;
  activeSearchText?: string;
  platformHints?: Record<string, string>;
  currentPlatform?: string;
  customSuggestionFn?: (query: string) => Promise<string[]>;
}

// Standard debounced value hook
function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export const AdvancedSearchField: React.FC<AdvancedSearchFieldProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Search and press Enter...",
  label,
  disabled = false,
  className = "",
  enableSuggestions = true,
  enableRealTimeSearch = false,
  debounceMs = 500,
  maxSuggestions = 6,
  searchHint = " Tip: Try \"mario\", \"sonic\", \"zelda\", or use abbreviations like \"sf\" for Street Fighter",
  activeSearchText,
  platformHints,
  currentPlatform,
  customSuggestionFn
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce the query — suggestions only fetch after typing stops
  const debouncedQuery = useDebouncedValue(value, debounceMs);

  // Also debounce onSubmit for real-time search mode
  const debouncedValue = useDebouncedValue(value, debounceMs);
  useEffect(() => {
    if (enableRealTimeSearch && onSubmit && debouncedValue) {
      onSubmit(debouncedValue);
    }
  }, [debouncedValue, enableRealTimeSearch]);

  // Default suggestion function
  const defaultSuggestionFn = useCallback(async (query: string): Promise<string[]> => {
    if (query.length < 2) return [];
    try {
      const { data, error } = await api
        .from('games_database')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(maxSuggestions + 2)
        .order('name');
      if (error) throw error;
      return data
        ?.map((game: any) => game.name)
        .filter((name: string, i: number, arr: string[]) => arr.indexOf(name) === i)
        .slice(0, maxSuggestions) || [];
    } catch {
      return [];
    }
  }, [maxSuggestions]);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (!enableSuggestions || debouncedQuery.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;
    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const fn = customSuggestionFn || defaultSuggestionFn;
        const results = await fn(debouncedQuery);
        if (!cancelled) {
          setSuggestions(results);
          setActiveIndex(-1);
          // Only open if input is still focused
          if (document.activeElement === inputRef.current && results.length > 0) {
            setIsOpen(true);
          }
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [debouncedQuery, enableSuggestions, customSuggestionFn, defaultSuggestionFn]);

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    setSuggestions([]);
    onSubmit?.(suggestion);
    // Return focus to input
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        onSubmit?.(value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) {
          selectSuggestion(suggestions[activeIndex]);
        } else {
          setIsOpen(false);
          onSubmit?.(value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleClear = () => {
    onChange('');
    onSubmit?.('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const getHintText = () => {
    if (activeSearchText && value) return `Searching for: "${value}"`;
    if (!value && currentPlatform && platformHints?.[currentPlatform]) return platformHints[currentPlatform];
    if (!value && searchHint) return searchHint;
    return null;
  };

  const hintText = getHintText();

  return (
    <div className={className}>
      {label && <Label className="text-sm font-medium mb-2 block">{label}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && value.length >= 2) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay so mousedown on suggestions can fire first
            setTimeout(() => setIsOpen(false), 150);
          }}
          placeholder={placeholder}
          className={`pl-10 ${value ? 'pr-10' : 'pr-4'}`}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
        />

        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
            title="Clear search"
            tabIndex={-1}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Suggestions dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={listRef}
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-y-auto p-1"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  selectSuggestion(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none ${
                  index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                }`}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {hintText && (
        <div className={`text-xs mt-1 ${activeSearchText && value ? 'text-blue-600' : 'text-gray-500'}`}>
          {hintText}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchField;