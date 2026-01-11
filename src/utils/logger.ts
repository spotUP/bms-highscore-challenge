// Basic logging utility with debug mode support
let isDebugMode = false; // Disabled for production-ready console

export const dlog = (...args: any[]) => {
  if (isDebugMode) {
    console.log('[Debug]', ...args);
  }
};

export const setDebugMode = (enabled: boolean) => {
  isDebugMode = enabled;
};

export const isDebug = () => isDebugMode;