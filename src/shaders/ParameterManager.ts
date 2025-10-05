/**
 * ParameterManager - Runtime shader parameter control and UI integration
 *
 * Provides utilities for:
 * - Parameter metadata management
 * - Value validation and clamping
 * - Change callbacks for UI updates
 * - Parameter presets (save/load)
 * - Parameter interpolation/animation
 * - Integration with MultiPassRenderer
 */

import { ShaderParameter } from './SlangShaderCompiler';
import { MultiPassRenderer } from './MultiPassRenderer';

export interface ParameterMetadata extends ShaderParameter {
  // Current value
  value: number;

  // Group/category for UI organization
  group?: string;

  // Visibility (for advanced/hidden parameters)
  visible?: boolean;
}

export interface ParameterChangeEvent {
  name: string;
  value: number;
  previousValue: number;
}

export type ParameterChangeCallback = (event: ParameterChangeEvent) => void;

export interface ParameterPreset {
  name: string;
  description?: string;
  parameters: Record<string, number>;
}

export class ParameterManager {
  private parameters: Map<string, ParameterMetadata> = new Map();
  private changeCallbacks: Map<string, Set<ParameterChangeCallback>> = new Map();
  private globalCallbacks: Set<ParameterChangeCallback> = new Set();
  private renderer: MultiPassRenderer | null = null;

  constructor(parameters?: ShaderParameter[]) {
    if (parameters) {
      this.addParameters(parameters);
    }
  }

  /**
   * Add shader parameters
   */
  public addParameters(parameters: ShaderParameter[]): void {
    parameters.forEach(param => {
      this.parameters.set(param.name, {
        ...param,
        value: param.default,
        visible: true
      });
    });
  }

  /**
   * Link to MultiPassRenderer for automatic updates
   */
  public linkRenderer(renderer: MultiPassRenderer): void {
    this.renderer = renderer;

    // Sync current parameters to renderer
    this.parameters.forEach((param, name) => {
      renderer.setParameter(name, param.value);
    });
  }

  /**
   * Set parameter value
   */
  public setValue(name: string, value: number, notify: boolean = true): boolean {
    const param = this.parameters.get(name);
    if (!param) {
      console.warn(`[ParameterManager] Parameter not found: ${name}`);
      return false;
    }

    // Clamp to valid range
    const clampedValue = this.clampValue(value, param);

    // Check if value changed
    const previousValue = param.value;
    if (clampedValue === previousValue) {
      return false; // No change
    }

    // Update value
    param.value = clampedValue;

    // Update renderer
    if (this.renderer) {
      this.renderer.setParameter(name, clampedValue);
    }

    // Notify callbacks
    if (notify) {
      this.notifyChange(name, clampedValue, previousValue);
    }

    return true;
  }

  /**
   * Get parameter value
   */
  public getValue(name: string): number | undefined {
    return this.parameters.get(name)?.value;
  }

  /**
   * Get parameter metadata
   */
  public getParameter(name: string): ParameterMetadata | undefined {
    return this.parameters.get(name);
  }

  /**
   * Get all parameters
   */
  public getAllParameters(): ParameterMetadata[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Get parameters by group
   */
  public getParametersByGroup(group: string): ParameterMetadata[] {
    return Array.from(this.parameters.values())
      .filter(p => p.group === group);
  }

  /**
   * Get all parameter groups
   */
  public getGroups(): string[] {
    const groups = new Set<string>();
    this.parameters.forEach(param => {
      if (param.group) {
        groups.add(param.group);
      }
    });
    return Array.from(groups);
  }

  /**
   * Set parameter group
   */
  public setGroup(name: string, group: string): void {
    const param = this.parameters.get(name);
    if (param) {
      param.group = group;
    }
  }

  /**
   * Set parameter visibility
   */
  public setVisible(name: string, visible: boolean): void {
    const param = this.parameters.get(name);
    if (param) {
      param.visible = visible;
    }
  }

  /**
   * Reset parameter to default value
   */
  public resetToDefault(name: string): void {
    const param = this.parameters.get(name);
    if (param) {
      this.setValue(name, param.default);
    }
  }

  /**
   * Reset all parameters to defaults
   */
  public resetAllToDefaults(): void {
    this.parameters.forEach((param, name) => {
      this.setValue(name, param.default, false);
    });

    // Notify global change
    this.globalCallbacks.forEach(callback => {
      this.parameters.forEach((param, name) => {
        callback({
          name,
          value: param.value,
          previousValue: param.value
        });
      });
    });
  }

  /**
   * Clamp value to parameter range with step
   */
  private clampValue(value: number, param: ParameterMetadata): number {
    // Clamp to min/max
    let clamped = Math.max(param.min, Math.min(param.max, value));

    // Snap to step
    if (param.step > 0) {
      const steps = Math.round((clamped - param.min) / param.step);
      clamped = param.min + steps * param.step;
    }

    return clamped;
  }

  /**
   * Notify change callbacks
   */
  private notifyChange(name: string, value: number, previousValue: number): void {
    const event: ParameterChangeEvent = { name, value, previousValue };

    // Parameter-specific callbacks
    const callbacks = this.changeCallbacks.get(name);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }

    // Global callbacks
    this.globalCallbacks.forEach(callback => callback(event));
  }

