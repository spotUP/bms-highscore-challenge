// Basic logging utility with debug mode support
let isDebugMode = process.env.NODE_ENV === 'development';

export const dlog = (...args: any[]) => {
  if (isDebugMode) {
    console.log('[Debug]', ...args);
  }
};

export const setDebugMode = (enabled: boolean) => {
  isDebugMode = enabled;
};

export const isDebug = () => isDebugMode;