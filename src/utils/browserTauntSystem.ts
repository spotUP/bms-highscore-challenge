// Browser-compatible dynamic taunt system using localStorage
// This replaces the SQLite version for client-side compatibility

interface TauntTemplate {
  id: number;
  template: string;
  category: 'threat' | 'mockery' | 'analysis' | 'prediction' | 'personal';
  variables: string[];
  intensity: number;
  context_tags: string[];
}

interface ContextualWord {
  id: number;
  variable_name: string;
  word: string;
  intensity: number;
  context_tags: string[];
}

interface PlayerBehavior {
  player_id: string;
  total_matches: number;
  avg_reaction_time: number;
  favorite_position: string;
  weakness_patterns: string[];
  last_seen: string;
  personality_type: 'aggressive' | 'defensive' | 'balanced' | 'erratic';
}

interface GameContext {
  currentScore: { [key: string]: number };
  rallyLength: number;
  gamePhase: 'early' | 'mid' | 'late' | 'overtime';
  dominantPlayer?: string;
  lastScorer?: string;
  playerBehaviors: PlayerBehavior[];
}

class BrowserTauntSystem {
  private storageKey = 'pong_taunt_system';
  private data: {
    templates: TauntTemplate[];
    words: ContextualWord[];
    players: { [key: string]: PlayerBehavior };
    history: any[];
  };
  private saveThrottleTimeout: number | null = null;

  constructor() {
    this.loadFromStorage();
    if (this.data.templates.length === 0) {
      this.initializeData();
    }
  }

  private loadFromStorage() {
    const stored = localStorage.getItem(this.storageKey);
    this.data = stored ? JSON.parse(stored) : {
      templates: [],
      words: [],
      players: {},
      history: []
    };
  }

  private saveToStorage() {
    // Throttle saves to avoid excessive localStorage operations
    if (this.saveThrottleTimeout) {
      clearTimeout(this.saveThrottleTimeout);
    }
    this.saveThrottleTimeout = window.setTimeout(() => {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      this.saveThrottleTimeout = null;
    }, 1000); // Save at most once per second
  }

