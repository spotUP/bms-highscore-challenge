import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const ThemeSelector: React.FC<{ className?: string }>= ({ className }) => {
  const { theme, setTheme, themes, accent, setAccent } = useTheme();
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div>
        <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            {themes.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {theme === 'tron' && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-400">Accent</Label>
          <Select value={accent} onValueChange={(v) => setAccent(v as any)}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Accent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cyan">Cyan</SelectItem>
              <SelectItem value="magenta">Magenta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
