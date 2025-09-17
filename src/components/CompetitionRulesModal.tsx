import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Shield, Camera, Users, Clock, Trophy, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface CompetitionRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CompetitionRulesModal: React.FC<CompetitionRulesModalProps> = ({ isOpen, onClose }) => {
  const ruleCategories = [
    {
      title: "Fair Play & Ethics",
      icon: <Shield className="w-5 h-5" />,
      color: "bg-green-500/20 text-green-300 border-green-500/30",
      rules: [
        {
          text: "Play games honestly without external assistance or automation",
          allowed: true
        },
        {
          text: "Use only in-game features, glitches, and exploits - these are part of the game",
          allowed: true
        },
        {
          text: "One account per player - multiple accounts will result in disqualification",
          allowed: false
        },
        {
          text: "No external cheat programs, memory modification, or game file tampering",
          allowed: false
        },
        {
          text: "No tool-assisted speedrunning (TAS), bots, or automated scripting",
          allowed: false
        }
      ]
    },
    {
      title: "Score Verification",
      icon: <Camera className="w-5 h-5" />,
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      rules: [
        {
          text: "Photo evidence required - clear screenshot of final score screen",
          allowed: true
        },
        {
          text: "Include game settings screen if available (difficulty, lives, etc.)",
          allowed: true
        },
        {
          text: "Video evidence encouraged for extraordinary scores",
          allowed: true
        },
        {
          text: "Doctored, edited, or manipulated screenshots will be rejected",
          allowed: false
        },
        {
          text: "Blurry, unclear, or partially obscured score displays",
          allowed: false
        }
      ]
    },
    {
      title: "Game Settings & Hardware",
      icon: <Trophy className="w-5 h-5" />,
      color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      rules: [
        {
          text: "Use default game settings unless tournament specifies otherwise",
          allowed: true
        },
        {
          text: "Original arcade hardware, official emulators (MAME), or console versions",
          allowed: true
        },
        {
          text: "Turbo/autofire controllers allowed if game supports it naturally",
          allowed: true
        },
        {
          text: "Modified ROM files or unofficial game versions",
          allowed: false
        },
        {
          text: "Pausing during gameplay for strategic advantage",
          allowed: false
        }
      ]
    },
    {
      title: "Community & Conduct",
      icon: <Users className="w-5 h-5" />,
      color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      rules: [
        {
          text: "Maintain respectful and sportsmanlike behavior",
          allowed: true
        },
        {
          text: "Share strategies and tips with other players",
          allowed: true
        },
        {
          text: "Report suspicious scores through official channels",
          allowed: true
        },
        {
          text: "Harassment, toxic behavior, or unsportsmanlike conduct",
          allowed: false
        },
        {
          text: "False accusations without evidence",
          allowed: false
        }
      ]
    },
    {
      title: "Timing & Submission",
      icon: <Clock className="w-5 h-5" />,
      color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      rules: [
        {
          text: "Submit scores within competition timeframe",
          allowed: true
        },
        {
          text: "Include date/time information when possible",
          allowed: true
        },
        {
          text: "Submit your best legitimate attempts",
          allowed: true
        },
        {
          text: "Submitting scores achieved outside competition period",
          allowed: false
        },
        {
          text: "Multiple submissions of the same score to inflate rankings",
          allowed: false
        }
      ]
    }
  ];

  const additionalGuidelines = [
    "We follow industry standards based on Twin Galaxies and MARP (Multiple Arcade Machine Emulator Replay Project) guidelines",
    "Judges reserve the right to request additional verification for extraordinary scores",
    "Rule violations may result in score removal, temporary suspension, or permanent ban",
    "When in doubt about a rule interpretation, contact administrators before submitting",
    "These rules may be updated periodically - check back for the latest version"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Competition Rules & Guidelines
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            <div className="text-sm text-gray-300 leading-relaxed">
              <p className="mb-2">
                Our high score competition follows established industry standards to ensure fair play and accurate verification.
                These rules are based on guidelines from <strong>Twin Galaxies</strong> and <strong>MARP</strong> (Multiple Arcade Machine Emulator Replay Project),
                adapted for our community.
              </p>
            </div>

            {ruleCategories.map((category, categoryIndex) => (
              <div key={categoryIndex} className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${category.color}`}>
                    {category.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white">{category.title}</h3>
                </div>

                <div className="grid gap-2 ml-4">
                  {category.rules.map((rule, ruleIndex) => (
                    <div key={ruleIndex} className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/10">
                      <div className="flex-shrink-0 mt-0.5">
                        {rule.allowed ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <X className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <span className={`text-sm ${rule.allowed ? 'text-green-100' : 'text-red-100'}`}>
                        {rule.text}
                      </span>
                      <div className="ml-auto">
                        <Badge variant={rule.allowed ? "default" : "destructive"} className="text-xs">
                          {rule.allowed ? "Allowed" : "Prohibited"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {categoryIndex < ruleCategories.length - 1 && <Separator className="my-6 bg-white/10" />}
              </div>
            ))}

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-500/20 text-gray-300 border-gray-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white">Additional Guidelines</h3>
              </div>

              <div className="ml-4 space-y-2">
                {additionalGuidelines.map((guideline, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-2"></div>
                    <span className="text-sm text-gray-200">{guideline}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-300">Need Clarification?</h4>
                  <p className="text-sm text-blue-100">
                    If you're unsure about any rule or have questions about a specific situation,
                    please contact the tournament administrators before submitting your score.
                    It's better to ask than to risk disqualification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CompetitionRulesModal;