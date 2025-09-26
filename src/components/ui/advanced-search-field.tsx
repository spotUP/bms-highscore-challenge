import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutocompleteDropdown } from '@/components/ui/autocomplete-dropdown';
import { supabase } from '@/integrations/supabase/client';

interface AdvancedSearchFieldProps {
  // Core props
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void; // Called on Enter key or explicit search

  // UI customization
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;

  // Search behavior
  enableSuggestions?: boolean;
  enableRealTimeSearch?: boolean; // If true, calls onSubmit on every change
  debounceMs?: number;
  maxSuggestions?: number;

  // Hints and help text
  searchHint?: string;
  activeSearchText?: string; // Shows "Searching for: {value}" when provided
  platformHints?: Record<string, string>;
  currentPlatform?: string;

  // Custom suggestion source
  customSuggestionFn?: (query: string) => Promise<string[]>;
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
  debounceMs = 300,
  maxSuggestions = 6,
  searchHint = "💡 Tip: Try \"mario\", \"sonic\", \"zelda\", or use abbreviations like \"sf\" for Street Fighter",
  activeSearchText,
  platformHints,
  currentPlatform,
  customSuggestionFn
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Default suggestion function - searches games database
  const defaultSuggestionFn = async (query: string): Promise<string[]> => {
    if (query.length < 2) return [];

    try {
      const { data: suggestions, error } = await supabase
        .from('games_database')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(maxSuggestions + 2)
        .order('name');

      if (error) throw error;

      return suggestions
        ?.map(game => game.name)
        .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates
        .slice(0, maxSuggestions) || [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return [];
    }
  };

  // Fetch suggestions with debouncing
  const fetchSuggestions = async (query: string) => {
    if (!enableSuggestions || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSuggestionLoading(true);
    try {
      const suggestionFn = customSuggestionFn || defaultSuggestionFn;
      const results = await suggestionFn(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSuggestionLoading(false);
    }
  };

  // Handle input change
  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    if (enableRealTimeSearch && onSubmit) {
      setSearchLoading(true);
      // Debounce real-time search
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSubmit(newValue);
        setSearchLoading(false);
      }, debounceMs);
    }

    // Debounce suggestions
    if (enableSuggestions) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, debounceMs);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit && !enableRealTimeSearch) {
      setSearchLoading(true);
      onSubmit(value);
      setTimeout(() => setSearchLoading(false), 500);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    onChange(suggestion);
    if (onSubmit) {
      setSearchLoading(true);
      onSubmit(suggestion);
      setTimeout(() => setSearchLoading(false), 500);
    }
    setShowSuggestions(false);
  };

  // Handle clear
  const handleClear = () => {
    onChange('');
    if (onSubmit) {
      onSubmit('');
    }
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Get appropriate hint text
  const getHintText = () => {
    if (activeSearchText && value) {
      return `Searching for: "${value}"`;
    }

    if (!value && currentPlatform && platformHints && platformHints[currentPlatform]) {
      return platformHints[currentPlatform];
    }

    if (!value && searchHint) {
      return searchHint;
    }

    return null;
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const isLoading = searchLoading || suggestionLoading;

  return (
    <div className={className}>
      {label && <Label className="text-sm font-medium mb-2 block">{label}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => value.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className={`pl-10 ${isLoading ? 'pr-16' : value ? 'pr-10' : 'pr-4'}`}
          disabled={disabled || isLoading}
        />

        {/* Clear button */}
        {value && !isLoading && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 w-4 h-4 flex items-center justify-center"
            title="Clear search"
          >
            ✕
          </button>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Suggestions dropdown */}
        {enableSuggestions && (
          <AutocompleteDropdown
            suggestions={suggestions}
            isOpen={showSuggestions}
            onSelect={handleSuggestionSelect}
            loading={suggestionLoading}
          />
        )}
      </div>

      {/* Hint text */}
      {getHintText() && (
        <div className={`text-xs mt-1 ${
          activeSearchText && value ? 'text-blue-600' : 'text-gray-500'
        }`}>
          {getHintText()}
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchField;