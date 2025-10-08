/**
 * SlangShaderCompiler - Converts Slang GLSL shaders to WebGL GLSL
 *
 * Handles:
 * - Pragma directive extraction (#pragma parameter, #pragma stage, etc.)
 * - Slang uniform bindings → WebGL uniforms
 * - Vulkan GLSL → WebGL GLSL conversion
 * - Vertex and fragment shader stage separation
 */

export interface ShaderParameter {
  name: string;
  displayName: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface ShaderStage {
  source: string;
  type: 'vertex' | 'fragment';
}

export interface CompiledShader {
  vertex: string;
  fragment: string;
  parameters: ShaderParameter[];
  uniforms: string[];
  samplers: string[];
  name?: string;
  format?: string;
}

export interface UBOMember {
  type: string; // GLSL type (float, vec4, mat4, int, uint, etc.)
  name: string; // Member name
}

export interface SlangUniformBinding {
  set: number;
  binding: number;
  type: 'ubo' | 'sampler' | 'pushConstant';
  name: string; // Type name for UBO/pushConstant, variable name for sampler
  instanceName?: string; // Instance name for pushConstant (e.g., "params")
  members?: UBOMember[]; // UBO members with type information
}

export interface GlobalDefinitions {
  functions: string[]; // Function definitions (e.g., "vec3 foo() { ... }")
  defines: string[];   // #define macros (e.g., "#define RW vec3(0.95, 1.0, 1.09)")
  consts: string[];    // const declarations (e.g., "const float PI = 3.14;")
  globals: string[];   // Mutable global variables (e.g., "vec2 SCREEN_SCALE = vec2(1);")
}

export class SlangShaderCompiler {
  /**
   * Compile a Slang shader to WebGL-compatible GLSL
   */
  public static compile(slangSource: string, webgl2 = true): CompiledShader {
    console.log('[SlangCompiler] Starting compilation of shader, webgl2:', webgl2);

    // Extract pragma directives first to get shader parameters
    const pragmas = this.extractPragmas(slangSource);
    console.log('[SlangCompiler] Extracted pragmas:', pragmas);

    // Extract uniforms and bindings
    const bindings = this.extractBindings(slangSource);

    // Extract global definitions (functions, #defines, consts) before first #pragma stage
    // Pass parameter names AND UBO member names to avoid extracting constants that conflict
    const parameterNames = new Set(pragmas.parameters.map(p => p.name));
    const uboMemberNames = new Set<string>();
    for (const binding of bindings) {
      if (binding.type === 'ubo' && binding.members) {
        for (const member of binding.members) {
          uboMemberNames.add(member.name);
        }
      }
    }
    const excludeNames = new Set([...parameterNames, ...uboMemberNames]);
    const globalDefs = this.extractGlobalDefinitions(slangSource, excludeNames);
    console.log('[SlangCompiler] Extracted global definitions:', {
      functions: globalDefs.functions.length,
      defines: globalDefs.defines.length,
      consts: globalDefs.consts.length,
      globals: globalDefs.globals.length,
      excludedNames: excludeNames.size
    });

    // Split into stages
    const stages = this.splitStages(slangSource);

    // Convert vertex shader
    const vertexStage = stages.find(s => s.type === 'vertex');
    const vertexShader = vertexStage
      ? this.convertToWebGL(vertexStage.source, 'vertex', bindings, webgl2, pragmas.parameters, globalDefs)
      : this.generateDefaultVertexShader(webgl2);

    // Convert fragment shader
    const fragmentStage = stages.find(s => s.type === 'fragment');
    if (!fragmentStage) {
      throw new Error('No fragment shader stage found');
    }
    const fragmentShader = this.convertToWebGL(fragmentStage.source, 'fragment', bindings, webgl2, pragmas.parameters, globalDefs);

    const result = {
      vertex: vertexShader,
      fragment: fragmentShader,
      parameters: pragmas.parameters,
      uniforms: this.extractUniformNames(bindings),
      samplers: this.extractSamplerNames(bindings),
      name: pragmas.name,
      format: pragmas.format
    };

    console.log('[SlangCompiler] Compilation completed successfully');
    console.log('[SlangCompiler] Final result:', {
      vertexLength: result.vertex.length,
      fragmentLength: result.fragment.length,
      parameters: result.parameters.length,
      uniforms: result.uniforms.length,
      samplers: result.samplers.length
    });

    return result;
  }

  /**
   * Extract #pragma directives
   */
  private static extractPragmas(source: string): {
    parameters: ShaderParameter[];
    name?: string;
    format?: string;
  } {
    const parameters: ShaderParameter[] = [];
    let name: string | undefined;
    let format: string | undefined;

    const lines = source.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // #pragma parameter NAME "Display Name" DEFAULT MIN MAX STEP
      if (trimmed.startsWith('#pragma parameter')) {
        const match = trimmed.match(
          /#pragma\s+parameter\s+(\w+)\s+"([^"]+)"\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)/
        );

        if (match) {
          parameters.push({
            name: match[1],
            displayName: match[2],
            default: parseFloat(match[3]),
            min: parseFloat(match[4]),
            max: parseFloat(match[5]),
            step: parseFloat(match[6])
          });
        }
      }

      // #pragma name ShaderName
      if (trimmed.startsWith('#pragma name')) {
        const match = trimmed.match(/#pragma\s+name\s+(\w+)/);
        if (match) {
          name = match[1];
        }
      }

      // #pragma format FORMAT_NAME
      if (trimmed.startsWith('#pragma format')) {
        const match = trimmed.match(/#pragma\s+format\s+([\w_]+)/);
        if (match) {
          format = match[1];
        }
      }
    }

    return { parameters, name, format };
  }

  /**
   * Extract global definitions (functions, #defines, consts) from before first #pragma stage
   */
  private static extractGlobalDefinitions(source: string, excludeNames: Set<string> = new Set()): GlobalDefinitions {
    const functions: string[] = [];
    const defines: string[] = [];
    const consts: string[] = [];
    const globals: string[] = [];

    const lines = source.split('\n');

    // Find the first #pragma stage directive
    let firstStageIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('#pragma stage')) {
        firstStageIndex = i;
        break;
      }
    }

    // If no stage found, return empty
    if (firstStageIndex === -1) {
      return { functions, defines, consts, globals };
    }

    // Extract everything before first #pragma stage
    const globalSection = lines.slice(0, firstStageIndex).join('\n');

    // Debug: Check if HRG_MAX_POINT_CLOUD_SIZE is in global section
    if (globalSection.includes('HRG_MAX_POINT_CLOUD_SIZE')) {
      console.log('[SlangCompiler] HRG_MAX_POINT_CLOUD_SIZE is in globalSection');
      const hrgDefineMatch = globalSection.match(/#define\s+HRG_MAX_POINT_CLOUD_SIZE\s+\d+/);
      if (hrgDefineMatch) {
        console.log('[SlangCompiler] Found HRG define:', hrgDefineMatch[0]);
      }
    } else {
      console.log('[SlangCompiler] WARNING: HRG_MAX_POINT_CLOUD_SIZE NOT in globalSection!');
    }

    // Extract #define macros (single line)
    // Skip UBO/push constant related defines and pragma parameters
    const definePattern = /^[ \t]*#define\s+\w+(?:\s+.*)?$/gm;
    let defineMatch;
    let defineCount = 0;
    while ((defineMatch = definePattern.exec(globalSection)) !== null) {
      const defineLine = defineMatch[0].trim();

      // Don't skip defines that reference UBO members - they need to be extracted
      // and will have prefixes stripped after UBO-to-uniform conversion
      // Examples: #define beamg global.g_CRT_bg, #define signal params.g_signal_type

      defines.push(defineLine);
      defineCount++;

      // Debug: Log if we extract HRG define
      if (defineLine.includes('HRG_MAX_POINT_CLOUD_SIZE')) {
        console.log(`[SlangCompiler] EXTRACTED HRG define at match ${defineCount}:`, defineLine);
      }
    }

    // Debug: Check if we extracted HRG define
    const hasHrgDefine = defines.some(d => d.includes('HRG_MAX_POINT_CLOUD_SIZE'));
    if (globalSection.includes('HRG_MAX_POINT_CLOUD_SIZE') && !hasHrgDefine) {
      console.log('[SlangCompiler] ERROR: HRG define was in globalSection but NOT extracted!');
      console.log('[SlangCompiler] Total defines extracted:', defines.length);
    }

    // IMPORTANT: Extract function definitions FIRST to track their positions
    // This prevents extracting local variables inside functions as globals
    // Pattern: return_type function_name(params) { ... }
    // Match common GLSL types: void, float, int, vec2-4, mat2-4, mat3x3, etc.
    // Handle multi-line function signatures: params and opening brace can span multiple lines
    // Use a simpler pattern that just matches the start, then manually find the matching parens
    const functionStartPattern = /^[ \t]*(?:void|float|int|uint|bool|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4])\s+(\w+)\s*\(/gm;
    const functionRanges: Array<{start: number, end: number}> = [];

    let funcMatch;
    let extractedCount = 0;
    while ((funcMatch = functionStartPattern.exec(globalSection)) !== null) {
      const startPos = funcMatch.index;
      const funcName = funcMatch[1];

      // Find matching closing parenthesis for parameters
      let parenCount = 1;
      let pos = funcMatch.index + funcMatch[0].length;

      while (pos < globalSection.length && parenCount > 0) {
        if (globalSection[pos] === '(') parenCount++;
        if (globalSection[pos] === ')') parenCount--;
        pos++;
      }

      if (parenCount !== 0) {
        console.warn(`[SlangCompiler] Failed to find closing parenthesis for function: ${funcName}`);
        continue;
      }

      // Now find the opening brace (may be after whitespace/newlines and comments)
      while (pos < globalSection.length) {
        const char = globalSection[pos];
        if (/\s/.test(char)) {
          // Skip whitespace
          pos++;
        } else if (char === '/' && pos + 1 < globalSection.length && globalSection[pos + 1] === '/') {
          // Skip single-line comment
          while (pos < globalSection.length && globalSection[pos] !== '\n') {
            pos++;
          }
          // Skip the newline too
          if (pos < globalSection.length && globalSection[pos] === '\n') {
            pos++;
          }
        } else if (char === '/' && pos + 1 < globalSection.length && globalSection[pos + 1] === '*') {
          // Skip multi-line comment
          pos += 2; // Skip /*
          while (pos + 1 < globalSection.length && !(globalSection[pos] === '*' && globalSection[pos + 1] === '/')) {
            pos++;
          }
          if (pos + 1 < globalSection.length) {
            pos += 2; // Skip */
          }
        } else if (char === '{') {
          // Found the opening brace
          break;
        } else {
          // Unexpected character - check if it's a valid function signature continuation
          // Allow letters, numbers, underscores, commas, parentheses (for complex signatures)
          if (/[a-zA-Z0-9_,()[\]]/.test(char)) {
            // This might be part of a multi-line function signature, continue
            pos++;
          } else {
            // Unexpected character
            console.warn(`[SlangCompiler] Unexpected character '${char}' at position ${pos} when looking for opening brace for function: ${funcName}`);
            pos = -1; // Mark as failed
            break;
          }
        }
      }

      if (pos === -1 || pos >= globalSection.length || globalSection[pos] !== '{') {
        console.warn(`[SlangCompiler] Failed to find opening brace for function: ${funcName}`);
        continue;
      }

      // Skip the opening brace
      pos++;

      // Find matching closing brace for function body
      let braceCount = 1;
      while (pos < globalSection.length && braceCount > 0) {
        if (globalSection[pos] === '{') braceCount++;
        if (globalSection[pos] === '}') braceCount--;
        pos++;
      }

      if (braceCount === 0) {
        const functionCode = globalSection.substring(startPos, pos).trim();

        // Skip stub functions that will be added by buildGlobalDefinitionsCode
        const stubFunctionNames = ['HSM_GetCornerMask', 'hrg_get_ideal_global_eye_pos_for_points', 'hrg_get_ideal_global_eye_pos', 'HSM_GetBezelCoords'];
        if (stubFunctionNames.includes(funcName)) {
          console.log(`[SlangCompiler] Skipping stub function extraction: ${funcName} (will be added by buildGlobalDefinitionsCode)`);
          functionRanges.push({ start: startPos, end: pos }); // Still track range to avoid extracting variables from it
        } else {
          functions.push(functionCode);
          functionRanges.push({ start: startPos, end: pos });
          extractedCount++;

          // Debug: Log first few extracted functions
          if (extractedCount <= 5) {
            console.log(`[SlangCompiler] Extracted function ${extractedCount}: ${funcName} (${functionCode.length} chars, first 100): ${functionCode.substring(0, 100).replace(/\n/g, ' ')}`);
          }
        }
      } else {
        console.warn(`[SlangCompiler] Failed to find closing brace for function: ${funcName}`);
      }
    }

    console.log(`[SlangCompiler] Total functions extracted from global section: ${extractedCount}`);

    // Track UBO/push constant block ranges to avoid extracting members as globals
    const uboBlockRanges: Array<{start: number, end: number}> = [];
    const uboPattern = /layout\s*\([^)]*\)\s*uniform\s+\w+\s*\{/g;
    let uboMatch;
    while ((uboMatch = uboPattern.exec(globalSection)) !== null) {
      const startPos = uboMatch.index;
      let pos = startPos + uboMatch[0].length;
      let braceCount = 1;

      // Find closing brace
      while (pos < globalSection.length && braceCount > 0) {
        if (globalSection[pos] === '{') braceCount++;
        if (globalSection[pos] === '}') braceCount--;
        pos++;
      }

      if (braceCount === 0) {
        uboBlockRanges.push({ start: startPos, end: pos });
        console.log(`[SlangCompiler] Tracked UBO block range: ${startPos}-${pos}`);
      }
    }

    // Helper function to check if a position is inside any function body or UBO block
    const isInsideFunction = (pos: number): boolean => {
      return functionRanges.some(range => pos >= range.start && pos < range.end);
    };

    const isInsideUBOBlock = (pos: number): boolean => {
      return uboBlockRanges.some(range => pos >= range.start && pos < range.end);
    };

    // Extract const declarations (single line) - skip if inside functions
    const constPattern = /^[ \t]*const\s+\w+\s+\w+\s*=\s*[^;]+;/gm;
    let constMatch;
    while ((constMatch = constPattern.exec(globalSection)) !== null) {
      if (!isInsideFunction(constMatch.index)) {
        consts.push(constMatch[0].trim());
      }
    }

    // Extract mutable global scalar/vector/matrix/bool variables (NOT const - these are reassigned in shader code)
    // IMPORTANT: Skip variables inside function bodies (local variables)
    // Note: Making these mutable (not const) because many are reassigned in shader code (e.g., SCREEN_INDEX)
    // Allow both UPPERCASE and lowercase variable names

    const extractedGlobalNames = new Set<string>();

    // Common uniform names that should never be extracted as globals
    const commonUniformNames = new Set([
      'SourceSize', 'OriginalSize', 'OutputSize', 'FrameCount', 'FrameDirection',
      'MVP', 'FinalViewportSize', 'DerezedPassSize', 'OriginalFeedbackSize'
    ]);

    // Pattern 1: Initialized globals - float/vec2/mat4/bool variable_name = value;
    const mutableGlobalPattern = /^[ \t]*((?:float|int|uint|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4]|bool))\s+(\w+)\s*=\s*([^;]+);/gm;
    let mutableMatch;
    while ((mutableMatch = mutableGlobalPattern.exec(globalSection)) !== null) {
      if (isInsideFunction(mutableMatch.index) || isInsideUBOBlock(mutableMatch.index)) continue;

      const type = mutableMatch[1];
      const name = mutableMatch[2];
      let value = mutableMatch[3];

      // Skip if this name conflicts with a shader parameter or common uniform
      if (excludeNames.has(name) || commonUniformNames.has(name)) {
        continue;
      }

      // Skip if initializer contains function calls or undefined references
      // (these are likely inside function bodies that weren't caught by isInsideFunction)
      if (value.includes('min(') || value.includes('max(') || value.includes('sqrt(') ||
          value.includes('in_coord') || value.includes('screen_aspect') ||
          value.includes('corner_radius') || value.includes('edge_sharpness')) {
        continue;
      }

      // Convert integer literals to float literals for float type (GLSL requires float = 1.0, not 1)
      if (type === 'float' && /^-?\d+$/.test(value.trim())) {
        value = value.trim() + '.0';
      }

      // Keep as mutable global (no const) - these variables are reassigned in shader code
      globals.push(`${type} ${name} = ${value};`);
      extractedGlobalNames.add(name);
    }

    // Pattern 2: Uninitialized globals - float variable_name;
    const uninitializedGlobalPattern = /^[ \t]*((?:float|int|uint|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4]|bool))\s+(\w+)\s*;/gm;
    let uninitMatch;
    while ((uninitMatch = uninitializedGlobalPattern.exec(globalSection)) !== null) {
      if (isInsideFunction(uninitMatch.index) || isInsideUBOBlock(uninitMatch.index)) continue;

      const type = uninitMatch[1];
      const name = uninitMatch[2];

      // Skip if already extracted or conflicts with shader parameter or common uniform
      if (extractedGlobalNames.has(name) || excludeNames.has(name) || commonUniformNames.has(name)) {
        continue;
      }

      // Add uninitialized global
      globals.push(`${type} ${name};`);
    }

    console.log('[SlangCompiler] extractGlobalDefinitions - found:');
    console.log(`  - ${defines.length} #defines`);
    console.log(`  - ${consts.length} consts`);
    console.log(`  - ${globals.length} mutable globals`);
    console.log(`  - ${functions.length} functions`);

    if (defines.length > 0) {
      console.log('  First few defines:', defines.slice(0, 5));
    }
    if (globals.length > 0) {
      console.log('  First few globals:', globals.slice(0, 5));
    }
    if (functions.length > 0) {
      console.log('  Function names:', functions.map(f => {
        const nameMatch = f.match(/\s+(\w+)\s*\(/);
        return nameMatch ? nameMatch[1] : 'unknown';
      }).slice(0, 10));
    }

    return { functions, defines, consts, globals };
  }

