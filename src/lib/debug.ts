export const debugEnabled = (): boolean => {
  try {
    return import.meta.env.DEV && (localStorage.getItem('debug_logs') === '1');
  } catch {
    return false;
  }
};

export const dlog = (...args: any[]) => {
  if (debugEnabled()) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};