  private initializeData() {
    // Initialize taunt templates - short and punchy
    this.data.templates = [
      // Personal analysis taunts
      { id: 1, template: "TOO {adjective}", category: "analysis", variables: ["adjective"], intensity: 3, context_tags: ["mid_game", "personal"] },
      { id: 2, template: "{pattern} DETECTED", category: "analysis", variables: ["pattern"], intensity: 4, context_tags: ["data_driven"] },
      { id: 3, template: "{assessment} HUMAN", category: "personal", variables: ["assessment"], intensity: 3, context_tags: ["behavioral"] },

      // Dynamic threat taunts
      { id: 4, template: "PREPARE TO {fate}", category: "threat", variables: ["fate"], intensity: 5, context_tags: ["aggressive", "intimidation"] },
      { id: 5, template: "YOU WILL {fate}", category: "threat", variables: ["fate"], intensity: 4, context_tags: ["dramatic", "berzerk"] },

      // Contextual mockery
      { id: 6, template: "{insult} MOVE", category: "mockery", variables: ["insult"], intensity: 2, context_tags: ["post_move"] },
      { id: 7, template: "SO {assessment}", category: "mockery", variables: ["assessment"], intensity: 3, context_tags: ["performance"] },

      // Predictive taunts
      { id: 8, template: "{prediction} INCOMING", category: "prediction", variables: ["prediction"], intensity: 4, context_tags: ["ai_themed"] },
      { id: 9, template: "{percentage} CHANCE", category: "prediction", variables: ["percentage"], intensity: 3, context_tags: ["mathematical"] },

      // Adaptive taunts
      { id: 10, template: "{assessment} STRATEGY", category: "analysis", variables: ["assessment"], intensity: 3, context_tags: ["strategic"] },
      { id: 11, template: "{score_reaction}", category: "threat", variables: ["score_reaction"], intensity: 4, context_tags: ["score_based"] }
    ];

    // Initialize contextual words
    this.data.words = [
      // Adjectives
      { id: 1, variable_name: "adjective", word: "PATHETIC", intensity: 4, context_tags: ["negative", "harsh"] },
      { id: 2, variable_name: "adjective", word: "SLUGGISH", intensity: 3, context_tags: ["speed", "negative"] },
      { id: 3, variable_name: "adjective", word: "PREDICTABLE", intensity: 2, context_tags: ["pattern", "analysis"] },
      { id: 4, variable_name: "adjective", word: "INADEQUATE", intensity: 3, context_tags: ["capability", "negative"] },
      { id: 5, variable_name: "adjective", word: "PRIMITIVE", intensity: 4, context_tags: ["intelligence", "harsh"] },

      // Skills
      { id: 6, variable_name: "skill", word: "REFLEXES", intensity: 2, context_tags: ["reaction", "speed"] },
      { id: 7, variable_name: "skill", word: "PADDLE CONTROL", intensity: 2, context_tags: ["precision", "control"] },
      { id: 8, variable_name: "skill", word: "POSITIONING", intensity: 2, context_tags: ["strategy", "placement"] },
      { id: 9, variable_name: "skill", word: "REACTION TIME", intensity: 3, context_tags: ["speed", "response"] },
      { id: 10, variable_name: "skill", word: "DECISION MAKING", intensity: 3, context_tags: ["intelligence", "strategy"] },

      // Weaknesses
      { id: 11, variable_name: "weakness", word: "WEAK FLESH", intensity: 4, context_tags: ["biological", "harsh"] },
      { id: 12, variable_name: "weakness", word: "CARBON FLAWS", intensity: 5, context_tags: ["scientific", "harsh"] },
      { id: 13, variable_name: "weakness", word: "BRAIN LAG", intensity: 4, context_tags: ["brain", "technical"] },
      { id: 14, variable_name: "weakness", word: "MUSCLE FAIL", intensity: 3, context_tags: ["physical", "memory"] },

      // Patterns
      { id: 15, variable_name: "pattern", word: "WEAK DEFENSE", intensity: 2, context_tags: ["playstyle", "analysis"] },
      { id: 16, variable_name: "pattern", word: "PANIC MODE", intensity: 3, context_tags: ["emotional", "stress"] },
      { id: 17, variable_name: "pattern", word: "ROBOT MOVES", intensity: 2, context_tags: ["predictable", "habitual"] },
      { id: 18, variable_name: "pattern", word: "FEAR PLAY", intensity: 4, context_tags: ["emotional", "defensive"] },

      // Predictions
      { id: 19, variable_name: "prediction", word: "TOTAL DOOM", intensity: 5, context_tags: ["dramatic", "final"] },
      { id: 20, variable_name: "prediction", word: "YOUR DOOM", intensity: 4, context_tags: ["methodical", "precise"] },
      { id: 21, variable_name: "prediction", word: "PURE DEFEAT", intensity: 3, context_tags: ["certainty", "doom"] },
      { id: 22, variable_name: "prediction", word: "ROBOT WINS", intensity: 4, context_tags: ["ai", "technical"] },

      // Player types
      { id: 23, variable_name: "player_type", word: "SPECIMEN", intensity: 4, context_tags: ["scientific", "dehumanizing"] },
      { id: 24, variable_name: "player_type", word: "UNIT", intensity: 3, context_tags: ["mechanical", "cold"] },
      { id: 25, variable_name: "player_type", word: "SUBJECT", intensity: 3, context_tags: ["experimental", "clinical"] },
      { id: 26, variable_name: "player_type", word: "ENTITY", intensity: 2, context_tags: ["neutral", "formal"] },

      // Threat types
      { id: 27, variable_name: "threat_type", word: "TACTICAL", intensity: 3, context_tags: ["strategic", "military"] },
      { id: 28, variable_name: "threat_type", word: "SYSTEMATIC", intensity: 4, context_tags: ["methodical", "thorough"] },
      { id: 29, variable_name: "threat_type", word: "COMPUTATIONAL", intensity: 4, context_tags: ["ai", "processing"] },
      { id: 30, variable_name: "threat_type", word: "ALGORITHMIC", intensity: 4, context_tags: ["mathematical", "precise"] },

      // Robot actions
      { id: 31, variable_name: "robot_action", word: "WIN NOW", intensity: 5, context_tags: ["technical", "final"] },
      { id: 32, variable_name: "robot_action", word: "CRUSH YOU", intensity: 4, context_tags: ["computational", "clinical"] },
      { id: 33, variable_name: "robot_action", word: "DOOM YOU", intensity: 4, context_tags: ["mathematical", "ominous"] },
      { id: 34, variable_name: "robot_action", word: "DESTROY ALL", intensity: 5, context_tags: ["technical", "dramatic"] },

      // Body parts
      { id: 35, variable_name: "body_part", word: "REFLEXES", intensity: 2, context_tags: ["physical", "reaction"] },
      { id: 36, variable_name: "body_part", word: "NEURAL PATHWAYS", intensity: 4, context_tags: ["brain", "technical"] },
      { id: 37, variable_name: "body_part", word: "COGNITIVE FUNCTIONS", intensity: 3, context_tags: ["mental", "intelligence"] },

      // Fate words
      { id: 38, variable_name: "fate", word: "MALFUNCTION", intensity: 3, context_tags: ["technical", "failure"] },
      { id: 39, variable_name: "fate", word: "CEASE FUNCTIONING", intensity: 4, context_tags: ["dramatic", "clinical"] },
      { id: 40, variable_name: "fate", word: "EXPERIENCE SYSTEMATIC FAILURE", intensity: 5, context_tags: ["technical", "complete"] },

      // Move types
      { id: 41, variable_name: "move_type", word: "PADDLE MOVEMENT", intensity: 2, context_tags: ["game", "action"] },
      { id: 42, variable_name: "move_type", word: "DEFENSIVE POSITIONING", intensity: 2, context_tags: ["strategy", "defensive"] },
      { id: 43, variable_name: "move_type", word: "REACTION", intensity: 2, context_tags: ["response", "speed"] },

      // Assessment words (CRITICAL: missing variable causing ERROR outputs)
      { id: 44, variable_name: "assessment", word: "PATHETIC", intensity: 4, context_tags: ["performance", "harsh"] },
      { id: 45, variable_name: "assessment", word: "WEAK", intensity: 3, context_tags: ["performance", "negative"] },
      { id: 46, variable_name: "assessment", word: "SLOW", intensity: 3, context_tags: ["performance", "speed"] },
      { id: 47, variable_name: "assessment", word: "PREDICTABLE", intensity: 2, context_tags: ["performance", "pattern"] },
      { id: 48, variable_name: "assessment", word: "INFERIOR", intensity: 4, context_tags: ["performance", "comparison"] },
      { id: 49, variable_name: "assessment", word: "DISAPPOINTING", intensity: 3, context_tags: ["performance", "expectation"] },
      { id: 50, variable_name: "assessment", word: "INADEQUATE", intensity: 3, context_tags: ["performance", "capability"] },

      // Move quality
      { id: 44, variable_name: "move_quality", word: "PATHETIC", intensity: 4, context_tags: ["negative", "harsh"] },
      { id: 45, variable_name: "move_quality", word: "INADEQUATE", intensity: 3, context_tags: ["insufficient", "negative"] },
      { id: 46, variable_name: "move_quality", word: "PREDICTABLE", intensity: 2, context_tags: ["boring", "expected"] },

      // Insults
      { id: 47, variable_name: "insult", word: "PATHETIC", intensity: 3, context_tags: ["shame", "mockery"] },
      { id: 48, variable_name: "insult", word: "EPIC FAIL", intensity: 4, context_tags: ["mathematical", "harsh"] },
      { id: 49, variable_name: "insult", word: "TOO WEAK", intensity: 5, context_tags: ["technical", "dismissive"] }
    ];

    this.saveToStorage();
  }

