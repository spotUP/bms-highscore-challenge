import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';

interface TournamentRulesEditorProps {
  tournamentId: string;
  tournamentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface RuleCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  rules: Rule[];
}

interface Rule {
  id: string;
  text: string;
  allowed: boolean;
  enabled: boolean;
}

const DEFAULT_RULES_TEMPLATE: RuleCategory[] = [
  {
    id: 'fair-play',
    title: "Fair Play & Ethics",
    icon: "Shield",
    color: "bg-green-500/20 text-green-300 border-green-500/30",
    rules: [
      {
        id: 'honest-play',
        text: "Play games honestly without external assistance or automation",
        allowed: true,
        enabled: true
      },
      {
        id: 'in-game-features',
        text: "Use only in-game features, glitches, and exploits - these are part of the game",
        allowed: true,
        enabled: true
      },
      {
        id: 'multiple-accounts',
        text: "One account per player - multiple accounts will result in disqualification",
        allowed: false,
        enabled: true
      },
      {
        id: 'external-cheats',
        text: "No external cheat programs, memory modification, or game file tampering",
        allowed: false,
        enabled: true
      },
      {
        id: 'automation',
        text: "No tool-assisted speedrunning (TAS), bots, or automated scripting",
        allowed: false,
        enabled: true
      }
    ]
  },
  {
    id: 'verification',
    title: "Score Verification",
    icon: "Camera",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    rules: [
      {
        id: 'photo-evidence',
        text: "Photo evidence required - clear screenshot of final score screen",
        allowed: true,
        enabled: true
      },
      {
        id: 'game-settings',
        text: "Include game settings screen if available (difficulty, lives, etc.)",
        allowed: true,
        enabled: true
      },
      {
        id: 'video-evidence',
        text: "Video evidence encouraged for extraordinary scores",
        allowed: true,
        enabled: true
      },
      {
        id: 'doctored-images',
        text: "Doctored, edited, or manipulated screenshots will be rejected",
        allowed: false,
        enabled: true
      },
      {
        id: 'unclear-images',
        text: "Blurry, unclear, or partially obscured score displays",
        allowed: false,
        enabled: true
      }
    ]
  },
  {
    id: 'game-settings',
    title: "Game Settings & Hardware",
    icon: "Trophy",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    rules: [
      {
        id: 'default-settings',
        text: "Use default game settings unless tournament specifies otherwise",
        allowed: true,
        enabled: true
      },
      {
        id: 'hardware',
        text: "Original arcade hardware, official emulators (MAME), or console versions",
        allowed: true,
        enabled: true
      },
      {
        id: 'turbo-controllers',
        text: "Turbo/autofire controllers allowed if game supports it naturally",
        allowed: true,
        enabled: true
      },
      {
        id: 'modified-roms',
        text: "Modified ROM files or unofficial game versions",
        allowed: false,
        enabled: true
      },
      {
        id: 'pausing',
        text: "Pausing during gameplay for strategic advantage",
        allowed: false,
        enabled: true
      }
    ]
  },
  {
    id: 'community',
    title: "Community & Conduct",
    icon: "Users",
    color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    rules: [
      {
        id: 'respectful-behavior',
        text: "Maintain respectful and sportsmanlike behavior",
        allowed: true,
        enabled: true
      },
      {
        id: 'share-strategies',
        text: "Share strategies and tips with other players",
        allowed: true,
        enabled: true
      },
      {
        id: 'report-suspicious',
        text: "Report suspicious scores through official channels",
        allowed: true,
        enabled: true
      },
      {
        id: 'harassment',
        text: "Harassment, toxic behavior, or unsportsmanlike conduct",
        allowed: false,
        enabled: true
      },
      {
        id: 'false-accusations',
        text: "False accusations without evidence",
        allowed: false,
        enabled: true
      }
    ]
  },
  {
    id: 'timing',
    title: "Timing & Submission",
    icon: "Clock",
    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    rules: [
      {
        id: 'within-timeframe',
        text: "Submit scores within competition timeframe",
        allowed: true,
        enabled: true
      },
      {
        id: 'include-timestamps',
        text: "Include date/time information when possible",
        allowed: true,
        enabled: true
      },
      {
        id: 'best-attempts',
        text: "Submit your best legitimate attempts",
        allowed: true,
        enabled: true
      },
      {
        id: 'outside-timeframe',
        text: "Submitting scores achieved outside competition period",
        allowed: false,
        enabled: true
      },
      {
        id: 'multiple-submissions',
        text: "Multiple submissions of the same score to inflate rankings",
        allowed: false,
        enabled: true
      }
    ]
  }
];

