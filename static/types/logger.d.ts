interface Logger {
  log: (...args: unknown[]) => void;
}

declare global {
  interface Window {
    logger: Logger;
  }
  const logger: Logger;
}

export {};