  private getContextTags(gameContext: GameContext): string[] {
    const tags: string[] = [];
    tags.push(gameContext.gamePhase);

    const scores = Object.values(gameContext.currentScore);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    if (maxScore - minScore > 2) tags.push('dominating');
    if (maxScore === minScore) tags.push('tied');
    if (gameContext.rallyLength > 10) tags.push('long_rally');
    if (gameContext.rallyLength > 20) tags.push('epic_rally');

    if (gameContext.dominantPlayer) tags.push('performance');
    if (gameContext.lastScorer) tags.push('post_score');

    return tags;
  }

  private selectTemplate(context: GameContext, intensity: number = 3): TauntTemplate | null {
    const contextTags = this.getContextTags(context);

    // Get recently used template IDs (last 5 taunts to avoid repetition)
    const recentTemplateIds = this.data.history
      .slice(-5)
      .map(entry => entry.templateId)
      .filter(id => id !== undefined);

    // Filter templates by intensity and context
    let candidates = this.data.templates.filter(template =>
      template.intensity <= intensity &&
      (template.context_tags.some(tag => contextTags.includes(tag)) ||
       template.context_tags.includes('general'))
    );

    // Remove recently used templates to avoid repetition
    const freshCandidates = candidates.filter(template =>
      !recentTemplateIds.includes(template.id)
    );

    // Use fresh candidates if available, otherwise fall back to all candidates
    const finalCandidates = freshCandidates.length > 0 ? freshCandidates : candidates;

    // Debug logging
    console.log(`🎯 Template selection: ${candidates.length} candidates, ${freshCandidates.length} fresh, ${recentTemplateIds.length} recent IDs:`, recentTemplateIds);

    if (finalCandidates.length === 0) {
      return this.data.templates[Math.floor(Math.random() * this.data.templates.length)];
    }

    return finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
  }