const TournamentRulesEditor: React.FC<TournamentRulesEditorProps> = ({
  tournamentId,
  tournamentName,
  isOpen,
  onClose,
  onSave
}) => {
  const { toast } = useToast();
  const [rulesData, setRulesData] = useState<RuleCategory[]>(DEFAULT_RULES_TEMPLATE);
  const [additionalGuidelines, setAdditionalGuidelines] = useState<string[]>([
    "We follow industry standards based on Twin Galaxies and MARP (Multiple Arcade Machine Emulator Replay Project) guidelines",
    "Judges reserve the right to request additional verification for extraordinary scores",
    "Rule violations may result in score removal, temporary suspension, or permanent ban",
    "When in doubt about a rule interpretation, contact administrators before submitting",
    "These rules may be updated periodically - check back for the latest version"
  ]);
  const [customRules, setCustomRules] = useState<Rule[]>([]);
  const [newCustomRule, setNewCustomRule] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing rules data
  useEffect(() => {
    if (isOpen && tournamentId) {
      loadTournamentRules();
    }
  }, [isOpen, tournamentId]);

  const loadTournamentRules = async () => {
    setIsLoading(true);
    try {
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .select('rules_data')
        .eq('id', tournamentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (tournament?.rules_data) {
        const parsedData = typeof tournament.rules_data === 'string'
          ? JSON.parse(tournament.rules_data)
          : tournament.rules_data;

        if (parsedData.categories) {
          setRulesData(parsedData.categories);
        }
        if (parsedData.additionalGuidelines) {
          setAdditionalGuidelines(parsedData.additionalGuidelines);
        }
        if (parsedData.customRules) {
          setCustomRules(parsedData.customRules);
        }
      }
    } catch (error) {
      console.error('Error loading tournament rules:', error);
      toast({
        title: "Error",
        description: "Failed to load tournament rules",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveTournamentRules = async () => {
    setIsSaving(true);
    try {
      const rulesPayload = {
        categories: rulesData,
        additionalGuidelines,
        customRules
      };

      const { error } = await supabase
        .from('tournaments')
        .update({ rules_data: rulesPayload })
        .eq('id', tournamentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tournament rules saved successfully"
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving tournament rules:', error);
      toast({
        title: "Error",
        description: "Failed to save tournament rules",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateRuleEnabled = (categoryId: string, ruleId: string, enabled: boolean) => {
    setRulesData(prev => prev.map(category =>
      category.id === categoryId
        ? {
            ...category,
            rules: category.rules.map(rule =>
              rule.id === ruleId ? { ...rule, enabled } : rule
            )
          }
        : category
    ));
  };

  const updateAdditionalGuideline = (index: number, text: string) => {
    setAdditionalGuidelines(prev => prev.map((guideline, i) =>
      i === index ? text : guideline
    ));
  };

  const removeAdditionalGuideline = (index: number) => {
    setAdditionalGuidelines(prev => prev.filter((_, i) => i !== index));
  };

  const addAdditionalGuideline = () => {
    setAdditionalGuidelines(prev => [...prev, ""]);
  };

  const addCustomRule = () => {
    if (!newCustomRule.trim()) return;

    const newRule: Rule = {
      id: `custom-${Date.now()}`,
      text: newCustomRule.trim(),
      allowed: true,
      enabled: true
    };

    setCustomRules(prev => [...prev, newRule]);
    setNewCustomRule('');
  };

  const updateCustomRule = (ruleId: string, updates: Partial<Rule>) => {
    setCustomRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const removeCustomRule = (ruleId: string) => {
    setCustomRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-gray-400">Loading tournament rules...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rules for {tournamentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Standard Rules Categories */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Standard Rules</h3>
            {rulesData.map((category) => (
              <Card key={category.id} className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">{category.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {category.rules.map((rule) => (
                    <div key={rule.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`${category.id}-${rule.id}`}
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          updateRuleEnabled(category.id, rule.id, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`${category.id}-${rule.id}`}
                        className={`text-sm flex-1 ${rule.allowed ? 'text-green-100' : 'text-red-100'}`}
                      >
                        {rule.text}
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Guidelines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Additional Guidelines</h3>
              <Button
                onClick={addAdditionalGuideline}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Guideline
              </Button>
            </div>
            {additionalGuidelines.map((guideline, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={guideline}
                  onChange={(e) => updateAdditionalGuideline(index, e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white flex-1"
                  placeholder="Enter guideline..."
                />
                <Button
                  onClick={() => removeAdditionalGuideline(index)}
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Custom Rules */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Custom Rules</h3>
            <div className="flex space-x-2">
              <Input
                value={newCustomRule}
                onChange={(e) => setNewCustomRule(e.target.value)}
                placeholder="Add a custom rule..."
                className="bg-gray-800 border-gray-700 text-white flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addCustomRule()}
              />
              <Button onClick={addCustomRule} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {customRules.map((rule) => (
              <div key={rule.id} className="flex items-center space-x-2 p-3 bg-gray-800 rounded-lg">
                <Checkbox
                  id={`custom-${rule.id}`}
                  checked={rule.enabled}
                  onCheckedChange={(checked) =>
                    updateCustomRule(rule.id, { enabled: checked as boolean })
                  }
                />
                <Input
                  value={rule.text}
                  onChange={(e) => updateCustomRule(rule.id, { text: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
                <Button
                  onClick={() => removeCustomRule(rule.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={saveTournamentRules} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Rules'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TournamentRulesEditor;