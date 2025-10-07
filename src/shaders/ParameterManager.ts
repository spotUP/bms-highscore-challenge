/**
 * Enhanced Parameter Manager for Mega Bezel
 *
 * Handles 200+ interdependent shader parameters with:
 * - Parameter validation and clamping
 * - Dependency resolution
 * - Real-time updates
 * - Preset loading and application
 * - Parameter categories and organization
 */

export interface ShaderParameter {
  name: string;
  displayName: string;
  description?: string;
  default: number;
  min: number;
  max: number;
  step: number;
  category: ParameterCategory;
  unit?: string;
  dependencies?: string[]; // Parameters that depend on this one
  affects?: string[];     // Parameters this one affects
  validation?: (value: number) => boolean;
}

export type ParameterCategory =
  | 'screen_layout'
  | 'crt_effects'
  | 'color_grading'
  | 'bezel_settings'
  | 'advanced_effects'
  | 'performance'
  | 'compatibility';

export interface ParameterPreset {
  name: string;
  description: string;
  parameters: Record<string, number>;
  inherits?: string; // Base preset to inherit from
}

export class ParameterManager {
  private parameters: Map<string, ShaderParameter> = new Map();
  private values: Map<string, number> = new Map();
  private presets: Map<string, ParameterPreset> = new Map();
  private parameterGroups: Map<ParameterCategory, string[]> = new Map();
  private changeListeners: Array<(name: string, value: number) => void> = [];

  constructor() {
    this.initializeParameters();
    this.loadDefaultPresets();
  }

  /**
   * Initialize all Mega Bezel parameters
   */
  private initializeParameters(): void {
    // Screen Layout Parameters
    this.addParameter({
      name: 'HSM_SCREEN_POSITION_X',
      displayName: 'Screen Position X',
      description: 'Horizontal screen position offset',
      default: 0,
      min: -1000,
      max: 1000,
      step: 1,
      category: 'screen_layout',
      unit: 'pixels'
    });

    this.addParameter({
      name: 'HSM_SCREEN_POSITION_Y',
      displayName: 'Screen Position Y',
      description: 'Vertical screen position offset',
      default: 0,
      min: -1000,
      max: 1000,
      step: 1,
      category: 'screen_layout',
      unit: 'pixels'
    });

    this.addParameter({
      name: 'HSM_NON_INTEGER_SCALE',
      displayName: 'Non-Integer Scale',
      description: 'Screen scaling factor',
      default: 0.8,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      category: 'screen_layout'
    });

    // CRT Effects Parameters
    this.addParameter({
      name: 'HSM_FAKE_SCANLINE_OPACITY',
      displayName: 'Scanline Opacity',
      description: 'Opacity of simulated scanlines',
      default: 30,
      min: 0,
      max: 100,
      step: 1,
      category: 'crt_effects',
      unit: '%'
    });

    this.addParameter({
      name: 'HSM_SCREEN_SCALE_GSHARP_MODE',
      displayName: 'G-Sharp Mode',
      description: 'G-Sharp sharpening mode',
      default: 1,
      min: 0,
      max: 2,
      step: 1,
      category: 'crt_effects'
    });

    this.addParameter({
      name: 'HSM_SCREEN_SCALE_HSHARP0',
      displayName: 'Sharpening Range',
      description: 'Sharpening filter range',
      default: 2.0,
      min: 1.0,
      max: 6.0,
      step: 0.1,
      category: 'crt_effects'
    });

    // Color Grading Parameters
    this.addParameter({
      name: 'g_sat',
      displayName: 'Saturation',
      description: 'Color saturation adjustment',
      default: 0.2,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      category: 'color_grading'
    });

    this.addParameter({
      name: 'g_cntrst',
      displayName: 'Contrast',
      description: 'Contrast adjustment',
      default: 0.2,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      category: 'color_grading'
    });

    this.addParameter({
      name: 'g_lum',
      displayName: 'Brightness',
      description: 'Brightness adjustment',
      default: 0.0,
      min: -0.5,
      max: 1.0,
      step: 0.01,
      category: 'color_grading'
    });

    // Bezel Settings Parameters
    this.addParameter({
      name: 'HSM_BZL_USE_INDEPENDENT_SCALE',
      displayName: 'Independent Bezel Scale',
      description: 'Use independent scaling for bezel',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      category: 'bezel_settings'
    });

    this.addParameter({
      name: 'HSM_BZL_INNER_EDGE_THICKNESS',
      displayName: 'Inner Edge Thickness',
      description: 'Thickness of inner bezel edge',
      default: 100,
      min: 0,
      max: 500,
      step: 1,
      category: 'bezel_settings'
    });

    this.addParameter({
      name: 'HSM_BZL_OUTER_EDGE_THICKNESS',
      displayName: 'Outer Edge Thickness',
      description: 'Thickness of outer bezel edge',
      default: 100,
      min: 0,
      max: 500,
      step: 1,
      category: 'bezel_settings'
    });

    this.addParameter({
      name: 'HSM_BZL_BRIGHTNESS',
      displayName: 'Bezel Brightness',
      description: 'Brightness of bezel areas',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      category: 'bezel_settings'
    });

    // Add many more parameters... (truncated for brevity)
    // In a full implementation, this would include all 200+ parameters
    // from the Mega Bezel parameter files
  }