  private getWord(variableName: string, contextTags: string[]): string {
    // Find words matching the variable name and context
    const candidates = this.data.words.filter(word =>
      word.variable_name === variableName &&
      (word.context_tags.some(tag => contextTags.includes(tag)) ||
       word.context_tags.includes('general'))
    );

    if (candidates.length === 0) {
      // Fallback to any word of this variable type
      const fallbacks = this.data.words.filter(word => word.variable_name === variableName);
      if (fallbacks.length > 0) {
        return fallbacks[Math.floor(Math.random() * fallbacks.length)].word;
      }

      // Better fallback words based on variable type
      const genericFallbacks: { [key: string]: string[] } = {
        'EMOTION': ['ANGER', 'FURY', 'RAGE', 'CONTEMPT'],
        'ACTION': ['DESTROY', 'CRUSH', 'DEFEAT', 'ELIMINATE'],
        'INTENSITY': ['TOTAL', 'COMPLETE', 'UTTER', 'ABSOLUTE'],
        'NOUN': ['HUMAN', 'PLAYER', 'OPPONENT', 'TARGET'],
        'ADJECTIVE': ['WEAK', 'PATHETIC', 'INFERIOR', 'DOOMED'],
        'VERB': ['FAIL', 'LOSE', 'SUFFER', 'PERISH'],
        'assessment': ['WEAK', 'PATHETIC', 'SLOW', 'PREDICTABLE', 'INFERIOR'],
        'fate': ['LOSE', 'FAIL', 'SUFFER', 'PERISH', 'FALL'],
        'pattern': ['WEAKNESS', 'FLAW', 'ERROR', 'DEFECT'],
        'insult': ['PATHETIC', 'WEAK', 'SLOW', 'POOR'],
        'prediction': ['DEFEAT', 'FAILURE', 'DOOM', 'LOSS'],
        'percentage': ['ZERO', 'LOW', 'MINIMAL', 'TINY'],
        'score_reaction': ['DESPERATION', 'PANIC', 'FEAR', 'WORRY']
      };

      const fallbackWords = genericFallbacks[variableName] || ['UNIT', 'ENTITY', 'BEING'];
      return fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
    }

    return candidates[Math.floor(Math.random() * candidates.length)].word;
  }