  /**
   * Split shader into vertex and fragment stages
   */
  private static splitStages(source: string): ShaderStage[] {
    const stages: ShaderStage[] = [];
    const lines = source.split('\n');

    let currentStage: 'vertex' | 'fragment' | null = null;
    let currentSource: string[] = [];
    let inStage = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect #pragma stage
      if (trimmed.startsWith('#pragma stage')) {
        // Save previous stage
        if (currentStage && currentSource.length > 0) {
          stages.push({
            type: currentStage,
            source: currentSource.join('\n')
          });
        }

        // Start new stage
        if (trimmed.includes('vertex')) {
          currentStage = 'vertex';
        } else if (trimmed.includes('fragment')) {
          currentStage = 'fragment';
        }

        currentSource = [];
        inStage = true;
        continue;
      }

      // Skip pragma lines in stage
      if (trimmed.startsWith('#pragma')) {
        continue;
      }

      // Collect stage source
      if (inStage && currentStage) {
        currentSource.push(line);
      }
    }

    // Save last stage
    if (currentStage && currentSource.length > 0) {
      stages.push({
        type: currentStage,
        source: currentSource.join('\n')
      });
    }

    return stages;
  }

  /**
   * Extract Slang uniform bindings
   */
  private static extractBindings(source: string): SlangUniformBinding[] {
    const bindings: SlangUniformBinding[] = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // layout(set = 0, binding = 1) uniform sampler2D Name;
      const samplerMatch = line.match(
        /layout\s*\(\s*set\s*=\s*(\d+)\s*,\s*binding\s*=\s*(\d+)\s*\)\s*uniform\s+sampler\w+\s+(\w+)/
      );

      if (samplerMatch) {
        bindings.push({
          set: parseInt(samplerMatch[1]),
          binding: parseInt(samplerMatch[2]),
          type: 'sampler',
          name: samplerMatch[3]
        });
        continue;
      }

      // layout(push_constant) uniform Push { ... } params;
      // Check push_constant BEFORE generic UBO to avoid matching it as UBO
      if (line.includes('push_constant')) {
        const pushMatch = line.match(/uniform\s+(\w+)/);
        if (pushMatch) {
          const pushTypeName = pushMatch[1];
          const members: UBOMember[] = [];
          let instanceName: string | undefined;

          // Extract push constant members with types
          for (let j = i + 1; j < lines.length; j++) {
            const memberLine = lines[j].trim();

            if (memberLine === '}' || memberLine.startsWith('}')) {
              // Check for instance name after closing brace: } params;
              const instanceMatch = memberLine.match(/}\s*(\w+)\s*;/);
              if (instanceMatch) {
                instanceName = instanceMatch[1];
              }
              break;
            }

            const memberMatch = memberLine.match(/^([\w]+)\s+([\w]+)\s*;/);
            if (memberMatch) {
              members.push({
                type: memberMatch[1],
                name: memberMatch[2]
              });
            }
          }

          bindings.push({
            set: 0,
            binding: 0,
            type: 'pushConstant',
            name: pushTypeName, // Type name (e.g., "Push")
            instanceName, // Instance name (e.g., "params")
            members
          });
        }
        continue;
      }

      // layout(std140, set = 0, binding = 0) uniform UBO { ... }
      // Note: Opening brace { may be on this line or the next line
      // This check comes AFTER push_constant to avoid matching push constants
      // Allow optional qualifiers like std140 before set/binding
      const uboMatch = line.match(
        /layout\s*\([^)]*set\s*=\s*\d+[^)]*binding\s*=\s*\d+[^)]*\)\s*uniform\s+(\w+)/
      );

      if (uboMatch) {
        const uboName = uboMatch[1];
        const members: UBOMember[] = [];
        let instanceName: string | undefined;

        // Find the opening brace (may be on current line or next line)
        let startJ = i;
        if (!line.includes('{') && i + 1 < lines.length && lines[i + 1].trim().startsWith('{')) {
          startJ = i + 1; // Brace is on next line
        }

        // Extract UBO members with types
        for (let j = startJ + 1; j < lines.length; j++) {
          const memberLine = lines[j].trim();

          if (memberLine === '}' || memberLine.startsWith('}')) {
            // Check for instance name after closing brace: } global;
            const instanceMatch = memberLine.match(/}\s*(\w+)\s*;/);
            if (instanceMatch) {
              instanceName = instanceMatch[1];
            }
            break;
          }

          // Extract member type and name: "mat4 MVP;" or "vec4 OutputSize;" or "float HSM_PARAM;"
          const memberMatch = memberLine.match(/^([\w]+)\s+([\w]+)\s*;/);
          if (memberMatch) {
            members.push({
              type: memberMatch[1],
              name: memberMatch[2]
            });
          }
        }

        bindings.push({
          set: 0,
          binding: 0,
          type: 'ubo',
          name: uboName,
          instanceName, // Add instance name (e.g., "global")
          members
        });
        continue;
      }
    }

    return bindings;
  }

  /**
   * Build code block from global definitions
   */
  private static buildGlobalDefinitionsCode(globalDefs: GlobalDefinitions, source: string): string {
    const parts: string[] = [];

    // Helper function to check if a definition already exists in source
    const definitionExists = (definition: string): boolean => {
      // For variables: check for variable declarations with word boundaries
      if (definition.includes(' = ') && !definition.startsWith('#define')) {
        const varMatch = definition.match(/^\s*(?:float|int|vec\d|mat\d|bool)\s+(\w+)\s*=/);
        if (varMatch) {
          const varName = varMatch[1];
          // Use word boundaries to avoid partial matches
          const varPattern = new RegExp(`\\b${varName}\\b`);
          return varPattern.test(source);
        }
      }
      // For functions: check for function declarations
      else if (definition.includes('(') && definition.includes(')')) {
        const funcMatch = definition.match(/^\s*(?:\w+)\s+(\w+)\s*\(/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          // Check for function name followed by opening parenthesis
          const funcPattern = new RegExp(`\\b${funcName}\\s*\\(`);
          return funcPattern.test(source);
        }
      }
      // For #defines: check for macro definitions
      else if (definition.startsWith('#define ')) {
        const macroMatch = definition.match(/^#define\s+(\w+)/);
        if (macroMatch) {
          const macroName = macroMatch[1];
          const macroPattern = new RegExp(`#define\\s+${macroName}\\b`);
          return macroPattern.test(source);
        }
      }
      return false;
    };

    // Add stub definitions for missing Mega Bezel variables and functions (only if not already present)
    parts.push('// Stub definitions for missing Mega Bezel variables and functions');
    const stubDefines = [
      '#define LPOS vec3(0.0, 0.0, 1.0)',
      '#define LCOL vec3(1.0, 1.0, 1.0)',
      '#define FIX(c) max(abs(c), 1e-5)',
      '#define HRG_MAX_POINT_CLOUD_SIZE 9',
      '#define IS_POTATO_PRESET'
    ];

    for (const define of stubDefines) {
      if (!definitionExists(define)) {
        parts.push(define);
      }
    }
    parts.push('');

    // Mega Bezel coordinate and parameter variables (now injected as uniforms) - only if not already present
    parts.push('// Mega Bezel coordinate and parameter variables (now injected as uniforms)');
    const megaBezelVars = [
      'vec2 TUBE_DIFFUSE_COORD = vec2(0.5, 0.5);',
      'vec2 TUBE_DIFFUSE_SCALE = vec2(1.0, 1.0);',
      'vec2 TUBE_SCALE = vec2(1.0, 1.0);',
      'float TUBE_DIFFUSE_ASPECT = 1.0;',
      'float TUBE_MASK = 1.0;'
    ];

    for (const varDef of megaBezelVars) {
      if (!definitionExists(varDef)) {
        parts.push(varDef);
      }
    }
    parts.push('');

    // Stub functions - only add if not already present in source
    const stubFunctions = [
      {
        name: 'HSM_GetTubeCurvedCoord',
        code: [
          'vec2 HSM_GetTubeCurvedCoord(vec2 in_coord, float in_geom_mode, vec2 in_geom_radius_scaled, vec2 in_geom_view_dist, float in_geom_tilt_angle_x, float in_geom_tilt_angle_y, float in_geom_aspect_ratio, vec2 in_geom_overscan, vec2 in_geom_tilted_tangent, vec2 in_geom_tangent_angle, vec2 in_geom_tangent_angle_screen_scale, vec2 in_geom_pos_x, vec2 in_geom_pos_y) {',
          '  return in_coord;',
          '}'
        ]
      },
      {
        name: 'HSM_GetCornerMask',
        code: [
          'float HSM_GetCornerMask(vec2 in_coord, float screen_aspect, float corner_radius, float edge_sharpness) {',
          '  vec2 new_coord = min(in_coord, vec2(1.0) - in_coord) * vec2(screen_aspect, 1.0);',
          '  vec2 corner_distance = vec2(max(corner_radius / 1000.0, (1.0 - edge_sharpness) * 0.01));',
          '  new_coord = (corner_distance - min(new_coord, corner_distance));',
          '  float distance = sqrt(dot(new_coord, new_coord));',
          '  return clamp((corner_distance.x - distance) * (edge_sharpness * 500.0 + 100.0), 0.0, 1.0);',
          '}'
        ]
      },
      {
        name: 'HSM_GetUseOnCurrentScreenIndex',
        code: [
          'float HSM_GetUseOnCurrentScreenIndex(float vis_mode) {',
          '  return 1.0;',
          '}'
        ]
      },
      {
        name: 'HSM_ApplyMonochrome',
        code: [
          'vec4 HSM_ApplyMonochrome(vec4 in_color) {',
          '  return in_color;',
          '}'
        ]
      },
      {
        name: 'HSM_GetMirrorWrappedCoord',
        code: [
          'vec2 HSM_GetMirrorWrappedCoord(vec2 in_coord, float mirror_x, float mirror_y) {',
          '  return in_coord;',
          '}'
        ]
      },
      {
        name: 'HSM_GetCurvedCoord',
        code: [
          'vec2 HSM_GetCurvedCoord(vec2 in_coord, float curvature_scale, float screen_aspect) {',
          '  return in_coord;',
          '}'
        ]
      },
      {
        name: 'HSM_Linearize',
        code: [
          'vec4 HSM_Linearize(vec4 in_color, float gamma) {',
          '  return in_color;',
          '}'
        ]
      },
      {
        name: 'HSM_Delinearize',
        code: [
          'vec4 HSM_Delinearize(vec4 in_color, float gamma) {',
          '  return in_color;',
          '}'
        ]
      },
      {
        name: 'HSM_BlendModeLayerMix',
        code: [
          'vec4 HSM_BlendModeLayerMix(vec4 color_under, vec4 color_over, float blend_mode, float layer_opacity) {',
          '  return mix(color_under, color_over, layer_opacity);',
          '}'
        ]
      },
      {
        name: 'HSM_Apply_Sinden_Lightgun_Border',
        code: [
          'vec4 HSM_Apply_Sinden_Lightgun_Border(vec4 in_color, vec2 in_coord) {',
          '  return in_color;',
          '}'
        ]
      },
      {
        name: 'HSM_GetViewportCoordWithZoomAndPan',
        code: [
          'vec2 HSM_GetViewportCoordWithZoomAndPan(vec2 in_coord, float zoom_percent, vec2 pan_offset) {',
          '  return in_coord;',
          '}'
        ]
      },
      {
        name: 'HSM_UpdateGlobalScreenValuesFromCache',
        code: [
          'void HSM_UpdateGlobalScreenValuesFromCache(out vec2 cache_bounds_coord, out vec2 cache_bounds_coord_clamped, out vec2 cache_bounds_clamped, out vec2 screen_curved_coord, out vec2 screen_curved_coord_clamped, out vec2 screen_pos_offset, out vec2 screen_scale_offset, out vec2 screen_pos_offset_1st_screen, out vec2 screen_scale_offset_1st_screen, out vec2 screen_curved_coord_with_overscan, out vec2 screen_curved_coord_with_overscan_clamped, out vec2 screen_coord_with_overscan, out vec2 screen_coord_with_overscan_clamped, out vec2 screen_scale_with_overscan, out vec2 screen_pos_with_overscan, out vec2 source_size_minned, out vec2 source_size_maxed, out vec2 source_size_minned_1st_screen, out vec2 source_size_maxed_1st_screen) {',
          '  cache_bounds_coord = vec2(0.0);',
          '  cache_bounds_coord_clamped = vec2(0.0);',
          '  cache_bounds_clamped = vec2(0.0);',
          '  screen_curved_coord = vec2(0.0);',
          '  screen_curved_coord_clamped = vec2(0.0);',
          '  screen_pos_offset = vec2(0.0);',
          '  screen_scale_offset = vec2(0.0);',
          '  screen_pos_offset_1st_screen = vec2(0.0);',
          '  screen_scale_offset_1st_screen = vec2(0.0);',
          '  screen_curved_coord_with_overscan = vec2(0.0);',
          '  screen_curved_coord_with_overscan_clamped = vec2(0.0);',
          '  screen_coord_with_overscan = vec2(0.0);',
          '  screen_coord_with_overscan_clamped = vec2(0.0);',
          '  screen_scale_with_overscan = vec2(0.0);',
          '  screen_pos_with_overscan = vec2(0.0);',
          '  source_size_minned = vec2(0.0);',
          '  source_size_maxed = vec2(0.0);',
          '  source_size_minned_1st_screen = vec2(0.0);',
          '  source_size_maxed_1st_screen = vec2(0.0);',
          '}'
        ]
      },
      {
        name: 'HSM_GetUseScreenVignette',
        code: [
          'float HSM_GetUseScreenVignette() {',
          '  return 0.0;',
          '}'
        ]
      },
      {
        name: 'HSM_GetScreenVignetteFactor',
        code: [
          'float HSM_GetScreenVignetteFactor(vec2 in_coord) {',
          '  return 1.0;',
          '}'
        ]
      },
      {
        name: 'HSM_GetBezelCoords',
        code: [
          'float HSM_GetBezelCoords(vec2 tube_diffuse_coord, vec2 tube_diffuse_scale, vec2 tube_scale, float screen_aspect, bool curve_coords_on, inout vec2 bezel_outside_scale, inout vec2 bezel_outside_coord, inout vec2 bezel_outside_curved_coord, inout vec2 frame_outside_curved_coord) {',
          '  bezel_outside_scale = vec2(1.0);',
          '  bezel_outside_coord = tube_diffuse_coord;',
          '  bezel_outside_curved_coord = tube_diffuse_coord;',
          '  frame_outside_curved_coord = tube_diffuse_coord;',
          '  return 0.0;',
          '}'
        ]
      },
      {
        name: 'hrg_get_ideal_global_eye_pos_for_points',
        code: [
          'vec3 hrg_get_ideal_global_eye_pos_for_points(vec3 eye_pos, vec2 output_aspect, vec3 global_coords[HRG_MAX_POINT_CLOUD_SIZE], int num_points, float in_geom_radius, float in_geom_view_dist) {',
          '  return eye_pos;',
          '}'
        ]
      },
      {
        name: 'hrg_get_ideal_global_eye_pos',
        code: [
          'vec3 hrg_get_ideal_global_eye_pos(mat3x3 local_to_global, vec2 output_aspect, float in_geom_mode, float in_geom_radius, float in_geom_view_dist) {',
          '  return vec3(0.0, 0.0, 1.0);',
          '}'
        ]
      }
    ];

    parts.push('// Stub functions');
    for (const func of stubFunctions) {
      if (!definitionExists(func.code[0])) {
        parts.push(...func.code);
        parts.push('');
      }
    }


    if (globalDefs.defines.length > 0) {
      // Deduplicate #defines by macro name (keep first occurrence)
      const seenDefines = new Set<string>();
      const uniqueDefines: string[] = [];

      // Prevent stub definitions from being overridden
      seenDefines.add('LPOS');
      seenDefines.add('LCOL');
      seenDefines.add('FIX');
      seenDefines.add('HRG_MAX_POINT_CLOUD_SIZE');

      for (const define of globalDefs.defines) {
        const macroName = define.match(/#define\s+(\w+)/)?.[1];
        if (macroName && !seenDefines.has(macroName)) {
          seenDefines.add(macroName);
          uniqueDefines.push(define);

          // Debug: Log HRG define
          if (macroName === 'HRG_MAX_POINT_CLOUD_SIZE') {
            console.log(`[SlangCompiler] buildGlobalDefinitionsCode: Adding HRG define to uniqueDefines:`, define);
          }
        } else if (macroName === 'HRG_MAX_POINT_CLOUD_SIZE') {
          console.log(`[SlangCompiler] buildGlobalDefinitionsCode: SKIPPING HRG define (duplicate or no macroName):`, define, 'seen:', seenDefines.has(macroName));
        }
      }

      parts.push('// Global #define macros');
      parts.push(...uniqueDefines);
      parts.push('');

      // Debug: Check if HRG define is in parts
      const hasHrgInParts = parts.some(p => p.includes('HRG_MAX_POINT_CLOUD_SIZE'));
      if (globalDefs.defines.some(d => d.includes('HRG_MAX_POINT_CLOUD_SIZE')) && !hasHrgInParts) {
        console.log('[SlangCompiler] ERROR: HRG define was in globalDefs.defines but NOT added to parts!');
      }
    }

    if (globalDefs.consts.length > 0) {
      parts.push('// Global const declarations');
      parts.push(...globalDefs.consts);
      parts.push('');
    }

    if (globalDefs.globals.length > 0) {
      parts.push('// Global mutable variables');
      parts.push(...globalDefs.globals);
      parts.push('');
    }

    if (globalDefs.functions.length > 0) {
      parts.push('// Global function definitions');

      // Fix int/float division and arithmetic in extracted functions
      const fixedFunctions = globalDefs.functions.map(func => {
        let fixed = func;

        // Fix division: int / float → float / float
        // Use negative lookahead/lookbehind to avoid matching digits in floating-point numbers
        // (?<![.\d]) = not preceded by . or digit (avoids matching 0 from 1.0)
        // (?!\.) = not followed by . (avoids matching 1 from 1.0)
        fixed = fixed.replace(/(?<![.\d])(\d+)(?!\.)\s*\/\s*([a-zA-Z_][\w.]*)/g, (match, num, varName) => {
          return `${num}.0 / ${varName}`;
        });

        // Fix division in expressions like: 1 / (something)
        fixed = fixed.replace(/(?<![.\d])(\d+)(?!\.)\s*\/\s*\(/g, (match, num) => {
          return `${num}.0 / (`;
        });

        // Fix multiplication and subtraction with integers in expressions
        // Pattern: (1 - something) where 1 should be 1.0
        fixed = fixed.replace(/\((\d+)(?!\.)\s*([+\-*])\s*([a-zA-Z_][\w.]*)/g, (match, num, op, varName) => {
          if (parseInt(num) < 100) { // Only fix small ints likely to be constants
            return `(${num}.0 ${op} ${varName}`;
          }
          return match;
        });

        // NOTE: Aggressive function argument conversion disabled due to false positives
        // (converts loop counters, parts of float literals like 12.9898, etc.)

        return fixed;
      });

      parts.push(...fixedFunctions);
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Convert Slang GLSL to WebGL GLSL
   */
  private static convertToWebGL(
    source: string,
    stage: 'vertex' | 'fragment',
    bindings: SlangUniformBinding[],
    webgl2: boolean,
    parameters: ShaderParameter[] = [],
    globalDefs: GlobalDefinitions = { functions: [], defines: [], consts: [], globals: [] }
  ): string {
    let output = source;

    // Replace #version
    if (webgl2) {
      output = output.replace(/#version\s+\d+/, '#version 300 es');
    } else {
      output = output.replace(/#version\s+\d+/, '');
    }

    // Strip #pragma parameter lines (they become uniforms instead)
    output = output.replace(/#pragma\s+parameter\s+.*$/gm, '');

    // Strip #define directives that alias UBO members (we're converting UBO to individual uniforms)
    // Common patterns: #define SourceSize params.OriginalSize, #define MVP global.MVP
    const uboDefines = /^\s*#define\s+(SourceSize|OriginalSize|OriginalFeedbackSize|OutputSize|FinalViewportSize|DerezedPassSize|FrameCount|FrameDirection|MVP)\s+.*$/gm;
    output = output.replace(uboDefines, '');

    // Add precision (both vertex and fragment need it for uniform injection)
    const precisionLine = webgl2
      ? 'precision highp float;\nprecision highp int;\n'
      : 'precision mediump float;\n';

    // Insert after #version
    const versionMatch = output.match(/#version.*?\n/);
    if (versionMatch) {
      output = output.replace(versionMatch[0], versionMatch[0] + precisionLine);
    } else {
      output = precisionLine + output;
    }

    // Inject global definitions after precision declarations
    const globalDefsCode = this.buildGlobalDefinitionsCode(globalDefs, output);
    if (globalDefsCode) {
      console.log(`[SlangCompiler] Injecting ${globalDefs.defines.length + globalDefs.consts.length + globalDefs.globals.length + globalDefs.functions.length} global definitions into ${stage} stage`);

      // Find insertion point: after precision declarations
      const precisionEnd = output.search(/precision\s+\w+\s+\w+\s*;\s*\n/);
      if (precisionEnd !== -1) {
        const precisionMatch = output.substring(precisionEnd).match(/precision\s+\w+\s+\w+\s*;\s*\n/);
        if (precisionMatch) {
          const insertPos = precisionEnd + precisionMatch[0].length;
          output = output.substring(0, insertPos) + '\n' + globalDefsCode + '\n' + output.substring(insertPos);
        }
      } else {
        // No precision found, insert after #version
        const versionEnd = output.search(/#version.*?\n/);
        if (versionEnd !== -1) {
          const versionMatch = output.match(/#version.*?\n/);
          if (versionMatch) {
            const insertPos = versionEnd + versionMatch[0].length;
            output = output.substring(0, insertPos) + '\n' + globalDefsCode + '\n' + output.substring(insertPos);
          }
        }
      }
    }

    // Add RetroArch params and shader parameter uniforms
    // Extract existing UBO/push constant member names to avoid redefinition
    const existingMembers = new Set<string>();
    bindings.forEach(binding => {
      if (binding.members) {
        binding.members.forEach(member => existingMembers.add(member.name));
      }
    });

    console.log(`[SlangCompiler] Stage conversion - found ${existingMembers.size} existing binding members`);
    console.log(`[SlangCompiler] Stage conversion - processing ${parameters.length} shader parameters`);

    // Build parameter uniforms (skip if already in UBO/push constant OR duplicate in parameters array)
    const seenParams = new Set<string>();
    const filtered = parameters.filter(param => {
      if (existingMembers.has(param.name)) return false; // Already in UBO/push constant
      if (seenParams.has(param.name)) {
        console.log(`[SlangCompiler] Skipping duplicate parameter: ${param.name}`);
        return false; // Duplicate in parameters array
      }
      seenParams.add(param.name);
      return true;
    });

    const skippedInBindings = parameters.filter(param => existingMembers.has(param.name));
    if (skippedInBindings.length > 0) {
      console.log(`[SlangCompiler] Skipping ${skippedInBindings.length} parameters already in bindings:`, skippedInBindings.map(p => p.name).slice(0, 20).join(', '), '...');
    }

    const paramUniforms = filtered
      .map(param => `uniform float ${param.name};`)
      .join('\n');

    // Mega Bezel parameters - injected as mutable variables, not uniforms
    // Most HSM parameters need to be assignable variables, not read-only uniforms
    let megaBezelVariables = '';

    if (stage === 'fragment') {
      megaBezelVariables = `
float HSM_AB_COMPARE_AREA = 0.0;
uniform float HSM_AB_COMPARE_FREEZE_CRT_TUBE;
uniform float HSM_AB_COMPARE_FREEZE_GRAPHICS;
uniform float HSM_AB_COMPARE_SHOW_MODE;
uniform float HSM_AB_COMPARE_SPLIT_POSITION;
uniform float HSM_AMBIENT_LIGHTING_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float HSM_AMBIENT1_HUE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_OPACITY;
uniform float HSM_AMBIENT1_POSITION_X;
uniform float HSM_AMBIENT1_POSITION_Y;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_SATURATION;
uniform float HSM_AMBIENT1_SCALE;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_VALUE;
uniform float HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_HUE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT2_POSITION_X;
uniform float HSM_AMBIENT2_POSITION_Y;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_SATURATION;
uniform float HSM_AMBIENT2_SCALE;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_VALUE;
uniform float HSM_ANTI_FLICKER_ON;
uniform float HSM_ANTI_FLICKER_THRESHOLD;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_BG_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BG_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_BG_BLEND_MODE;
uniform float HSM_BG_BRIGHTNESS;
uniform float HSM_BG_COLORIZE_ON;
uniform float HSM_BG_CUTOUT_MODE;
uniform float HSM_BG_DUALSCREEN_VIS_MODE;
uniform float HSM_BG_FILL_MODE;
uniform float HSM_BG_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_BG_FOLLOW_LAYER;
uniform float HSM_BG_FOLLOW_MODE;
uniform float HSM_BG_GAMMA;
uniform float HSM_BG_HUE;
uniform float HSM_BG_LAYER_ORDER;
uniform float HSM_BG_MASK_MODE;
uniform float HSM_BG_MIPMAPPING_BLEND_BIAS;
uniform float HSM_BG_OPACITY;
uniform float HSM_BG_POS_X;
uniform float HSM_BG_POS_Y;
uniform float HSM_BG_SATURATION;
uniform float HSM_BG_SCALE;
uniform float HSM_BG_SCALE_X;
uniform float HSM_BG_SOURCE_MATTE_TYPE;
uniform float HSM_BG_SPLIT_PRESERVE_CENTER;
uniform float HSM_BG_SPLIT_REPEAT_WIDTH;
uniform float HSM_BG_WRAP_MODE;
uniform float HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_BLEND_MODE;
uniform float HSM_BZL_BRIGHTNESS;
uniform float HSM_BZL_BRIGHTNESS_MULT_BOTTOM;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDES;
uniform float HSM_BZL_BRIGHTNESS_MULT_TOP;
uniform float HSM_BZL_COLOR_HUE;
uniform float HSM_BZL_COLOR_SATURATION;
uniform float HSM_BZL_COLOR_VALUE;
uniform float HSM_BZL_HEIGHT;
uniform float HSM_BZL_HIGHLIGHT;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS;
uniform float HSM_BZL_INDEPENDENT_SCALE;
uniform float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_EDGE_HIGHLIGHT;
uniform float HSM_BZL_INNER_EDGE_SHADOW;
uniform float HSM_BZL_INNER_EDGE_SHARPNESS;
uniform float HSM_BZL_INNER_EDGE_THICKNESS;
uniform float HSM_BZL_NOISE;
uniform float HSM_BZL_OPACITY;
uniform float HSM_BZL_OUTER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_OUTER_CURVATURE_SCALE;
uniform float HSM_BZL_OUTER_POSITION_Y;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_USE_INDEPENDENT_CURVATURE;
uniform float HSM_BZL_USE_INDEPENDENT_SCALE;
uniform float HSM_BZL_WIDTH;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_CROP_MODE;
uniform float HSM_CROP_PERCENT_BOTTOM;
uniform float HSM_CROP_PERCENT_LEFT;
uniform float HSM_CROP_PERCENT_RIGHT;
uniform float HSM_CROP_PERCENT_TOP;
uniform float HSM_CROP_PERCENT_ZOOM;
uniform float HSM_CRT_BLEND_AMOUNT;
uniform float HSM_CRT_BLEND_MODE;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float HSM_CURVATURE_3D_RADIUS;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float HSM_CURVATURE_3D_VIEW_DIST;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float HSM_DREZ_HSHARP0;
uniform float HSM_DREZ_SIGMA_HV;
uniform float HSM_DREZ_SHAR;
uniform float HSM_DREZ_THRESHOLD_RATIO;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float HSM_DUALSCREEN_MODE;
uniform float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_FAKE_SCANLINE_CURVATURE;
uniform float HSM_FAKE_SCANLINE_INT_SCALE;
uniform float HSM_FAKE_SCANLINE_MODE;
uniform float HSM_FAKE_SCANLINE_OPACITY;
uniform float HSM_FAKE_SCANLINE_RES;
uniform float HSM_FAKE_SCANLINE_RES_MODE;
uniform float HSM_FAKE_SCANLINE_ROLL;
uniform float HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_FLIP_CORE_VERTICAL;
uniform float HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float HSM_FLIP_VIEWPORT_VERTICAL;
uniform float HSM_FRM_BLEND_MODE;
uniform float HSM_FRM_COLOR_HUE;
uniform float HSM_FRM_COLOR_SATURATION;
uniform float HSM_FRM_COLOR_VALUE;
uniform float HSM_FRM_INNER_EDGE_HIGHLIGHT;
uniform float HSM_FRM_INNER_EDGE_THICKNESS;
uniform float HSM_FRM_NOISE;
uniform float HSM_FRM_OPACITY;
uniform float HSM_FRM_OUTER_CORNER_RADIUS;
uniform float HSM_FRM_OUTER_CURVATURE_SCALE;
uniform float HSM_FRM_OUTER_EDGE_SHADING;
uniform float HSM_FRM_OUTER_EDGE_THICKNESS;
uniform float HSM_FRM_OUTER_POS_Y;
uniform float HSM_FRM_SHADOW_OPACITY;
uniform float HSM_FRM_SHADOW_WIDTH;
uniform float HSM_FRM_TEXTURE_BLEND_MODE;
uniform float HSM_FRM_TEXTURE_OPACITY;
uniform float HSM_FRM_THICKNESS;
uniform float HSM_FRM_THICKNESS_SCALE_X;
uniform float HSM_FRM_USE_INDEPENDENT_COLOR;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float HSM_INTERLACE_EFFECT_SMOOTHNESS_INTERS;
uniform float HSM_INTERLACE_MODE;
uniform float HSM_INTERLACE_SCANLINE_EFFECT;
uniform float HSM_INTERLACE_TRIGGER_RES;
uniform float HSM_INTRO_LOGO_BLEND_MODE;
uniform float HSM_INTRO_LOGO_FADE_IN;
uniform float HSM_INTRO_LOGO_FADE_OUT;
uniform float HSM_INTRO_LOGO_FLIP_VERTICAL;
uniform float HSM_INTRO_LOGO_HEIGHT;
uniform float HSM_INTRO_LOGO_HOLD;
uniform float HSM_INTRO_LOGO_OVER_SOLID_COLOR;
uniform float HSM_INTRO_LOGO_PLACEMENT;
uniform float HSM_INTRO_LOGO_POS_X;
uniform float HSM_INTRO_LOGO_POS_Y;
uniform float HSM_INTRO_LOGO_WAIT;
uniform float HSM_INTRO_NOISE_BLEND_MODE;
uniform float HSM_INTRO_NOISE_FADE_OUT;
uniform float HSM_INTRO_NOISE_HOLD;
uniform float HSM_INTRO_SOLID_BLACK_FADE_OUT;
uniform float HSM_INTRO_SOLID_BLACK_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_BLEND_MODE;
uniform float HSM_INTRO_SOLID_COLOR_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_HUE;
uniform float HSM_INTRO_SOLID_COLOR_SAT;
uniform float HSM_INTRO_SOLID_COLOR_VALUE;
uniform float HSM_INTRO_SPEED;
uniform float HSM_INTRO_WHEN_TO_SHOW;
uniform float HSM_LAYERING_DEBUG_MASK_MODE;
uniform float HSM_LED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_LED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_LED_BLEND_MODE;
uniform float HSM_LED_BRIGHTNESS;
uniform float HSM_LED_COLORIZE_ON;
uniform float HSM_LED_CUTOUT_MODE;
uniform float HSM_LED_DUALSCREEN_VIS_MODE;
uniform float HSM_LED_FILL_MODE;
uniform float HSM_LED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_LED_FOLLOW_LAYER;
uniform float HSM_LED_FOLLOW_MODE;
uniform float HSM_LED_GAMMA;
uniform float HSM_LED_HUE;
uniform float HSM_LED_LAYER_ORDER;
uniform float HSM_LED_MASK_MODE;
uniform float HSM_LED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_LED_OPACITY;
uniform float HSM_LED_POS_X;
uniform float HSM_LED_POS_Y;
uniform float HSM_LED_SATURATION;
uniform float HSM_LED_SCALE;
uniform float HSM_LED_SCALE_X;
uniform float HSM_LED_SOURCE_MATTE_TYPE;
uniform float HSM_LED_SPLIT_PRESERVE_CENTER;
uniform float HSM_LED_SPLIT_REPEAT_WIDTH;
uniform float HSM_MONOCHROME_BRIGHTNESS;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_MONOCHROME_GAMMA;
uniform float HSM_MONOCHROME_HUE_OFFSET;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_SATURATION;
uniform float HSM_NON_INTEGER_SCALE;
uniform float HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_OVERSCAN_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_MODE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
uniform float HSM_OVERSCAN_RASTER_BLOOM_ON;
uniform float HSM_OVERSCAN_X;
uniform float HSM_OVERSCAN_Y;
uniform float HSM_PASS_VIEWER_EMPTY_LINE;
uniform float HSM_PASS_VIEWER_TITLE;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_POST_CRT_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
uniform float HSM_POTATO_SHOW_BG_OVER_SCREEN;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_BLUR_FALLOFF_DISTANCE;
uniform float HSM_REFLECT_BLUR_MAX;
uniform float HSM_REFLECT_BLUR_MIN;
uniform float HSM_REFLECT_BLUR_NUM_SAMPLES;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BLACK_LEVEL;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BRIGHTNESS;
uniform float HSM_REFLECT_CORNER_FADE;
uniform float HSM_REFLECT_CORNER_FADE_DISTANCE;
uniform float HSM_REFLECT_CORNER_INNER_SPREAD;
uniform float HSM_REFLECT_CORNER_OUTER_SPREAD;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP;
uniform float HSM_REFLECT_CORNER_SPREAD_FALLOFF;
uniform float HSM_REFLECT_DIFFUSED_AMOUNT;
uniform float HSM_REFLECT_DIRECT_AMOUNT;
uniform float HSM_REFLECT_FADE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_SHARPNESS;
uniform float HSM_REFLECT_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FULLSCREEN_GLOW_GAMMA;
uniform float HSM_REFLECT_GLOBAL_AMOUNT;
uniform float HSM_REFLECT_GLOBAL_GAMMA_ADJUST;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_DISTANCE;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_POSITION;
uniform float HSM_REFLECT_MASK_BLACK_LEVEL;
uniform float HSM_REFLECT_MASK_BRIGHTNESS;
uniform float HSM_REFLECT_MASK_FOLLOW_LAYER;
uniform float HSM_REFLECT_MASK_FOLLOW_MODE;
uniform float HSM_REFLECT_MASK_IMAGE_AMOUNT;
uniform float HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS;
uniform float HSM_REFLECT_NOISE_AMOUNT;
uniform float HSM_REFLECT_NOISE_SAMPLE_DISTANCE;
uniform float HSM_REFLECT_NOISE_SAMPLES;
uniform float HSM_REFLECT_RADIAL_FADE_HEIGHT;
uniform float HSM_REFLECT_RADIAL_FADE_WIDTH;
uniform float HSM_REFLECT_SHOW_TUBE_FX_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_SIZE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_EMPTY_LINE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_TITLE;
uniform float HSM_RENDER_SIMPLE_MASK_TYPE;
uniform float HSM_RENDER_SIMPLE_MODE;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_SCANLINE_DIRECTION;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_SCREEN_POSITION_X;
uniform float HSM_SCREEN_POSITION_Y;
uniform float HSM_SCREEN_REFLECTION_FOLLOW_DIFFUSE_THICKNESS;
uniform float HSM_SCREEN_REFLECTION_POS_X;
uniform float HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_SCREEN_REFLECTION_SCALE;
uniform float HSM_SCREEN_VIGNETTE_DUALSCREEN_VIS_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_SCREEN_VIGNETTE_ON;
uniform float HSM_SCREEN_VIGNETTE_POWER;
uniform float HSM_SCREEN_VIGNETTE_STRENGTH;
uniform float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_SHOW_PASS_ALPHA;
uniform float HSM_SHOW_PASS_APPLY_SCREEN_COORD;
uniform float HSM_SHOW_PASS_INDEX;
uniform float HSM_SIGNAL_NOISE_AMOUNT;
uniform float HSM_SIGNAL_NOISE_BLACK_LEVEL;
uniform float HSM_SIGNAL_NOISE_ON;
uniform float HSM_SIGNAL_NOISE_SIZE_MODE;
uniform float HSM_SIGNAL_NOISE_SIZE_MULT;
uniform float HSM_SIGNAL_NOISE_TYPE;
uniform float HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_TOP_BLEND_MODE;
uniform float HSM_TOP_BRIGHTNESS;
uniform float HSM_TOP_COLORIZE_ON;
uniform float HSM_TOP_CUTOUT_MODE;
uniform float HSM_TOP_DUALSCREEN_VIS_MODE;
uniform float HSM_TOP_FILL_MODE;
uniform float HSM_TOP_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_TOP_FOLLOW_LAYER;
uniform float HSM_TOP_FOLLOW_MODE;
uniform float HSM_TOP_GAMMA;
uniform float HSM_TOP_HUE;
uniform float HSM_TOP_LAYER_ORDER;
uniform float HSM_TOP_MASK_MODE;
uniform float HSM_TOP_MIPMAPPING_BLEND_BIAS;
uniform float HSM_TOP_OPACITY;
uniform float HSM_TOP_POS_X;
uniform float HSM_TOP_POS_Y;
uniform float HSM_TOP_SATURATION;
uniform float HSM_TOP_SCALE;
uniform float HSM_TOP_SCALE_X;
uniform float HSM_TOP_SOURCE_MATTE_TYPE;
uniform float HSM_TOP_SPLIT_PRESERVE_CENTER;
uniform float HSM_TOP_SPLIT_REPEAT_WIDTH;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_LINE;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_TITLE;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_SHARPNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_OPACITY;
uniform float HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float HSM_TUBE_STATIC_DITHER_AMOUNT;
uniform float HSM_TUBE_STATIC_DITHER_DISTANCE;
uniform float HSM_TUBE_STATIC_DITHER_SAMPLES;
uniform float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float HSM_TUBE_STATIC_POS_X;
uniform float HSM_TUBE_STATIC_POS_Y;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float HSM_TUBE_STATIC_SCALE;
uniform float HSM_TUBE_STATIC_SCALE_X;
uniform float HSM_TUBE_STATIC_SHADOW_OPACITY;
uniform float HSM_USE_GEOM;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float HSM_VERTICAL_PRESET;
uniform float HSM_VIEWPORT_POSITION_X;
uniform float HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER;
uniform float HSM_VIEWPORT_VIGNETTE_LAYER_ORDER;
uniform float HSM_VIEWPORT_VIGNETTE_MASK_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_OPACITY;
uniform float HSM_VIEWPORT_VIGNETTE_POS_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_Y;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE_X;
uniform float HSM_VIEWPORT_ZOOM;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float HSM_2ND_SCREEN_POS_X;
uniform float HSM_2ND_SCREEN_POS_Y;
uniform float HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float SCREEN_ASPECT;
uniform vec2 SCREEN_COORD;
uniform float DEFAULT_SRGB_GAMMA;
uniform float GAMMA_INPUT;
uniform float gamma_out;
uniform float post_br;
uniform float post_br_affect_black_level;
uniform float no_scanlines;
uniform float iscans;
uniform float vga_mode;
uniform float hiscan;
uniform float SHARPEN_ON;
uniform float CSHARPEN;
uniform float CCONTR;
uniform float CDETAILS;
uniform float DEBLUR;
`;
uniform float HSM_AB_COMPARE_FREEZE_GRAPHICS;
uniform float HSM_AB_COMPARE_SHOW_MODE;
uniform float HSM_AB_COMPARE_SPLIT_POSITION;
uniform float HSM_AMBIENT_LIGHTING_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float HSM_AMBIENT1_HUE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_OPACITY;
uniform float HSM_AMBIENT1_POSITION_X;
uniform float HSM_AMBIENT1_POSITION_Y;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_SATURATION;
uniform float HSM_AMBIENT1_SCALE;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_VALUE;
uniform float HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_HUE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT2_POSITION_X;
uniform float HSM_AMBIENT2_POSITION_Y;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_SATURATION;
uniform float HSM_AMBIENT2_SCALE;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_VALUE;
uniform float HSM_ANTI_FLICKER_ON;
uniform float HSM_ANTI_FLICKER_THRESHOLD;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_BG_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BG_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_BG_BLEND_MODE;
uniform float HSM_BG_BRIGHTNESS;
uniform float HSM_BG_COLORIZE_ON;
uniform float HSM_BG_CUTOUT_MODE;
uniform float HSM_BG_DUALSCREEN_VIS_MODE;
uniform float HSM_BG_FILL_MODE;
uniform float HSM_BG_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_BG_FOLLOW_LAYER;
uniform float HSM_BG_FOLLOW_MODE;
uniform float HSM_BG_GAMMA;
uniform float HSM_BG_HUE;
uniform float HSM_BG_LAYER_ORDER;
uniform float HSM_BG_MASK_MODE;
uniform float HSM_BG_MIPMAPPING_BLEND_BIAS;
uniform float HSM_BG_OPACITY;
uniform float HSM_BG_POS_X;
uniform float HSM_BG_POS_Y;
uniform float HSM_BG_SATURATION;
uniform float HSM_BG_SCALE;
uniform float HSM_BG_SCALE_X;
uniform float HSM_BG_SOURCE_MATTE_TYPE;
uniform float HSM_BG_SPLIT_PRESERVE_CENTER;
uniform float HSM_BG_SPLIT_REPEAT_WIDTH;
uniform float HSM_BG_WRAP_MODE;
uniform float HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_BLEND_MODE;
uniform float HSM_BZL_BRIGHTNESS;
uniform float HSM_BZL_BRIGHTNESS_MULT_BOTTOM;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDES;
uniform float HSM_BZL_BRIGHTNESS_MULT_TOP;
uniform float HSM_BZL_COLOR_HUE;
uniform float HSM_BZL_COLOR_SATURATION;
uniform float HSM_BZL_COLOR_VALUE;
uniform float HSM_BZL_HEIGHT;
uniform float HSM_BZL_HIGHLIGHT;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS;
uniform float HSM_BZL_INDEPENDENT_SCALE;
uniform float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_EDGE_HIGHLIGHT;
uniform float HSM_BZL_INNER_EDGE_SHADOW;
uniform float HSM_BZL_INNER_EDGE_SHARPNESS;
uniform float HSM_BZL_INNER_EDGE_THICKNESS;
uniform float HSM_BZL_NOISE;
uniform float HSM_BZL_OPACITY;
uniform float HSM_BZL_OUTER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_OUTER_CURVATURE_SCALE;
uniform float HSM_BZL_OUTER_POSITION_Y;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_USE_INDEPENDENT_CURVATURE;
uniform float HSM_BZL_USE_INDEPENDENT_SCALE;
uniform float HSM_BZL_WIDTH;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_CROP_MODE;
uniform float HSM_CROP_PERCENT_BOTTOM;
uniform float HSM_CROP_PERCENT_LEFT;
uniform float HSM_CROP_PERCENT_RIGHT;
uniform float HSM_CROP_PERCENT_TOP;
uniform float HSM_CROP_PERCENT_ZOOM;
uniform float HSM_CRT_BLEND_AMOUNT;
uniform float HSM_CRT_BLEND_MODE;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float HSM_CURVATURE_3D_RADIUS;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float HSM_CURVATURE_3D_VIEW_DIST;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float HSM_DREZ_HSHARP0;
uniform float HSM_DREZ_SIGMA_HV;
uniform float HSM_DREZ_SHAR;
uniform float HSM_DREZ_THRESHOLD_RATIO;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float HSM_DUALSCREEN_MODE;
uniform float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_FAKE_SCANLINE_CURVATURE;
uniform float HSM_FAKE_SCANLINE_INT_SCALE;
uniform float HSM_FAKE_SCANLINE_MODE;
uniform float HSM_FAKE_SCANLINE_OPACITY;
uniform float HSM_FAKE_SCANLINE_RES;
uniform float HSM_FAKE_SCANLINE_RES_MODE;
uniform float HSM_FAKE_SCANLINE_ROLL;
uniform float HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_FLIP_CORE_VERTICAL;
uniform float HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float HSM_FLIP_VIEWPORT_VERTICAL;
uniform float HSM_FRM_BLEND_MODE;
uniform float HSM_FRM_COLOR_HUE;
uniform float HSM_FRM_COLOR_SATURATION;
uniform float HSM_FRM_COLOR_VALUE;
uniform float HSM_FRM_INNER_EDGE_HIGHLIGHT;
uniform float HSM_FRM_INNER_EDGE_THICKNESS;
uniform float HSM_FRM_NOISE;
uniform float HSM_FRM_OPACITY;
uniform float HSM_FRM_OUTER_CORNER_RADIUS;
uniform float HSM_FRM_OUTER_CURVATURE_SCALE;
uniform float HSM_FRM_OUTER_EDGE_SHADING;
uniform float HSM_FRM_OUTER_EDGE_THICKNESS;
uniform float HSM_FRM_OUTER_POS_Y;
uniform float HSM_FRM_SHADOW_OPACITY;
uniform float HSM_FRM_SHADOW_WIDTH;
uniform float HSM_FRM_TEXTURE_BLEND_MODE;
uniform float HSM_FRM_TEXTURE_OPACITY;
uniform float HSM_FRM_THICKNESS;
uniform float HSM_FRM_THICKNESS_SCALE_X;
uniform float HSM_FRM_USE_INDEPENDENT_COLOR;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float HSM_INTERLACE_EFFECT_SMOOTHNESS_INTERS;
uniform float HSM_INTERLACE_MODE;
uniform float HSM_INTERLACE_SCANLINE_EFFECT;
uniform float HSM_INTERLACE_TRIGGER_RES;
uniform float HSM_INTRO_LOGO_BLEND_MODE;
uniform float HSM_INTRO_LOGO_FADE_IN;
uniform float HSM_INTRO_LOGO_FADE_OUT;
uniform float HSM_INTRO_LOGO_FLIP_VERTICAL;
uniform float HSM_INTRO_LOGO_HEIGHT;
uniform float HSM_INTRO_LOGO_HOLD;
uniform float HSM_INTRO_LOGO_OVER_SOLID_COLOR;
uniform float HSM_INTRO_LOGO_PLACEMENT;
uniform float HSM_INTRO_LOGO_POS_X;
uniform float HSM_INTRO_LOGO_POS_Y;
uniform float HSM_INTRO_LOGO_WAIT;
uniform float HSM_INTRO_NOISE_BLEND_MODE;
uniform float HSM_INTRO_NOISE_FADE_OUT;
uniform float HSM_INTRO_NOISE_HOLD;
uniform float HSM_INTRO_SOLID_BLACK_FADE_OUT;
uniform float HSM_INTRO_SOLID_BLACK_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_BLEND_MODE;
uniform float HSM_INTRO_SOLID_COLOR_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_HUE;
uniform float HSM_INTRO_SOLID_COLOR_SAT;
uniform float HSM_INTRO_SOLID_COLOR_VALUE;
uniform float HSM_INTRO_SPEED;
uniform float HSM_INTRO_WHEN_TO_SHOW;
uniform float HSM_LAYERING_DEBUG_MASK_MODE;
uniform float HSM_LED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_LED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_LED_BLEND_MODE;
uniform float HSM_LED_BRIGHTNESS;
uniform float HSM_LED_COLORIZE_ON;
uniform float HSM_LED_CUTOUT_MODE;
uniform float HSM_LED_DUALSCREEN_VIS_MODE;
uniform float HSM_LED_FILL_MODE;
uniform float HSM_LED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_LED_FOLLOW_LAYER;
uniform float HSM_LED_FOLLOW_MODE;
uniform float HSM_LED_GAMMA;
uniform float HSM_LED_HUE;
uniform float HSM_LED_LAYER_ORDER;
uniform float HSM_LED_MASK_MODE;
uniform float HSM_LED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_LED_OPACITY;
uniform float HSM_LED_POS_X;
uniform float HSM_LED_POS_Y;
uniform float HSM_LED_SATURATION;
uniform float HSM_LED_SCALE;
uniform float HSM_LED_SCALE_X;
uniform float HSM_LED_SOURCE_MATTE_TYPE;
uniform float HSM_LED_SPLIT_PRESERVE_CENTER;
uniform float HSM_LED_SPLIT_REPEAT_WIDTH;
uniform float HSM_MONOCHROME_BRIGHTNESS;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_MONOCHROME_GAMMA;
uniform float HSM_MONOCHROME_HUE_OFFSET;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_SATURATION;
uniform float HSM_NON_INTEGER_SCALE;
uniform float HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_OVERSCAN_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_MODE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
uniform float HSM_OVERSCAN_RASTER_BLOOM_ON;
uniform float HSM_OVERSCAN_X;
uniform float HSM_OVERSCAN_Y;
uniform float HSM_PASS_VIEWER_EMPTY_LINE;
uniform float HSM_PASS_VIEWER_TITLE;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_POST_CRT_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
uniform float HSM_POTATO_SHOW_BG_OVER_SCREEN;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_BLUR_FALLOFF_DISTANCE;
uniform float HSM_REFLECT_BLUR_MAX;
uniform float HSM_REFLECT_BLUR_MIN;
uniform float HSM_REFLECT_BLUR_NUM_SAMPLES;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BLACK_LEVEL;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BRIGHTNESS;
uniform float HSM_REFLECT_CORNER_FADE;
uniform float HSM_REFLECT_CORNER_FADE_DISTANCE;
uniform float HSM_REFLECT_CORNER_INNER_SPREAD;
uniform float HSM_REFLECT_CORNER_OUTER_SPREAD;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP;
uniform float HSM_REFLECT_CORNER_SPREAD_FALLOFF;
uniform float HSM_REFLECT_DIFFUSED_AMOUNT;
uniform float HSM_REFLECT_DIRECT_AMOUNT;
uniform float HSM_REFLECT_FADE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_SHARPNESS;
uniform float HSM_REFLECT_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FULLSCREEN_GLOW_GAMMA;
uniform float HSM_REFLECT_GLOBAL_AMOUNT;
uniform float HSM_REFLECT_GLOBAL_GAMMA_ADJUST;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_DISTANCE;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_POSITION;
uniform float HSM_REFLECT_MASK_BLACK_LEVEL;
uniform float HSM_REFLECT_MASK_BRIGHTNESS;
uniform float HSM_REFLECT_MASK_FOLLOW_LAYER;
uniform float HSM_REFLECT_MASK_FOLLOW_MODE;
uniform float HSM_REFLECT_MASK_IMAGE_AMOUNT;
uniform float HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS;
uniform float HSM_REFLECT_NOISE_AMOUNT;
uniform float HSM_REFLECT_NOISE_SAMPLE_DISTANCE;
uniform float HSM_REFLECT_NOISE_SAMPLES;
uniform float HSM_REFLECT_RADIAL_FADE_HEIGHT;
uniform float HSM_REFLECT_RADIAL_FADE_WIDTH;
uniform float HSM_REFLECT_SHOW_TUBE_FX_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_SIZE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_EMPTY_LINE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_TITLE;
uniform float HSM_RENDER_SIMPLE_MASK_TYPE;
uniform float HSM_RENDER_SIMPLE_MODE;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_SCANLINE_DIRECTION;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_SCREEN_POSITION_X;
uniform float HSM_SCREEN_POSITION_Y;
uniform float HSM_SCREEN_REFLECTION_FOLLOW_DIFFUSE_THICKNESS;
uniform float HSM_SCREEN_REFLECTION_POS_X;
uniform float HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_SCREEN_REFLECTION_SCALE;
uniform float HSM_SCREEN_VIGNETTE_DUALSCREEN_VIS_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_SCREEN_VIGNETTE_ON;
uniform float HSM_SCREEN_VIGNETTE_POWER;
uniform float HSM_SCREEN_VIGNETTE_STRENGTH;
uniform float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_SHOW_PASS_ALPHA;
uniform float HSM_SHOW_PASS_APPLY_SCREEN_COORD;
uniform float HSM_SHOW_PASS_INDEX;
uniform float HSM_SIGNAL_NOISE_AMOUNT;
uniform float HSM_SIGNAL_NOISE_BLACK_LEVEL;
uniform float HSM_SIGNAL_NOISE_ON;
uniform float HSM_SIGNAL_NOISE_SIZE_MODE;
uniform float HSM_SIGNAL_NOISE_SIZE_MULT;
uniform float HSM_SIGNAL_NOISE_TYPE;
uniform float HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_TOP_BLEND_MODE;
uniform float HSM_TOP_BRIGHTNESS;
uniform float HSM_TOP_COLORIZE_ON;
uniform float HSM_TOP_CUTOUT_MODE;
uniform float HSM_TOP_DUALSCREEN_VIS_MODE;
uniform float HSM_TOP_FILL_MODE;
uniform float HSM_TOP_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_TOP_FOLLOW_LAYER;
uniform float HSM_TOP_FOLLOW_MODE;
uniform float HSM_TOP_GAMMA;
uniform float HSM_TOP_HUE;
uniform float HSM_TOP_LAYER_ORDER;
uniform float HSM_TOP_MASK_MODE;
uniform float HSM_TOP_MIPMAPPING_BLEND_BIAS;
uniform float HSM_TOP_OPACITY;
uniform float HSM_TOP_POS_X;
uniform float HSM_TOP_POS_Y;
uniform float HSM_TOP_SATURATION;
uniform float HSM_TOP_SCALE;
uniform float HSM_TOP_SCALE_X;
uniform float HSM_TOP_SOURCE_MATTE_TYPE;
uniform float HSM_TOP_SPLIT_PRESERVE_CENTER;
uniform float HSM_TOP_SPLIT_REPEAT_WIDTH;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_LINE;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_TITLE;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_SHARPNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_OPACITY;
uniform float HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float HSM_TUBE_STATIC_DITHER_AMOUNT;
uniform float HSM_TUBE_STATIC_DITHER_DISTANCE;
uniform float HSM_TUBE_STATIC_DITHER_SAMPLES;
uniform float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float HSM_TUBE_STATIC_POS_X;
uniform float HSM_TUBE_STATIC_POS_Y;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float HSM_TUBE_STATIC_SCALE;
uniform float HSM_TUBE_STATIC_SCALE_X;
uniform float HSM_TUBE_STATIC_SHADOW_OPACITY;
uniform float HSM_USE_GEOM;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float HSM_VERTICAL_PRESET;
uniform float HSM_VIEWPORT_POSITION_X;
uniform float HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER;
uniform float HSM_VIEWPORT_VIGNETTE_LAYER_ORDER;
uniform float HSM_VIEWPORT_VIGNETTE_MASK_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_OPACITY;
uniform float HSM_VIEWPORT_VIGNETTE_POS_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_Y;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE_X;
uniform float HSM_VIEWPORT_ZOOM;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float HSM_2ND_SCREEN_POS_X;
uniform float HSM_2ND_SCREEN_POS_Y;
uniform float HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float SCREEN_ASPECT;
uniform vec2 SCREEN_COORD;
uniform float DEFAULT_SRGB_GAMMA;
uniform float GAMMA_INPUT;
uniform float gamma_out;
uniform float post_br;
uniform float post_br_affect_black_level;
uniform float no_scanlines;
uniform float iscans;
uniform float vga_mode;
uniform float hiscan;
uniform float SHARPEN_ON;
uniform float CSHARPEN;
uniform float CCONTR;
uniform float CDETAILS;
uniform float DEBLUR;
`;
// Mega Bezel parameters - injected as mutable variables, not uniforms
// Most HSM parameters need to be assignable variables, not read-only uniforms
float HSM_AB_COMPARE_AREA = 0.0;
uniform float HSM_AB_COMPARE_FREEZE_CRT_TUBE;
uniform float HSM_AB_COMPARE_FREEZE_GRAPHICS;
uniform float HSM_AB_COMPARE_SHOW_MODE;
uniform float HSM_AB_COMPARE_SPLIT_POSITION;
uniform float HSM_AMBIENT_LIGHTING_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float HSM_AMBIENT1_HUE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_OPACITY;
uniform float HSM_AMBIENT1_POSITION_X;
uniform float HSM_AMBIENT1_POSITION_Y;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_SATURATION;
uniform float HSM_AMBIENT1_SCALE;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_VALUE;
uniform float HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_HUE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT2_POSITION_X;
uniform float HSM_AMBIENT2_POSITION_Y;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_SATURATION;
uniform float HSM_AMBIENT2_SCALE;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_VALUE;
uniform float HSM_ANTI_FLICKER_ON;
uniform float HSM_ANTI_FLICKER_THRESHOLD;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_BG_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BG_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_BG_BLEND_MODE;
uniform float HSM_BG_BRIGHTNESS;
uniform float HSM_BG_COLORIZE_ON;
uniform float HSM_BG_CUTOUT_MODE;
uniform float HSM_BG_DUALSCREEN_VIS_MODE;
uniform float HSM_BG_FILL_MODE;
uniform float HSM_BG_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_BG_FOLLOW_LAYER;
uniform float HSM_BG_FOLLOW_MODE;
uniform float HSM_BG_GAMMA;
uniform float HSM_BG_HUE;
uniform float HSM_BG_LAYER_ORDER;
uniform float HSM_BG_MASK_MODE;
uniform float HSM_BG_MIPMAPPING_BLEND_BIAS;
uniform float HSM_BG_OPACITY;
uniform float HSM_BG_POS_X;
uniform float HSM_BG_POS_Y;
uniform float HSM_BG_SATURATION;
uniform float HSM_BG_SCALE;
uniform float HSM_BG_SCALE_X;
uniform float HSM_BG_SOURCE_MATTE_TYPE;
uniform float HSM_BG_SPLIT_PRESERVE_CENTER;
uniform float HSM_BG_SPLIT_REPEAT_WIDTH;
uniform float HSM_BG_WRAP_MODE;
uniform float HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_BLEND_MODE;
uniform float HSM_BZL_BRIGHTNESS;
uniform float HSM_BZL_BRIGHTNESS_MULT_BOTTOM;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDES;
uniform float HSM_BZL_BRIGHTNESS_MULT_TOP;
uniform float HSM_BZL_COLOR_HUE;
uniform float HSM_BZL_COLOR_SATURATION;
uniform float HSM_BZL_COLOR_VALUE;
uniform float HSM_BZL_HEIGHT;
uniform float HSM_BZL_HIGHLIGHT;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS;
uniform float HSM_BZL_INDEPENDENT_SCALE;
uniform float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_EDGE_HIGHLIGHT;
uniform float HSM_BZL_INNER_EDGE_SHADOW;
uniform float HSM_BZL_INNER_EDGE_SHARPNESS;
uniform float HSM_BZL_INNER_EDGE_THICKNESS;
uniform float HSM_BZL_NOISE;
uniform float HSM_BZL_OPACITY;
uniform float HSM_BZL_OUTER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_OUTER_CURVATURE_SCALE;
uniform float HSM_BZL_OUTER_POSITION_Y;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_USE_INDEPENDENT_CURVATURE;
uniform float HSM_BZL_USE_INDEPENDENT_SCALE;
uniform float HSM_BZL_WIDTH;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_CROP_MODE;
uniform float HSM_CROP_PERCENT_BOTTOM;
uniform float HSM_CROP_PERCENT_LEFT;
uniform float HSM_CROP_PERCENT_RIGHT;
uniform float HSM_CROP_PERCENT_TOP;
uniform float HSM_CROP_PERCENT_ZOOM;
uniform float HSM_CRT_BLEND_AMOUNT;
uniform float HSM_CRT_BLEND_MODE;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float HSM_CURVATURE_3D_RADIUS;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float HSM_CURVATURE_3D_VIEW_DIST;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float HSM_DREZ_HSHARP0;
uniform float HSM_DREZ_SIGMA_HV;
uniform float HSM_DREZ_SHAR;
uniform float HSM_DREZ_THRESHOLD_RATIO;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float HSM_DUALSCREEN_MODE;
uniform float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_FAKE_SCANLINE_CURVATURE;
uniform float HSM_FAKE_SCANLINE_INT_SCALE;
uniform float HSM_FAKE_SCANLINE_MODE;
uniform float HSM_FAKE_SCANLINE_OPACITY;
uniform float HSM_FAKE_SCANLINE_RES;
uniform float HSM_FAKE_SCANLINE_RES_MODE;
uniform float HSM_FAKE_SCANLINE_ROLL;
uniform float HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_FLIP_CORE_VERTICAL;
uniform float HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float HSM_FLIP_VIEWPORT_VERTICAL;
uniform float HSM_FRM_BLEND_MODE;
uniform float HSM_FRM_COLOR_HUE;
uniform float HSM_FRM_COLOR_SATURATION;
uniform float HSM_FRM_COLOR_VALUE;
uniform float HSM_FRM_INNER_EDGE_HIGHLIGHT;
uniform float HSM_FRM_INNER_EDGE_THICKNESS;
uniform float HSM_FRM_NOISE;
uniform float HSM_FRM_OPACITY;
uniform float HSM_FRM_OUTER_CORNER_RADIUS;
uniform float HSM_FRM_OUTER_CURVATURE_SCALE;
uniform float HSM_FRM_OUTER_EDGE_SHADING;
uniform float HSM_FRM_OUTER_EDGE_THICKNESS;
uniform float HSM_FRM_OUTER_POS_Y;
uniform float HSM_FRM_SHADOW_OPACITY;
uniform float HSM_FRM_SHADOW_WIDTH;
uniform float HSM_FRM_TEXTURE_BLEND_MODE;
uniform float HSM_FRM_TEXTURE_OPACITY;
uniform float HSM_FRM_THICKNESS;
uniform float HSM_FRM_THICKNESS_SCALE_X;
uniform float HSM_FRM_USE_INDEPENDENT_COLOR;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float HSM_INTERLACE_EFFECT_SMOOTHNESS_INTERS;
uniform float HSM_INTERLACE_MODE;
uniform float HSM_INTERLACE_SCANLINE_EFFECT;
uniform float HSM_INTERLACE_TRIGGER_RES;
uniform float HSM_INTRO_LOGO_BLEND_MODE;
uniform float HSM_INTRO_LOGO_FADE_IN;
uniform float HSM_INTRO_LOGO_FADE_OUT;
uniform float HSM_INTRO_LOGO_FLIP_VERTICAL;
uniform float HSM_INTRO_LOGO_HEIGHT;
uniform float HSM_INTRO_LOGO_HOLD;
uniform float HSM_INTRO_LOGO_OVER_SOLID_COLOR;
uniform float HSM_INTRO_LOGO_PLACEMENT;
uniform float HSM_INTRO_LOGO_POS_X;
uniform float HSM_INTRO_LOGO_POS_Y;
uniform float HSM_INTRO_LOGO_WAIT;
uniform float HSM_INTRO_NOISE_BLEND_MODE;
uniform float HSM_INTRO_NOISE_FADE_OUT;
uniform float HSM_INTRO_NOISE_HOLD;
uniform float HSM_INTRO_SOLID_BLACK_FADE_OUT;
uniform float HSM_INTRO_SOLID_BLACK_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_BLEND_MODE;
uniform float HSM_INTRO_SOLID_COLOR_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_HUE;
uniform float HSM_INTRO_SOLID_COLOR_SAT;
uniform float HSM_INTRO_SOLID_COLOR_VALUE;
uniform float HSM_INTRO_SPEED;
uniform float HSM_INTRO_WHEN_TO_SHOW;
uniform float HSM_LAYERING_DEBUG_MASK_MODE;
uniform float HSM_LED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_LED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_LED_BLEND_MODE;
uniform float HSM_LED_BRIGHTNESS;
uniform float HSM_LED_COLORIZE_ON;
uniform float HSM_LED_CUTOUT_MODE;
uniform float HSM_LED_DUALSCREEN_VIS_MODE;
uniform float HSM_LED_FILL_MODE;
uniform float HSM_LED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_LED_FOLLOW_LAYER;
uniform float HSM_LED_FOLLOW_MODE;
uniform float HSM_LED_GAMMA;
uniform float HSM_LED_HUE;
uniform float HSM_LED_LAYER_ORDER;
uniform float HSM_LED_MASK_MODE;
uniform float HSM_LED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_LED_OPACITY;
uniform float HSM_LED_POS_X;
uniform float HSM_LED_POS_Y;
uniform float HSM_LED_SATURATION;
uniform float HSM_LED_SCALE;
uniform float HSM_LED_SCALE_X;
uniform float HSM_LED_SOURCE_MATTE_TYPE;
uniform float HSM_LED_SPLIT_PRESERVE_CENTER;
uniform float HSM_LED_SPLIT_REPEAT_WIDTH;
uniform float HSM_MONOCHROME_BRIGHTNESS;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_MONOCHROME_GAMMA;
uniform float HSM_MONOCHROME_HUE_OFFSET;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_SATURATION;
uniform float HSM_NON_INTEGER_SCALE;
uniform float HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_OVERSCAN_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_MODE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
uniform float HSM_OVERSCAN_RASTER_BLOOM_ON;
uniform float HSM_OVERSCAN_X;
uniform float HSM_OVERSCAN_Y;
uniform float HSM_PASS_VIEWER_EMPTY_LINE;
uniform float HSM_PASS_VIEWER_TITLE;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_SIM_TUBE_DIAGONAL_SIZE;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_POST_CRT_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
uniform float HSM_POTATO_SHOW_BG_OVER_SCREEN;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_BLUR_FALLOFF_DISTANCE;
uniform float HSM_REFLECT_BLUR_MAX;
uniform float HSM_REFLECT_BLUR_MIN;
uniform float HSM_REFLECT_BLUR_NUM_SAMPLES;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BLACK_LEVEL;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BRIGHTNESS;
uniform float HSM_REFLECT_CORNER_FADE;
uniform float HSM_REFLECT_CORNER_FADE_DISTANCE;
uniform float HSM_REFLECT_CORNER_INNER_SPREAD;
uniform float HSM_REFLECT_CORNER_OUTER_SPREAD;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP;
uniform float HSM_REFLECT_CORNER_SPREAD_FALLOFF;
uniform float HSM_REFLECT_DIFFUSED_AMOUNT;
uniform float HSM_REFLECT_DIRECT_AMOUNT;
uniform float HSM_REFLECT_FADE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_SHARPNESS;
uniform float HSM_REFLECT_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FULLSCREEN_GLOW_GAMMA;
uniform float HSM_REFLECT_GLOBAL_AMOUNT;
uniform float HSM_REFLECT_GLOBAL_GAMMA_ADJUST;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_DISTANCE;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_POSITION;
uniform float HSM_REFLECT_MASK_BLACK_LEVEL;
uniform float HSM_REFLECT_MASK_BRIGHTNESS;
uniform float HSM_REFLECT_MASK_FOLLOW_LAYER;
uniform float HSM_REFLECT_MASK_FOLLOW_MODE;
uniform float HSM_REFLECT_MASK_IMAGE_AMOUNT;
uniform float HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS;
uniform float HSM_REFLECT_NOISE_AMOUNT;
uniform float HSM_REFLECT_NOISE_SAMPLE_DISTANCE;
uniform float HSM_REFLECT_NOISE_SAMPLES;
uniform float HSM_REFLECT_RADIAL_FADE_HEIGHT;
uniform float HSM_REFLECT_RADIAL_FADE_WIDTH;
uniform float HSM_REFLECT_SHOW_TUBE_FX_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_SIZE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_EMPTY_LINE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_TITLE;
uniform float HSM_RENDER_SIMPLE_MASK_TYPE;
uniform float HSM_RENDER_SIMPLE_MODE;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_SCANLINE_DIRECTION;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_SCREEN_POSITION_X;
uniform float HSM_SCREEN_POSITION_Y;
uniform float HSM_SCREEN_REFLECTION_FOLLOW_DIFFUSE_THICKNESS;
uniform float HSM_SCREEN_REFLECTION_POS_X;
uniform float HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_SCREEN_REFLECTION_SCALE;
uniform float HSM_SCREEN_VIGNETTE_DUALSCREEN_VIS_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_SCREEN_VIGNETTE_ON;
uniform float HSM_SCREEN_VIGNETTE_POWER;
uniform float HSM_SCREEN_VIGNETTE_STRENGTH;
uniform float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_SHOW_PASS_ALPHA;
uniform float HSM_SHOW_PASS_APPLY_SCREEN_COORD;
uniform float HSM_SHOW_PASS_INDEX;
uniform float HSM_SIGNAL_NOISE_AMOUNT;
uniform float HSM_SIGNAL_NOISE_BLACK_LEVEL;
uniform float HSM_SIGNAL_NOISE_ON;
uniform float HSM_SIGNAL_NOISE_SIZE_MODE;
uniform float HSM_SIGNAL_NOISE_SIZE_MULT;
uniform float HSM_SIGNAL_NOISE_TYPE;
uniform float HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_TOP_BLEND_MODE;
uniform float HSM_TOP_BRIGHTNESS;
uniform float HSM_TOP_COLORIZE_ON;
uniform float HSM_TOP_CUTOUT_MODE;
uniform float HSM_TOP_DUALSCREEN_VIS_MODE;
uniform float HSM_TOP_FILL_MODE;
uniform float HSM_TOP_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_TOP_FOLLOW_LAYER;
uniform float HSM_TOP_FOLLOW_MODE;
uniform float HSM_TOP_GAMMA;
uniform float HSM_TOP_HUE;
uniform float HSM_TOP_LAYER_ORDER;
uniform float HSM_TOP_MASK_MODE;
uniform float HSM_TOP_MIPMAPPING_BLEND_BIAS;
uniform float HSM_TOP_OPACITY;
uniform float HSM_TOP_POS_X;
uniform float HSM_TOP_POS_Y;
uniform float HSM_TOP_SATURATION;
uniform float HSM_TOP_SCALE;
uniform float HSM_TOP_SCALE_X;
uniform float HSM_TOP_SOURCE_MATTE_TYPE;
uniform float HSM_TOP_SPLIT_PRESERVE_CENTER;
uniform float HSM_TOP_SPLIT_REPEAT_WIDTH;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_LINE;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_TITLE;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_SHARPNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_OPACITY;
uniform float HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float HSM_TUBE_STATIC_DITHER_AMOUNT;
uniform float HSM_TUBE_STATIC_DITHER_DISTANCE;
uniform float HSM_TUBE_STATIC_DITHER_SAMPLES;
uniform float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float HSM_TUBE_STATIC_POS_X;
uniform float HSM_TUBE_STATIC_POS_Y;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float HSM_TUBE_STATIC_SCALE;
uniform float HSM_TUBE_STATIC_SCALE_X;
uniform float HSM_TUBE_STATIC_SHADOW_OPACITY;
uniform float HSM_USE_GEOM;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float HSM_VERTICAL_PRESET;
uniform float HSM_VIEWPORT_POSITION_X;
uniform float HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER;
uniform float HSM_VIEWPORT_VIGNETTE_LAYER_ORDER;
uniform float HSM_VIEWPORT_VIGNETTE_MASK_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_OPACITY;
uniform float HSM_VIEWPORT_VIGNETTE_POS_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_Y;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE_X;
uniform float HSM_VIEWPORT_ZOOM;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float HSM_2ND_SCREEN_POS_X;
uniform float HSM_2ND_SCREEN_POS_Y;
uniform float HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float SCREEN_ASPECT;
uniform vec2 SCREEN_COORD;
uniform float DEFAULT_SRGB_GAMMA;
uniform float GAMMA_INPUT;
uniform float gamma_out;
uniform float post_br;
uniform float post_br_affect_black_level;
uniform float no_scanlines;
uniform float iscans;
uniform float vga_mode;
uniform float hiscan;
uniform float SHARPEN_ON;
uniform float CSHARPEN;
uniform float CCONTR;
uniform float CDETAILS;
uniform float DEBLUR;
`;

      const retroarchVariables = `
// Shader parameter uniforms
${paramUniforms}
${megaBezelVariables}
`;

      // Insert after precision declarations
      const precisionEnd = output.search(/precision.*?;\s*\n\s*precision.*?;\s*\n|precision.*?;\s*\n/);
      if (precisionEnd !== -1) {
        const afterPrecision = output.substring(precisionEnd).match(/precision.*?;\s*\n/);
        if (afterPrecision) {
          const insertPos = precisionEnd + afterPrecision[0].length;
          output = output.substring(0, insertPos) + retroarchVariables + output.substring(insertPos);
        }
      }
    }

    // Convert Slang-specific syntax
    // Convert swizzle shorthand: 0.0.xxx → vec3(0.0), DEBLUR.xxx → vec3(DEBLUR)
    // Handle both literals and variables
    output = output.replace(/(\d+\.\d+)\.xxx\b/g, 'vec3($1)');
    output = output.replace(/(\d+\.\d+)\.xxxx\b/g, 'vec4($1)');
    output = output.replace(/(\d+\.\d+)\.xx\b/g, 'vec2($1)');
    output = output.replace(/(\d+)\.xxx\b/g, 'vec3($1.0)');
    output = output.replace(/(\d+)\.xxxx\b/g, 'vec4($1.0)');
    output = output.replace(/(\d+)\.xx\b/g, 'vec2($1.0)');

    // Handle variable.xxx swizzles (e.g., DEBLUR.xxx → vec3(DEBLUR))
    output = output.replace(/\b([a-zA-Z_]\w*)\.xxx\b/g, 'vec3($1)');
    output = output.replace(/\b([a-zA-Z_]\w*)\.xxxx\b/g, 'vec4($1)');
    output = output.replace(/\b([a-zA-Z_]\w*)\.xx\b/g, 'vec2($1)');

    // Fix global variable initialization with uniforms
    // GLSL doesn't allow global variables to be initialized with non-constant expressions
    // Convert: float invsqrsigma = 1.0/(2.0*PARAM*PARAM);
    // To: float invsqrsigma; void initGlobals() { invsqrsigma = ...; }
    output = this.convertGlobalInitializers(output);

    // Remove layout qualifiers and convert to uniforms FIRST
    // This ensures int uniforms are in their final form before int/float conversion
    output = this.convertBindingsToUniforms(output, bindings, webgl2);

    // Convert int literals in comparisons to float literals for GLSL compatibility
    // uniform float X; if (X == 0) -> if (X == 0.0)
    // Pass bindings to extract int UBO member information
    output = this.convertIntLiteralsInComparisons(output, bindings);

    // Convert global uniform block references (e.g., global.MVP -> MVP)
    // Mega Bezel and other shaders use a 'global' UBO that gets converted to individual uniforms
    output = output.replace(/\bglobal\.(\w+)\b/g, '$1');

    // Strip initParams() calls (we don't use ParamsStruct anymore, uniforms are direct)
    // Match initParams() anywhere it appears, with optional semicolon
    output = output.replace(/\binitParams\s*\(\s*\)\s*;?/g, '/* initParams() removed */');

    // Convert Three.js standard attribute names (vertex stage only)
    if (stage === 'vertex') {
      // Remove attribute declarations - Three.js ShaderMaterial provides these automatically
      output = output.replace(/\bin\s+vec4\s+Position\s*;/g, '// Position provided by Three.js');
      output = output.replace(/\bin\s+vec2\s+TexCoord\s*;/g, '// uv provided by Three.js');

      // Convert Slang vertex shader to Three.js format
      // Replace 'MVP * Position' with proper transformation using Three.js attributes
      output = output.replace(/\bglobal\.MVP\s*\*\s*Position\b/g, 'MVP * vec4(position, 1.0)');
      output = output.replace(/\bMVP\s*\*\s*Position\b/g, 'MVP * vec4(position, 1.0)');
      // Convert TexCoord to Three.js uv attribute
      output = output.replace(/\bTexCoord\b/g, 'uv');
    }

    // Convert varying/in/out keywords
    if (webgl2) {
      if (stage === 'vertex') {
        output = output.replace(/\battribute\b/g, 'in');
        output = output.replace(/\bvarying\b/g, 'out');
      } else {
        output = output.replace(/\bvarying\b/g, 'in');
      }

      // Three.js ShaderMaterial handles gl_FragColor automatically for WebGL 2
      // Convert any custom fragment outputs back to gl_FragColor
      if (stage === 'fragment') {
        // Remove any 'layout(...) out vec4 FragColor;' declarations (may span multiple lines)
        // Use [\s\S] to match any character including newlines
        output = output.replace(/layout\s*\([^)]*\)\s*out\s+vec4\s+FragColor\s*;/gs, '');
        // Also remove plain 'out vec4 FragColor;' if no layout
        output = output.replace(/out\s+vec4\s+FragColor\s*;/g, '');
        // Convert FragColor assignments to gl_FragColor (Three.js will handle the rest)
        output = output.replace(/\bFragColor\b/g, 'gl_FragColor');
      }
    } else {
      // WebGL 1.0: keep varying, attribute, gl_FragColor
      output = output.replace(/\bin\s+vec/g, 'varying vec'); // in → varying (fragment)
      output = output.replace(/\bout\s+vec/g, 'varying vec'); // out → varying (vertex)
    }

    // Fix ternary operator type mismatches
    // Convert: condition ? vec3(...) : 0.0 → condition ? vec3(...) : vec3(0.0)
    // Convert: condition ? 0.0 : vec3(...) → condition ? vec3(0.0) : vec3(...)
    output = this.fixTernaryOperatorTypes(output);

    // Convert texture functions
    if (webgl2) {
      // texture() is native in WebGL 2
    } else {
      // Convert texture() to texture2D()
      output = output.replace(/\btexture\s*\(/g, 'texture2D(');
      output = output.replace(/\btextureLod\s*\(/g, 'texture2D('); // Fallback
    }

    // Remove Vulkan-specific layout bindings
    // Three.js manages fragment outputs automatically, so remove layout from all in/out
    if (webgl2 && stage === 'fragment') {
      // Remove layout from 'in' declarations (varyings from vertex shader)
      output = output.replace(/layout\s*\([^)]*\)\s+in\s+/g, 'in ');
      // Remove layout from 'out' declarations - Three.js manages outputs
      output = output.replace(/layout\s*\([^)]*\)\s+out\s+/g, 'out ');
      // Remove other layout types (set, binding, push_constant)
      output = output.replace(/layout\s*\(\s*set\s*=\s*[^)]*\)\s*/g, '');
      output = output.replace(/layout\s*\(\s*push_constant\s*\)\s*/g, '');

      // NOTE: We no longer inject initParams() - using direct uniforms instead of ParamsStruct
    } else {
      // Remove all layout declarations for other stages or WebGL 1.0
      output = output.replace(/layout\s*\([^)]*\)\s*/g, '');
    }

    // DEBUG: Log final compiled shader
    console.log(`[SlangCompiler] Final compiled ${stage} shader (first 3000 chars):`);
    console.log(output.substring(0, 3000));
    console.log('[SlangCompiler] ... (truncated, check for initParams and duplicate uniforms above)');

    // Debug: Check if hrg functions are in output
    if (output.includes('hrg_get_ideal_global_eye_pos_for_points')) {
      const funcDefMatch = output.match(/vec3 hrg_get_ideal_global_eye_pos_for_points\s*\([^)]*\)/);
      if (funcDefMatch) {
        console.log(`[SlangCompiler] Found hrg_get_ideal_global_eye_pos_for_points definition: ${funcDefMatch[0].substring(0, 150)}`);
      } else {
        console.log(`[SlangCompiler] WARNING: hrg_get_ideal_global_eye_pos_for_points is in output but no function definition found!`);
      }

      // Check for HRG_MAX_POINT_CLOUD_SIZE define
      if (output.includes('HRG_MAX_POINT_CLOUD_SIZE')) {
        const hrgDefineMatch = output.match(/#define\s+HRG_MAX_POINT_CLOUD_SIZE\s+\d+/);
        console.log(`[SlangCompiler] HRG_MAX_POINT_CLOUD_SIZE is in final output:`, hrgDefineMatch ? hrgDefineMatch[0] : 'FOUND BUT NO MATCH');
      } else {
        console.log(`[SlangCompiler] ERROR: HRG_MAX_POINT_CLOUD_SIZE NOT in final output!`);
      }

      // Check for the function call
      const lines = output.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('hrg_get_ideal_global_eye_pos_for_points(')) {
          console.log(`[SlangCompiler] Found function call at line ${i + 1}: ${lines[i].trim().substring(0, 100)}`);
          if (i > 0) console.log(`[SlangCompiler]   Previous line ${i}: ${lines[i-1].trim()}`);
          break;
        }
      }
    }

    return output;
  }

  /**
   * Convert global variable initializers that use uniforms to function-based initialization
   */
  private static convertGlobalInitializers(source: string): string {
    // Find global variable declarations with initializers that might use uniforms
    // Pattern: float varname = expression;
    // at global scope (not inside functions)

    const globalInitPattern = /^(float|int|vec\d|mat\d)\s+(\w+)\s*=\s*([^;]+);/gm;
    const globalInits: Array<{ declaration: string; type: string; name: string; init: string }> = [];
    let match;

    while ((match = globalInitPattern.exec(source)) !== null) {
      const fullMatch = match[0];
      const type = match[1];
      const varName = match[2];
      const initExpr = match[3];

      // Check if initialization uses uppercase identifiers (likely uniforms/parameters)
      if (/[A-Z_]{3,}/.test(initExpr)) {
        globalInits.push({
          declaration: fullMatch,
          type,
          name: varName,
          init: initExpr
        });
      }
    }

    if (globalInits.length === 0) {
      return source;
    }

    // Replace global initializations with declarations only
    let output = source;
    for (const globalInit of globalInits) {
      output = output.replace(globalInit.declaration, `${globalInit.type} ${globalInit.name};`);
    }

    // Create initialization function
    const initFunction = `
// Global variable initialization (moved from global scope)
void initGlobalVars() {
${globalInits.map(g => `  ${g.name} = ${g.init};`).join('\n')}
}
`;

    // Insert before main()
    output = output.replace(/void\s+main\s*\(\s*\)\s*{/, initFunction + '\nvoid main() {\n  initGlobalVars();');

    return output;
  }

  /**
   * Convert int literals in comparisons to float literals
   */
  private static convertIntLiteralsInComparisons(source: string, bindings: SlangUniformBinding[] = []): string {
    console.log('[convertIntLiteralsInComparisons] START - bindings:', bindings.length);
    let output = source;

    // Extract all int/uint uniform names from BOTH bindings AND source
    const intUniforms = new Set<string>();

    // First, extract from UBO bindings (they're NOW converted to uniforms before this runs)
    for (const binding of bindings) {
      if (binding.members) {
        for (const member of binding.members) {
          if (member.type === 'int' || member.type === 'uint') {
            intUniforms.add(member.name);
            console.log(`[convertIntsToFloats] Found int/uint UBO member: ${member.name}`);
          }
        }
      }
    }

    // Then extract from source (in case there are direct uniform declarations)
    const intUniformPattern = /uniform\s+(int|uint)\s+(\w+)\s*;/g;
    let match;
    while ((match = intUniformPattern.exec(source)) !== null) {
      intUniforms.add(match[2]);
      console.log(`[convertIntsToFloats] Found int/uint uniform in source: ${match[2]}`);
    }

    console.log(`[convertIntsToFloats] Total int/uint uniforms found: ${intUniforms.size}`, Array.from(intUniforms).slice(0, 20).join(', '));

    // Lookbehind/lookahead explanation:
    // (?<![.\deE\w]) - Not after period, digit, e/E, or word char (prevents matching in floats/identifiers/scientific notation)
    // (?![.\deE\w]) - Not before period, digit, e/E, or word char (prevents matching start of floats/identifiers)

    // Convert comparisons: EXPRESSION == INT, EXPRESSION != INT, etc.
    // Wrap int uniforms with float() to avoid type mismatch
    output = output.replace(/([\w.\[\]()]+)\s*(==|!=|>|<|>=|<=)\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])/g, (match, expr, op, num) => {
      // Check if expr is an int uniform - if so, wrap with float()
      const exprName = expr.match(/\b(\w+)\b/)?.[1];
      if (exprName && intUniforms.has(exprName)) {
        return `float(${expr}) ${op} ${num}.0`;
      }
      // Always convert to float to avoid int/float mismatches
      return `${expr} ${op} ${num}.0`;
    });

    // Reverse order: INT == EXPRESSION, INT != EXPRESSION
    output = output.replace(/(?<![.\deE\w])(-?\d+)(?![.\deE\w])\s*(==|!=)\s*([\w.\[\]()]+)/g, (match, num, op, expr) => {
      // Check if expr is an int uniform - if so, wrap with float()
      const exprName = expr.match(/\b(\w+)\b/)?.[1];
      if (exprName && intUniforms.has(exprName)) {
        return `${num}.0 ${op} float(${expr})`;
      }
      return `${num}.0 ${op} ${expr}`;
    });

    // Ternary operator: convert int literals in ternary expressions
    // Pattern: condition ? INT : value or condition ? value : INT
    output = output.replace(/\?\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])\s*:/g, (match, num) => {
      return `? ${num}.0 :`;
    });
    output = output.replace(/:\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[;,)])/g, (match, num) => {
      return `: ${num}.0`;
    });

    // Convert arithmetic operations: EXPRESSION op INT -> EXPRESSION op INT.0
    // Match any expression (identifiers, member access, array access, etc.) followed by operator and int
    // Use broad pattern to capture complex expressions: anything before operator that's not whitespace/punctuation
    output = output.replace(/([\w.\[\]()]+)\s*([-+*\/])\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])/g, (match, expr, op, num, offset, string) => {
      // Don't convert if this is scientific notation (e.g., "1.0e-10" where expr is "1.0e")
      // Check if expr matches the pattern of a number followed by 'e' or 'E'
      if ((expr.endsWith('e') || expr.endsWith('E')) && /\d+\.?\d*[eE]$/.test(expr)) {
        // This is scientific notation like "1.0e" or "1e", keep unchanged
        return match;
      }
      return `${expr} ${op} ${num}.0`;
    });

    // Reverse: INT op EXPRESSION -> INT.0 op EXPRESSION
    output = output.replace(/(?<![.\deE\w])(-?\d+)(?![.\deE\w])\s*([-+*\/])\s*([\w.\[\]()]+)/g, (match, num, op, expr, offset, string) => {
      // Don't convert if this is scientific notation like "1e-10"
      if ((op === '+' || op === '-') && (expr.startsWith('e') || expr.startsWith('E'))) {
        // Check if the number before this match could be part of scientific notation
        const beforeMatch = string.substring(Math.max(0, offset - 10), offset);
        if (/\d+\.?\d*$/.test(beforeMatch)) {
          return match; // This is scientific notation, keep unchanged
        }
      }
      return `${num}.0 ${op} ${expr}`;
    });

    // Define functions that MUST have int arguments (whitelist of int-only functions)
    const intArgFunctions = new Set([
      'textureSize', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4',
      'texelFetch', 'texelFetchOffset', 'int', 'uint'
    ]);

    // Convert ALL function arguments from int to float EXCEPT for int-argument functions
    // This handles both built-in GLSL functions and user-defined functions
    // Pattern: function_name(INT or function_name(..., INT, ...)

    // Convert first argument
    output = output.replace(/(\w+)\s*\(\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[,)])/g, (match, funcName, num) => {
      if (intArgFunctions.has(funcName)) {
        return match; // Keep int for int-argument functions
      }
      // Default: convert to float (handles both built-in and user-defined functions)
      return `${funcName}(${num}.0`;
    });

    // Convert subsequent arguments (after commas)
    // Use a more general approach: convert ALL int literals after commas in function calls
    // EXCEPT when inside known int-argument functions

    // First, protect int-argument functions by temporarily marking their arguments
    const intFuncPattern = new RegExp(`\\b(${Array.from(intArgFunctions).join('|')})\\s*\\(([^()]*)\\)`, 'g');
    const protectedRegions: Array<{start: number, end: number}> = [];

    let intMatch;
    while ((intMatch = intFuncPattern.exec(output)) !== null) {
      protectedRegions.push({
        start: intMatch.index,
        end: intMatch.index + intMatch[0].length
      });
    }

    // Now convert int literals after commas, skipping protected regions
    const commaIntPattern = /,\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[,)])/g;
    let converted = '';
    let lastIndex = 0;

    let commaMatch;
    while ((commaMatch = commaIntPattern.exec(output)) !== null) {
      // Check if this match is inside a protected region
      const isProtected = protectedRegions.some(region =>
        commaMatch.index >= region.start && commaMatch.index < region.end
      );

      if (!isProtected) {
        converted += output.substring(lastIndex, commaMatch.index);
        converted += `, ${commaMatch[1]}.0`;
        lastIndex = commaMatch.index + commaMatch[0].length;
      }
    }
    converted += output.substring(lastIndex);
    output = converted;

    // Convert assignments to float variables: float x = INT; -> float x = INT.0;
    output = output.replace(/\bfloat\s+\w+\s*=\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(\s*[;,)])/g, (match, num, suffix) => {
      return match.replace(/=\s*(-?\d+)(\s*[;,)])/, `= $1.0$2`);
    });

    // Convert assignments to vec2/vec3/vec4 variables: vec2 x = INT; -> vec2 x = vec2(INT.0);
    output = output.replace(/\b(vec[2-4])\s+\w+\s*=\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(\s*[;,)])/g, (match, vecType, num, suffix) => {
      return match.replace(new RegExp(`=\\s*(-?\\d+)(\\s*[;,)])`, 'g'), `= ${vecType}($1.0)$2`);
    });

    // General assignment conversion: EXPRESSION = INT; -> EXPRESSION = INT.0; (for already-declared float variables)
    // BUT skip int/uint variable declarations
    // Use a callback to check context
    output = output.replace(/=\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[;,)])/g, (match, num, offset, string) => {
      // Look back to see if this is an int/uint declaration
      const before = string.substring(Math.max(0, offset - 30), offset);
      if (/\b(?:int|uint)\s+\w+\s*$/.test(before)) {
        return match; // Keep as int for int/uint variable declarations
      }
      return `= ${num}.0`;
    });

    // Convert textureSize() return type from ivec2 to vec2
    // textureSize() returns ivec2/ivec3, but GLSL code expects vec2/vec3 in most cases
    // Wrap textureSize calls with vec2()/vec3() conversion
    // Use negative lookbehind to avoid wrapping already-wrapped calls
    output = output.replace(/(?<!vec2\()\btextureSize\s*\(([^()]+)\)/g, 'vec2(textureSize($1))');

    // FINAL AGGRESSIVE PASS: Convert any remaining int literals in operations
    // This catches edge cases missed by previous patterns
    // BUT exclude #define values (they're often used as array sizes)

    // First, protect #define lines by converting them temporarily
    const defineMap = new Map();
    let defineCounter = 0;
    output = output.replace(/(#define\s+\w+\s+.+)$/gm, (match) => {
      const placeholder = `__DEFINE_PROTECTED_${defineCounter++}__`;
      defineMap.set(placeholder, match);
      return placeholder;
    });

    // Pattern: operator followed by int literal (for all operators)
    output = output.replace(/(==|!=|<|>|<=|>=|[-+*\/])\s*(?<![.\deE\w])(\d+)(?![.\deE\w])/g, (match, op, num, offset, string) => {
      // Don't convert if this is scientific notation (e.g., "1.0e-10")
      // Check if preceded by 'e' or 'E' and operator is + or -
      if ((op === '+' || op === '-')) {
        const before = string.substring(Math.max(0, offset - 5), offset);
        if (/\d+\.?\d*[eE]$/.test(before)) {
          return match; // This is scientific notation, keep unchanged
        }
      }
      return `${op} ${num}.0`;
    });

    // Reverse: int literal followed by operator
    output = output.replace(/(?<![.\deE\w])(\d+)(?![.\deE\w])\s*(==|!=|<|>|<=|>=|[-+*\/])/g, (match, num, op, offset, string) => {
      // Don't convert if this could be scientific notation
      const after = string.substring(offset + match.length, offset + match.length + 10);
      if ((op === '+' || op === '-') && /^[eE]\d/.test(after)) {
        return match; // Might be scientific notation, keep unchanged
      }
      return `${num}.0 ${op}`;
    });

    // Restore protected #defines
    defineMap.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });

    // Protect array sizes: revert any converted array sizes back to int
    // Pattern: [123.0] should be [123]
    output = output.replace(/\[\s*(\d+)\.0\s*\]/g, '[$1]');

    // FINAL ULTRA-AGGRESSIVE PASS: Convert ALL remaining int literals to float
    // This catches any comparisons, function arguments, or other contexts we missed
    // We'll protect specific contexts BEFORE this global conversion

    // DON'T protect #defines - we want their values to be converted to float
    // Array size reversion will fix any that are used in array dimensions

    // Protect scientific notation: 1.0e-10, 1.5e+3, etc.
    const sciNotationMap = new Map();
    let sciNotationCounter = 0;
    output = output.replace(/\d+\.?\d*[eE][+-]?\d+/g, (match) => {
      const placeholder = `__SCI_NOTATION_PROTECTED_${sciNotationCounter++}__`;
      sciNotationMap.set(placeholder, match);
      return placeholder;
    });

    // Protect textureSize calls - second parameter must be int
    const textureSizeMap = new Map();
    let textureSizeCounter = 0;
    output = output.replace(/textureSize\s*\([^)]+\)/g, (match) => {
      const placeholder = `__TEXTURESIZE_PROTECTED_${textureSizeCounter++}__`;
      textureSizeMap.set(placeholder, match);
      return placeholder;
    });

    // STRATEGY: Protect int contexts BEFORE conversion, then convert rest to float
    // This prevents the problem instead of trying to fix it after

    // Step 0: Protect for loops FIRST, then convert other ints to float
    // This preserves int loop variables for array indexing while avoiding int/float comparison errors

    // Protect all for loop headers from conversion
    const forLoopMarkers = new Map<string, string>();
    let forLoopIndex = 0;
    output = output.replace(/\bfor\s*\([^)]+\)/g, (match) => {
      const marker = `___FOR_LOOP_HEADER_${forLoopIndex++}___`;
      forLoopMarkers.set(marker, match);
      return marker;
    });

    // Convert function parameters: int varName, -> float varName,
    output = output.replace(/\b(in\s+|out\s+|inout\s+)?int\s+(\w+)\s*([,)])/g, (match, qualifier, varName, delimiter) => {
      // Skip if it's a uniform declaration
      if (output.includes(`uniform int ${varName}`)) {
        return match;
      }
      return `${qualifier || ''}float ${varName}${delimiter}`;
    });

    // Convert local int declarations: int varName = literal; -> float varName = literal.0;
    output = output.replace(/\bint\s+(\w+)\s*=\s*(\d+)\s*;/g, (match, varName, value) => {
      // Skip uniform int declarations (they should stay as int)
      if (output.includes(`uniform int ${varName}`)) {
        return match;
      }
      return `float ${varName} = ${value}.0;`;
    });

    // Convert uninitialized local int declarations: int varName; -> float varName;
    output = output.replace(/\bint\s+(\w+)\s*;/g, (match, varName) => {
      // Skip uniform declarations
      if (output.includes(`uniform int ${varName}`)) {
        return match;
      }
      return `float ${varName};`;
    });

    // Restore for loops and add int() casts for float comparison operands
    forLoopMarkers.forEach((original, marker) => {
      // Add int() cast if comparing int loop var with potentially-float limit
      const modified = original.replace(
        /\bfor\s*\(\s*int\s+(\w+)\s*=\s*(\d+)\s*;\s*(\w+)\s*([<>]=?)\s*(\w+)\s*;/,
        (match, loopVar, initVal, checkVar, op, limitVar) => {
          if (loopVar === checkVar) {
            return `for (int ${loopVar} = ${initVal}; ${checkVar} ${op} int(${limitVar});`;
          }
          return match;
        }
      );
      output = output.replace(marker, modified);
    });

    // Step 1: Collect all int/uint variable names
    const intVars = new Set<string>();
    output.replace(/\buniform\s+(int|uint)\s+(\w+)/g, (match, type, name) => {
      intVars.add(name);
      return match;
    });
    output.replace(/\b(int|uint)\s+(\w+)/g, (match, type, name) => {
      intVars.add(name);
      return match;
    });

    console.log('[convertIntsToFloats] Found', intVars.size, 'int/uint variables:', Array.from(intVars).slice(0, 10).join(', '));

    // Step 2: Protect int contexts from float conversion
    const protectedContexts: Map<string, string> = new Map();
    let protectIndex = 0;

    // Protect array indices and sizes
    output = output.replace(/\[\s*(\d+)\s*\]/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect int() cast arguments
    output = output.replace(/int\(\s*(\d+)\s*\)/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect uint() cast arguments
    output = output.replace(/uint\(\s*(\d+)\s*\)/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect int/uint variable assignments: int foo = 4; → protect "4"
    output = output.replace(/\b(int|uint)\s+\w+\s*=\s*(\d+)\b/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect literals (int or float) used with int variables in operations
    intVars.forEach(varName => {
      // Protect: intVar op literal (matches both "123" and "123.0")
      output = output.replace(
        new RegExp(`(\\b${varName}\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*)(\\d+(?:\\.\\d+)?)\\b`, 'g'),
        (match, prefix, num) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: literal op intVar (matches both "123" and "123.0")
      output = output.replace(
        new RegExp(`(\\d+(?:\\.\\d+)?)(\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*\\b${varName}\\b)`, 'g'),
        (match, num, suffix) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: intVar op IDENTIFIER (e.g., i < num_samples, i < FXAA_SEARCH_STEPS)
      // Matches ANY identifier (variable or macro), not just literals
      const identifierCompareRegex = new RegExp(`\\b${varName}\\s*(?:==|!=|<|>|<=|>=)\\s*[a-zA-Z_][a-zA-Z0-9_]*\\b`, 'g');
      output = output.replace(identifierCompareRegex, (match) => {
        const marker = `___PROTECTED_${protectIndex++}___`;
        protectedContexts.set(marker, match);
        if (match.includes('num_samples') || match.includes('num_points')) {
          console.log(`[convertIntsToFloats] Protected comparison: "${match}" -> ${marker}`);
        }
        return marker;
      });

      // Protect: IDENTIFIER op intVar (e.g., num_samples < i, FXAA_SEARCH_STEPS < i)
      output = output.replace(
        new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*(?:==|!=|<|>|<=|>=)\\s*${varName}\\b`, 'g'),
        (match) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: intVar arithmetic_op IDENTIFIER (e.g., i * width, i / count)
      // Only arithmetic operators for int operands
      output = output.replace(
        new RegExp(`\\b${varName}\\s*[*/%+\\-]\\s*[a-zA-Z_][a-zA-Z0-9_]*\\b`, 'g'),
        (match) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: IDENTIFIER arithmetic_op intVar (e.g., width * i, count / i)
      output = output.replace(
        new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*[*/%+\\-]\\s*${varName}\\b`, 'g'),
        (match) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );
    });

    // Protect array declarations with macros or literals
    // Matches: type name[SIZE]; or type name[SIZE], or type name[SIZE] = or type name[SIZE])
    output = output.replace(/\b((?:int|uint|float|vec\d|mat\d|ivec\d|uvec\d)\s+\w+\s*\[)([A-Z_][A-Z0-9_]*|\d+)(\]\s*[;,=)])/g,
      (match) => {
        const marker = `___PROTECTED_${protectIndex++}___`;
        protectedContexts.set(marker, match);
        return marker;
      });

    console.log('[convertIntsToFloats] Protected', protectedContexts.size, 'int contexts');

    // Step 3: Protect #define macros used in int contexts
    const arraySizeMacros = new Set<string>();
    // Find macros in array brackets (already protected, but track for #define reversion)
    protectedContexts.forEach(original => {
      const match = original.match(/\[\s*([A-Z_][A-Z0-9_]*)\s*\]/);
      if (match) arraySizeMacros.add(match[1]);
    });

    // Find macros used with int variables
    const intRelatedMacros = new Set<string>();
    protectedContexts.forEach(original => {
      intVars.forEach(varName => {
        const regex = new RegExp(`\\b${varName}\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*([A-Z_][A-Z0-9_]*)\\b|\\b([A-Z_][A-Z0-9_]*)\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*${varName}\\b`);
        const match = original.match(regex);
        if (match) {
          const macroName = match[1] || match[2];
          if (macroName) intRelatedMacros.add(macroName);
        }
      });
    });

    console.log('[convertIntsToFloats] Found', arraySizeMacros.size + intRelatedMacros.size, 'int-context macros');

    // Step 4: Convert ALL remaining int literals to float (int contexts are protected)
    output = output.replace(/(?<![.\deE\w])(\d+)(?![.\deE\w])/g, '$1.0');

    console.log('[convertIntsToFloats] Converted unprotected literals to float');

    // Step 5: Revert #defines used in int contexts
    const macrosToRevert = new Set([...arraySizeMacros, ...intRelatedMacros]);
    macrosToRevert.forEach(macroName => {
      const defineRegex = new RegExp(`(#define\\s+${macroName}\\s+)(\\d+)\\.0\\b`, 'gm');
      output = output.replace(defineRegex, '$1$2');
    });

    if (macrosToRevert.size > 0) {
      console.log('[convertIntsToFloats] Reverted', macrosToRevert.size, 'int-context #defines');
    }

    // Step 6: Restore all protected int contexts as-is
    // After int-to-float conversion, protected contexts like "i < num_samples" become valid
    // because both i and num_samples are now floats, making "float < float" valid in WebGL
    protectedContexts.forEach((original, marker) => {
      output = output.replace(marker, original);
    });

    console.log('[convertIntsToFloats] Restored', protectedContexts.size, 'protected contexts');

    // Step 7: Wrap int loop variables (i, iter) with float() casts when used in arithmetic
    // This prevents int * float and int / float errors
    // Exclude increment/decrement operators (++, --) using negative lookahead
    const loopVarPattern = /\b(i|iter|j|k|idx|index)\b(?!\s*(?:\+\+|--))(?=\s*[*/%+\-])/g;
    output = output.replace(loopVarPattern, 'float($1)');

    // Restore protected textureSize calls
    textureSizeMap.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });

    // Restore protected scientific notation
    sciNotationMap.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });

    return output;
  }

  /**
   * Fix ternary operator type mismatches
   * Convert: condition ? vec3(...) : 0.0 → condition ? vec3(...) : vec3(0.0)
   */
  private static fixTernaryOperatorTypes(source: string): string {
    let output = source;

    // Pattern: condition ? vecN(...) : scalar → condition ? vecN(...) : vecN(scalar)
    // Match vec2, vec3, vec4 followed by parentheses, then optional whitespace, then ?, then anything, then :, then a number
    const vecTernaryPattern = /(\b(vec[2-4])\s*\([^)]+\))\s*\?\s*([^:]+)\s*:\s*(?<![.\deE\w])(-?\d+(?:\.\d+)?)(?![.\deE\w])/g;
    output = output.replace(vecTernaryPattern, (match, vecExpr, vecType, trueExpr, scalar) => {
      return `${vecExpr} ? ${trueExpr} : ${vecType}(${scalar})`;
    });

    // Pattern: condition ? scalar : vecN(...) → condition ? vecN(scalar) : vecN(...)
    const reverseVecTernaryPattern = /(\b(vec[2-4])\s*\([^)]+\))\s*\?\s*(?<![.\deE\w])(-?\d+(?:\.\d+)?)(?![.\deE\w])\s*:\s*([^;,\)\}]+)/g;
    output = output.replace(reverseVecTernaryPattern, (match, vecType, trueExpr, scalar, falseExpr) => {
      // Extract the vecN type from the false expression
      const falseVecMatch = falseExpr.match(/\b(vec[2-4])\s*\(/);
      if (falseVecMatch) {
        return `${falseVecMatch[1]}(${scalar}) ? ${vecType}(${scalar}) : ${falseExpr}`;
      }
      return match; // No change if we can't determine the type
    });

    return output;
  }

  /**
   * Convert Slang bindings to WebGL uniforms
   */
  private static convertBindingsToUniforms(
    source: string,
    bindings: SlangUniformBinding[],
    webgl2: boolean
  ): string {
    let output = source;
    const declaredUniforms = new Set<string>(); // Track which uniforms we've already declared

    // Parse existing uniform declarations from source (e.g., shader parameters)
    const existingUniformRegex = /^\s*uniform\s+\w+\s+(\w+)\s*;/gm;
    let match;
    while ((match = existingUniformRegex.exec(source)) !== null) {
      declaredUniforms.add(match[1]);
    }

    console.log('[SlangCompiler] convertBindingsToUniforms - processing', bindings.length, 'bindings');
    console.log('[SlangCompiler] Found', declaredUniforms.size, 'existing uniform declarations in source');

    for (const binding of bindings) {
      console.log('[SlangCompiler] Processing binding:', binding.type, binding.name,
                  'instanceName:', binding.instanceName || 'N/A',
                  'members:', binding.members?.length || 0);
      if (binding.type === 'sampler') {
        // Already a uniform, just remove layout
        const pattern = new RegExp(
          `layout\\s*\\([^)]*\\)\\s*uniform\\s+sampler\\w+\\s+${binding.name}\\s*;`,
          'g'
        );
        output = output.replace(pattern, `uniform sampler2D ${binding.name};`);
      } else if (binding.type === 'ubo' && binding.members) {
        // Convert UBO to individual uniforms using actual member types
        // Deduplicate - only create uniforms for members not already declared
        // IMPORTANT: Convert ALL int/uint types to float to avoid GLSL type mismatches
        const uniformDecls = binding.members
          .filter(member => {
            if (declaredUniforms.has(member.name)) {
              console.log(`[SlangCompiler] Skipping duplicate uniform: ${member.name} from UBO ${binding.name}`);
              return false;
            }
            declaredUniforms.add(member.name);
            return true;
          })
          .map(member => {
            // Convert int/uint uniforms to float to avoid comparison type errors
            let glslType = member.type;
            if (glslType === 'int' || glslType === 'uint') {
              console.log(`[SlangCompiler] Converting ${member.name} from ${glslType} to float`);
              glslType = 'float';
            }
            return `uniform ${glslType} ${member.name};`;
          })
          .join('\n');

        // Try to find and replace the UBO block in the source
        const uboPattern = new RegExp(
          `layout\\s*\\([^)]*\\)\\s*uniform\\s+${binding.name}\\s*[\\s\\S]*?\\}\\s*\\w*\\s*;`,
          'g'
        );

        const testMatch = output.match(uboPattern);
        if (testMatch) {
          // UBO found in source - replace it with uniform declarations
          console.log(`[SlangCompiler] UBO ${binding.name} found in source, replacing with ${uniformDecls.split('\n').length} uniforms`);
          output = output.replace(uboPattern, uniformDecls);
        } else {
          // UBO not in source (e.g., defined before #pragma stage) - inject uniforms after precision declarations
          console.log(`[SlangCompiler] UBO ${binding.name} not in source, injecting ${uniformDecls.split('\n').length} uniforms after precision`);

          // Find insertion point: after precision declarations
          const precisionEnd = output.search(/precision\s+\w+\s+\w+\s*;\s*\n/g);
          if (precisionEnd !== -1) {
            const afterPrecision = output.substring(precisionEnd).match(/precision\s+\w+\s+\w+\s*;\s*\n/);
            if (afterPrecision) {
              const insertPos = precisionEnd + afterPrecision[0].length;
              output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
            }
          } else {
            // No precision found, insert after #version
            const versionEnd = output.search(/#version.*?\n/);
            if (versionEnd !== -1) {
              const versionMatch = output.match(/#version.*?\n/);
              if (versionMatch) {
                const insertPos = versionEnd + versionMatch[0].length;
                output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
              }
            }
          }
        }
      } else if (binding.type === 'pushConstant' && binding.members) {
        // Convert push constants to individual uniforms using actual member types
        // Deduplicate - only create uniforms for members not already declared
        const uniformDecls = binding.members
          .filter(member => {
            if (declaredUniforms.has(member.name)) {
              console.log(`[SlangCompiler] Skipping duplicate uniform: ${member.name} from push constant ${binding.name}`);
              return false;
            }
            declaredUniforms.add(member.name);
            return true;
          })
          .map(member => `uniform ${member.type} ${member.name};`)
          .join('\n');

        // Try to find and replace the push constant block in the source
        const pushPattern = new RegExp(
          `layout\\s*\\(push_constant\\)\\s*uniform\\s+${binding.name}\\s*[\\s\\S]*?\\}\\s*\\w*\\s*;`,
          'g'
        );

        const testMatch = output.match(pushPattern);
        if (testMatch) {
          // Push constant found in source - replace it
          console.log(`[SlangCompiler] Push constant ${binding.name} found in source, replacing with ${uniformDecls.split('\n').length} uniforms`);
          output = output.replace(pushPattern, uniformDecls);
        } else {
          // Push constant not in source - inject uniforms after precision
          console.log(`[SlangCompiler] Push constant ${binding.name} not in source, injecting ${uniformDecls.split('\n').length} uniforms after precision`);

          const precisionEnd = output.search(/precision\s+\w+\s+\w+\s*;\s*\n/g);
          if (precisionEnd !== -1) {
            const afterPrecision = output.substring(precisionEnd).match(/precision\s+\w+\s+\w+\s*;\s*\n/);
            if (afterPrecision) {
              const insertPos = precisionEnd + afterPrecision[0].length;
              output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
            }
          }
        }

        // Replace instanceName.member with just member (e.g., params.curvature -> curvature)
        if (binding.instanceName) {
          binding.members.forEach(member => {
            // Use word boundaries to match whole words only
            const pattern = new RegExp(`\\b${binding.instanceName}\\.${member.name}\\b`, 'g');
            output = output.replace(pattern, member.name);
          });
        }
      }
    }

    // Also fix #define aliases that reference struct members after UBO conversion
    // Example: #define beamg global.g_CRT_bg -> #define beamg g_CRT_bg
    console.log(`[SlangCompiler] Before #define replacement, checking for #define global. references...`);
    const defineGlobalRefs = output.match(/#define\s+\w+\s+global\.\w+/g);
    console.log(`[SlangCompiler] Found #define global. references:`, defineGlobalRefs ? defineGlobalRefs.slice(0, 10) : 'none');

    output = output.replace(/#define\s+(\w+)\s+(global|params)\.(\w+)/g, '#define $1 $3');

    console.log(`[SlangCompiler] After #define replacement, checking for remaining #define global. references...`);
    const remainingDefineGlobalRefs = output.match(/#define\s+\w+\s+global\.\w+/g);
    console.log(`[SlangCompiler] Remaining #define global. references:`, remainingDefineGlobalRefs ? remainingDefineGlobalRefs.slice(0, 10) : 'none');

    // If there's a push_constant named 'params', replace global. references with params.
    // This fixes shaders that include common files designed for UBO but use push_constant
    const hasParamsPushConstant = bindings.some(b => b.type === 'pushConstant' && b.instanceName === 'params');
    console.log(`[SlangCompiler] Has params push_constant: ${hasParamsPushConstant}`);
    console.log(`[SlangCompiler] Push constant bindings:`, bindings.filter(b => b.type === 'pushConstant').map(b => ({ type: b.type, name: b.name, instanceName: b.instanceName })));

    if (hasParamsPushConstant) {
      console.log(`[SlangCompiler] Before global. replacement, checking for global. references...`);
      const globalRefs = output.match(/\bglobal\.\w+\b/g);
      console.log(`[SlangCompiler] Found global. references:`, globalRefs ? globalRefs.slice(0, 10) : 'none');

      output = output.replace(/\bglobal\.(\w+)\b/g, 'params.$1');

      console.log(`[SlangCompiler] After global. replacement, checking for remaining global. references...`);
      const remainingGlobalRefs = output.match(/\bglobal\.\w+\b/g);
      console.log(`[SlangCompiler] Remaining global. references:`, remainingGlobalRefs ? remainingGlobalRefs.slice(0, 10) : 'none');
    }

    return output;
  }

  /**
   * Generate default vertex shader
   */
  private static generateDefaultVertexShader(webgl2: boolean): string {
    if (webgl2) {
      return `#version 300 es

uniform mat4 MVP;

in vec4 Position;
in vec2 TexCoord;

out vec2 vTexCoord;

void main() {
  gl_Position = MVP * Position;
  vTexCoord = TexCoord;
}
`;
    } else {
      return `
attribute vec4 Position;
attribute vec2 TexCoord;

uniform mat4 MVP;

varying vec2 vTexCoord;

void main() {
  gl_Position = MVP * Position;
  vTexCoord = TexCoord;
}
`;
    }
  }

  /**
   * Extract uniform names from bindings
   */
  private static extractUniformNames(bindings: SlangUniformBinding[]): string[] {
    const uniforms: string[] = [];

    for (const binding of bindings) {
      if (binding.type === 'ubo' && binding.members) {
        uniforms.push(...binding.members.map(m => m.name));
      } else if (binding.type === 'pushConstant' && binding.members) {
        uniforms.push(...binding.members.map(m => m.name));
      }
    }

    return uniforms;
  }

  /**
   * Extract sampler names from bindings
   */
  private static extractSamplerNames(bindings: SlangUniformBinding[]): string[] {
    return bindings
      .filter(b => b.type === 'sampler')
      .map(b => b.name);
  }

  /**
   * Enhanced GLSL preprocessor for Mega Bezel complex #include handling
   */
  private static async preprocessIncludes(
    source: string,
    baseUrl: string,
    processedFiles = new Set<string>(),
    definedMacros = new Set<string>(),
    includeStack: string[] = []
  ): Promise<string> {
    // Prevent infinite recursion
    if (includeStack.length > 20) {
      throw new Error(`Include stack too deep: ${includeStack.join(' -> ')}`);
    }

    // Extract base directory from URL
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

    // Track this file to prevent circular includes
    if (processedFiles.has(baseUrl)) {
      console.warn(`[SlangCompiler] Circular include detected: ${baseUrl}`);
      return `// Circular include prevented: ${baseUrl}`;
    }
    processedFiles.add(baseUrl);
    includeStack.push(baseUrl);

    // Extract all #define macros from this file to track what's defined
    const definePattern = /#define\s+(\w+)(?:\s+.*)?$/gm;
    let defineMatch;
    while ((defineMatch = definePattern.exec(source)) !== null) {
      definedMacros.add(defineMatch[1]);
    }

    // Extract #ifdef/#ifndef blocks to understand conditional compilation
    const conditionalBlocks = this.extractConditionalBlocks(source, definedMacros);

    // Find all #include directives with their positions and context
    const includePattern = /#include\s+"([^"]+)"/g;
    let match;
    let result = source;
    const includes: Array<{
      directive: string;
      path: string;
      index: number;
      isInDisabledBlock: boolean;
      condition?: string;
    }> = [];

    while ((match = includePattern.exec(source)) !== null) {
      const isInDisabledBlock = this.isIncludeInDisabledBlock(source, match.index, definedMacros);
      includes.push({
        directive: match[0],
        path: match[1],
        index: match.index,
        isInDisabledBlock,
        condition: this.getConditionalContext(source, match.index, conditionalBlocks)
      });
    }

    // Process includes in reverse order to preserve line positions
    for (const include of includes.reverse()) {
      if (include.isInDisabledBlock) {
        console.log(`[SlangCompiler] Skipping #include "${include.path}" (inside disabled conditional block: ${include.condition})`);
        result = result.replace(include.directive, `// SKIPPED (conditional): ${include.directive}`);
        continue;
      }

      // Resolve relative path with enhanced logic
      const includePath = include.path;
      let includeUrl: string;

      if (includePath.startsWith('/')) {
        // Absolute path from shader root
        includeUrl = includePath;
      } else if (includePath.startsWith('./') || includePath.startsWith('../')) {
        // Explicit relative path
        includeUrl = this.resolveRelativePath(baseDir, includePath);
      } else {
        // Relative to current file directory
        includeUrl = this.resolveRelativePath(baseDir, includePath);
      }

      // Load included file with enhanced error handling
      try {
        console.log(`[SlangCompiler] Processing include: ${include.path} -> ${includeUrl}`);
        const response = await fetch(includeUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let includeSource = await response.text();
        console.log(`[SlangCompiler] Loaded ${includeSource.length} chars from ${includeUrl}`);

        // Recursively process includes in the included file
        const childDefinedMacros = new Set(definedMacros); // Copy current macros
        includeSource = await this.preprocessIncludes(
          includeSource,
          includeUrl,
          processedFiles,
          childDefinedMacros,
          [...includeStack]
        );

        // Replace the include directive with the file contents
        const replacement = `// Included from: ${include.path} (${includeUrl})\n${includeSource}\n// End include: ${include.path}`;
        result = result.replace(include.directive, replacement);

      } catch (error) {
        console.error(`[SlangCompiler] Failed to load include ${includeUrl}:`, error);
        const errorComment = `// ERROR: Failed to load ${include.path} from ${includeUrl}\n// ${error.message}`;
        result = result.replace(include.directive, errorComment);
      }
    }

    includeStack.pop();
    return result;
  }

  /**
   * Extract conditional compilation blocks (#ifdef, #ifndef, #if)
   */
  private static extractConditionalBlocks(source: string, definedMacros: Set<string>): Array<{
    type: 'ifdef' | 'ifndef' | 'if';
    macro?: string;
    start: number;
    end: number;
    enabled: boolean;
    definedMacros: Set<string>;
  }> {
    const blocks: Array<any> = [];
    const lines = source.split('\n');
    const stack: Array<{type: string, macro?: string, line: number, enabled: boolean}> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#ifdef ')) {
        const macro = line.split(' ')[1];
        const enabled = definedMacros.has(macro);
        stack.push({ type: 'ifdef', macro, line: i, enabled });
      } else if (line.startsWith('#ifndef ')) {
        const macro = line.split(' ')[1];
        const enabled = !definedMacros.has(macro);
        stack.push({ type: 'ifndef', macro, line: i, enabled });
      } else if (line.startsWith('#if ')) {
        // Complex #if conditions - for now, assume enabled
        stack.push({ type: 'if', line: i, enabled: true });
      } else if (line === '#else') {
        if (stack.length > 0) {
            stack[stack.length - 1].enabled = !stack[stack.length - 1].enabled;
        }
      } else if (line === '#endif') {
        if (stack.length > 0) {
          const block = stack.pop()!;
          blocks.push({
            type: block.type,
            macro: block.macro,
            start: block.line,
            end: i,
            enabled: block.enabled,
            definedMacros: new Set(definedMacros)
          });
        }
      }
    }

    return blocks;
  }

  /**
   * Get conditional context for an include directive
   */
  private static getConditionalContext(source: string, includeIndex: number, conditionalBlocks: any[]): string | undefined {
    const includeLine = source.substring(0, includeIndex).split('\n').length - 1;

    for (const block of conditionalBlocks) {
      if (includeLine >= block.start && includeLine <= block.end) {
        return `${block.type} ${block.macro || 'complex'} (${block.enabled ? 'enabled' : 'disabled'})`;
      }
    }

    return undefined;
  }

  /**
   * Check if an #include directive is inside a disabled conditional block
   */
  private static isIncludeInDisabledBlock(source: string, includeIndex: number, definedMacros: Set<string>): boolean {
    // Walk backwards from the #include to find the nearest conditional directive
    const textBefore = source.substring(0, includeIndex);
    const lines = textBefore.split('\n');

    // Stack to track nested conditionals
    const stack: Array<{ directive: string; macro?: string; enabled: boolean }> = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Match #ifndef MACRO
      const ifndefMatch = trimmed.match(/^#ifndef\s+(\w+)/);
      if (ifndefMatch) {
        const macro = ifndefMatch[1];
        const enabled = !definedMacros.has(macro); // Enabled if macro is NOT defined
        stack.push({ directive: 'ifndef', macro, enabled });
        continue;
      }

      // Match #ifdef MACRO
      const ifdefMatch = trimmed.match(/^#ifdef\s+(\w+)/);
      if (ifdefMatch) {
        const macro = ifdefMatch[1];
        const enabled = definedMacros.has(macro); // Enabled if macro IS defined
        stack.push({ directive: 'ifdef', macro, enabled });
        continue;
      }

      // Match #else
      if (trimmed === '#else') {
        if (stack.length > 0) {
          const top = stack[stack.length - 1];
          // Invert the enabled state
          top.enabled = !top.enabled;
        }
        continue;
      }

      // Match #endif
      if (trimmed === '#endif') {
        stack.pop();
        continue;
      }
    }

    // If any conditional in the stack is disabled, the #include is in a disabled block
    return stack.some(cond => !cond.enabled);
  }

  /**
   * Resolve relative path from base directory
   */
  private static resolveRelativePath(baseDir: string, relativePath: string): string {
    // Split paths into segments
    const baseSegments = baseDir.split('/').filter(s => s);
    const relativeSegments = relativePath.split('/').filter(s => s);

    // Process .. and . in relative path
    for (const segment of relativeSegments) {
      if (segment === '..') {
        baseSegments.pop();
      } else if (segment !== '.') {
        baseSegments.push(segment);
      }
    }

    // Reconstruct URL
    return '/' + baseSegments.join('/');
  }

  /**
   * Deduplicate #define macros to prevent redefinition errors
   * Keeps the first occurrence of each macro and removes subsequent duplicates
   */
  private static deduplicateDefines(source: string): string {
    const lines = source.split('\n');
    const seenDefines = new Set<string>();
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if this is a #define directive
      if (trimmed.startsWith('#define ')) {
        const macroMatch = trimmed.match(/^#define\s+(\w+)/);
        if (macroMatch) {
          const macroName = macroMatch[1];

          // Skip if we've already seen this macro
          if (seenDefines.has(macroName)) {
            console.log(`[SlangCompiler] Removing duplicate #define: ${macroName}`);
            continue; // Skip this duplicate define
          }

          // Mark this macro as seen
          seenDefines.add(macroName);
        }
      }

      // Keep the line (whether it's a define or not)
      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Load and compile shader from URL
   */
  public static async loadFromURL(url: string, webgl2 = true): Promise<CompiledShader> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load shader: ${response.statusText}`);
    }

    let source = await response.text();

    // Preprocess includes
    source = await this.preprocessIncludes(source, url);

    // Deduplicate #define macros to prevent redefinition errors
    source = this.deduplicateDefines(source);

    // Debug: Log preprocessed source for specific shaders
    const shaderName = url.split('/').pop() || 'unknown';
    if (shaderName === 'hsm-grade.slang' || shaderName === 'post-crt-prep-potato.slang') {
      console.log(`[SlangCompiler] Preprocessed source for ${shaderName} (first 3000 chars):`);
      console.log(source.substring(0, 3000));
      console.log(`[SlangCompiler] Total preprocessed length: ${source.length}`);

      // Check for specific constants/functions
      const hasRW = source.includes('RW');
      const hasWpTemp = source.includes('wp_temp');
      const hasGetTubeCurved = source.includes('HSM_GetTubeCurvedCoord');
      const hasHrgGetIdeal = source.includes('hrg_get_ideal_global_eye_pos_for_points');
      const hrgFuncs = source.match(/hrg_\w+/g);
      const uniqueHrgFuncs = hrgFuncs ? [...new Set(hrgFuncs)] : [];
      console.log(`[SlangCompiler] ${shaderName} has RW: ${hasRW}, wp_temp: ${hasWpTemp}, HSM_GetTubeCurvedCoord: ${hasGetTubeCurved}`);
      console.log(`[SlangCompiler] ${shaderName} has hrg_get_ideal_global_eye_pos_for_points: ${hasHrgGetIdeal}`);
      console.log(`[SlangCompiler] ${shaderName} unique hrg functions:`, uniqueHrgFuncs.slice(0, 10));
    }

    return this.compile(source, webgl2);
  }
}