  /**
   * Add change callback for specific parameter
   */
  public onChange(name: string, callback: ParameterChangeCallback): () => void {
    if (!this.changeCallbacks.has(name)) {
      this.changeCallbacks.set(name, new Set());
    }

    this.changeCallbacks.get(name)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.changeCallbacks.get(name)?.delete(callback);
    };
  }

  /**
   * Add global change callback (for all parameters)
   */
  public onAnyChange(callback: ParameterChangeCallback): () => void {
    this.globalCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.globalCallbacks.delete(callback);
    };
  }

  /**
   * Remove all callbacks
   */
  public clearCallbacks(): void {
    this.changeCallbacks.clear();
    this.globalCallbacks.clear();
  }

  /**
   * Interpolate parameter value over time
   */
  public interpolate(
    name: string,
    targetValue: number,
    duration: number,
    easing: (t: number) => number = t => t
  ): Promise<void> {
    return new Promise((resolve) => {
      const param = this.parameters.get(name);
      if (!param) {
        console.warn(`[ParameterManager] Parameter not found: ${name}`);
        resolve();
        return;
      }

      const startValue = param.value;
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        const easedProgress = easing(progress);

        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        this.setValue(name, currentValue);

        if (progress < 1.0) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Interpolate multiple parameters simultaneously
   */
  public async interpolateMultiple(
    targets: Record<string, number>,
    duration: number,
    easing?: (t: number) => number
  ): Promise<void> {
    const promises = Object.entries(targets).map(([name, value]) =>
      this.interpolate(name, value, duration, easing)
    );

    await Promise.all(promises);
  }

  /**
   * Save parameter preset
   */
  public savePreset(name: string, description?: string): ParameterPreset {
    const parameters: Record<string, number> = {};

    this.parameters.forEach((param, paramName) => {
      parameters[paramName] = param.value;
    });

    return {
      name,
      description,
      parameters
    };
  }

  /**
   * Load parameter preset
   */
  public loadPreset(preset: ParameterPreset, animate: boolean = false, duration: number = 500): Promise<void> {
    if (animate) {
      return this.interpolateMultiple(preset.parameters, duration);
    } else {
      Object.entries(preset.parameters).forEach(([name, value]) => {
        this.setValue(name, value, false);
      });

      // Notify all changes
      this.globalCallbacks.forEach(callback => {
        this.parameters.forEach((param, name) => {
          callback({
            name,
            value: param.value,
            previousValue: param.value
          });
        });
      });

      return Promise.resolve();
    }
  }

  /**
   * Export parameters as JSON
   */
  public exportJSON(): string {
    const data: Record<string, number> = {};
    this.parameters.forEach((param, name) => {
      data[name] = param.value;
    });
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import parameters from JSON
   */
  public importJSON(json: string): void {
    try {
      const data = JSON.parse(json) as Record<string, number>;
      Object.entries(data).forEach(([name, value]) => {
        this.setValue(name, value, false);
      });

      // Notify global change
      this.globalCallbacks.forEach(callback => {
        this.parameters.forEach((param, name) => {
          callback({
            name,
            value: param.value,
            previousValue: param.value
          });
        });
      });
    } catch (error) {
      console.error('[ParameterManager] Failed to import JSON:', error);
    }
  }

  /**
   * Create parameter control object for UI frameworks
   */
  public createControl(name: string): {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    reset: () => void;
  } | null {
    const param = this.parameters.get(name);
    if (!param) return null;

    return {
      label: param.displayName,
      value: param.value,
      min: param.min,
      max: param.max,
      step: param.step,
      onChange: (value: number) => this.setValue(name, value),
      reset: () => this.resetToDefault(name)
    };
  }

  /**
   * Create all parameter controls
   */
  public createAllControls(): Record<string, ReturnType<typeof this.createControl>> {
    const controls: Record<string, ReturnType<typeof this.createControl>> = {};

    this.parameters.forEach((param, name) => {
      if (param.visible) {
        controls[name] = this.createControl(name);
      }
    });

    return controls;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.clearCallbacks();
    this.parameters.clear();
    this.renderer = null;
  }
}

// ========================================
// Easing Functions
// ========================================

export const Easing = {
  linear: (t: number) => t,

  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  easeInExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number) =>
    t === 0
      ? 0
      : t === 1
      ? 1
      : t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2
};