  private fillVariables(template: TauntTemplate, context: GameContext): string {
    let filledTemplate = template.template;
    const contextTags = this.getContextTags(context);

    template.variables.forEach(variable => {
      const word = this.getWord(variable, contextTags);
      filledTemplate = filledTemplate.replace(`{${variable}}`, word);
    });

    // Handle special context variables
    if (context.dominantPlayer && filledTemplate.includes('{player_number}')) {
      filledTemplate = filledTemplate.replace('{player_number}', context.dominantPlayer.toUpperCase());
    }

    if (context.gamePhase && filledTemplate.includes('{game_phase}')) {
      filledTemplate = filledTemplate.replace('{game_phase}', context.gamePhase.toUpperCase());
    }

    if (filledTemplate.includes('{percentage}')) {
      const randomPercentage = Math.floor(Math.random() * 30) + 70; // 70-99%
      filledTemplate = filledTemplate.replace('{percentage}', `${randomPercentage}.${Math.floor(Math.random() * 9)}%`);
    }

    if (filledTemplate.includes('{timeframe}')) {
      const timeframes = ['SECONDS', 'MOMENTS', 'NANOSECONDS', 'PROCESSING CYCLES'];
      filledTemplate = filledTemplate.replace('{timeframe}', timeframes[Math.floor(Math.random() * timeframes.length)]);
    }

    return filledTemplate;
  }

  public generatePersonalizedTaunt(playerId: string, gameContext: GameContext, intensity: number = 3): string {
    const template = this.selectTemplate(gameContext, intensity);
    if (!template) {
      return "YOUR EXISTENCE IS AN ERROR IN THE MATRIX";
    }

    const taunt = this.fillVariables(template, gameContext);

    // Debug logging to track variety
    console.log(`🤖 Generated taunt using template ${template.id}: "${taunt}"`);

    // Store in history
    this.data.history.push({
      playerId,
      taunt,
      templateId: template.id,
      context: this.getContextTags(gameContext),
      timestamp: Date.now()
    });

    // Keep only last 100 taunts in history
    if (this.data.history.length > 100) {
      this.data.history = this.data.history.slice(-100);
    }

    this.saveToStorage();
    return taunt;
  }

  public analyzePlayerBehavior(playerId: string, gameContext: GameContext) {
    if (!this.data.players[playerId]) {
      this.data.players[playerId] = {
        player_id: playerId,
        total_matches: 1,
        avg_reaction_time: 0.5,
        favorite_position: 'unknown',
        weakness_patterns: [],
        last_seen: new Date().toISOString(),
        personality_type: 'balanced'
      };
    } else {
      this.data.players[playerId].total_matches++;
      this.data.players[playerId].last_seen = new Date().toISOString();
    }

    this.saveToStorage();
  }

  public getPlayerStats(playerId: string): PlayerBehavior | null {
    return this.data.players[playerId] || null;
  }

  public getTauntHistory(playerId: string, limit: number = 10): any[] {
    return this.data.history
      .filter(h => h.playerId === playerId)
      .slice(-limit);
  }

  public addCustomTemplate(template: string, category: string, variables: string[], intensity: number, contextTags: string[]) {
    const newTemplate: TauntTemplate = {
      id: this.data.templates.length + 1,
      template,
      category: category as any,
      variables,
      intensity,
      context_tags: contextTags
    };

    this.data.templates.push(newTemplate);
    this.saveToStorage();
  }

  public addCustomWord(variableName: string, word: string, intensity: number, contextTags: string[]) {
    const newWord: ContextualWord = {
      id: this.data.words.length + 1,
      variable_name: variableName,
      word,
      intensity,
      context_tags: contextTags
    };

    this.data.words.push(newWord);
    this.saveToStorage();
  }
}

// Singleton instance
let browserTauntSystem: BrowserTauntSystem | null = null;

export function getDynamicTauntSystem(): BrowserTauntSystem {
  if (!browserTauntSystem) {
    browserTauntSystem = new BrowserTauntSystem();
  }
  return browserTauntSystem;
}

export type { GameContext, PlayerBehavior, TauntTemplate };