  /**
   * Add a parameter definition
   */
  private addParameter(param: ShaderParameter): void {
    this.parameters.set(param.name, param);
    this.values.set(param.name, param.default);

    // Add to category group
    if (!this.parameterGroups.has(param.category)) {
      this.parameterGroups.set(param.category, []);
    }
    this.parameterGroups.get(param.category)!.push(param.name);
  }

  /**
   * Load default parameter presets
   */
  private loadDefaultPresets(): void {
    // Potato preset (simplified)
    this.presets.set('potato', {
      name: 'Potato',
      description: 'Simplified preset for basic CRT effects',
      parameters: {
        'HSM_FAKE_SCANLINE_OPACITY': 30,
        'HSM_SCREEN_SCALE_GSHARP_MODE': 1,
        'g_sat': 0.2,
        'g_cntrst': 0.2,
        'HSM_NON_INTEGER_SCALE': 0.8
      }
    });

    // Full Mega Bezel preset would include all parameters
    // This is a placeholder for the full implementation
  }

  /**
   * Get parameter value
   */
  getValue(name: string): number {
    return this.values.get(name) ?? 0;
  }

  /**
   * Set parameter value with validation
   */
  setValue(name: string, value: number): boolean {
    const param = this.parameters.get(name);
    if (!param) {
      console.warn(`Parameter ${name} not found`);
      return false;
    }

    // Validate value
    const clampedValue = Math.max(param.min, Math.min(param.max, value));

    // Apply step quantization
    const steppedValue = Math.round(clampedValue / param.step) * param.step;

    // Custom validation
    if (param.validation && !param.validation(steppedValue)) {
      console.warn(`Parameter ${name} validation failed for value ${steppedValue}`);
      return false;
    }

    // Set value
    this.values.set(name, steppedValue);

    // Notify listeners
    this.changeListeners.forEach(listener => listener(name, steppedValue));

    // Handle dependencies
    this.updateDependencies(name, steppedValue);

    return true;
  }

  /**
   * Update dependent parameters
   */
  private updateDependencies(changedParam: string, newValue: number): void {
    const param = this.parameters.get(changedParam);
    if (!param?.affects) return;

    // Update dependent parameters based on rules
    for (const dependent of param.affects) {
      // Example dependency logic (would be more complex in full implementation)
      if (dependent === 'HSM_SCREEN_SCALE_HSHARP0' && changedParam === 'HSM_SCREEN_SCALE_GSHARP_MODE') {
        if (newValue === 2) {
          // Editable mode - allow custom sharpening
          // Keep current value
        } else {
          // Fixed mode - set to default
          this.setValue(dependent, 1.0);
        }
      }
    }
  }

  /**
   * Load parameter preset
   */
  loadPreset(presetName: string): boolean {
    const preset = this.presets.get(presetName);
    if (!preset) {
      console.warn(`Preset ${presetName} not found`);
      return false;
    }

    // Handle inheritance
    if (preset.inherits) {
      const basePreset = this.presets.get(preset.inherits);
      if (basePreset) {
        // Merge base preset parameters
        Object.assign(preset.parameters, basePreset.parameters);
      }
    }

    // Apply preset parameters
    let success = true;
    for (const [name, value] of Object.entries(preset.parameters)) {
      if (!this.setValue(name, value)) {
        success = false;
      }
    }

    return success;
  }

  /**
   * Get all parameters in a category
   */
  getParametersByCategory(category: ParameterCategory): ShaderParameter[] {
    const paramNames = this.parameterGroups.get(category) || [];
    return paramNames.map(name => this.parameters.get(name)!).filter(Boolean);
  }

  /**
   * Get all parameter values for shader uniforms
   */
  getAllValues(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, value] of this.values) {
      result[name] = value;
    }
    return result;
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: (name: string, value: number) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: (name: string, value: number) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Reset all parameters to defaults
   */
  resetToDefaults(): void {
    for (const [name, param] of this.parameters) {
      this.values.set(name, param.default);
    }

    // Notify all listeners
    for (const [name, value] of this.values) {
      this.changeListeners.forEach(listener => listener(name, value));
    }
  }

  /**
   * Export current parameters as preset
   */
  exportAsPreset(name: string, description: string): ParameterPreset {
    return {
      name,
      description,
      parameters: { ...this.getAllValues() }
    };
  }

  /**
   * Get parameter definition
   */
  getParameter(name: string): ShaderParameter | undefined {
    return this.parameters.get(name);
  }

  /**
   * Get all parameter names
   */
  getAllParameterNames(): string[] {
    return Array.from(this.parameters.keys());
  }

  /**
   * Validate all current parameter values
   */
  validateAll(): boolean {
    let allValid = true;
    for (const [name, value] of this.values) {
      const param = this.parameters.get(name);
      if (param && (value < param.min || value > param.max)) {
        console.warn(`Parameter ${name} out of range: ${value} (should be ${param.min}-${param.max})`);
        allValid = false;
      }
    }
    return allValid;
  }
}
