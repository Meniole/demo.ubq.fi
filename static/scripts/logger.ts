interface Logger {
  log: (...args: unknown[]) => void;
}

declare global {
  interface Window {
    logger: Logger;
  }
}

// Create virtual console logger
const virtualLogger = {
  log: (...args: unknown[]) => {
    const loggerElement = document.getElementById("logger");
    if (loggerElement) {
      // Convert arguments to string, handling objects and arrays
      const logString =
        args
          .map((arg) => {
            if (typeof arg === "object") {
              return JSON.stringify(arg);
            }
            return String(arg);
          })
          .join(" ") + "\n";

      // Append new log to existing content
      loggerElement.textContent += logString;

      // Auto-scroll to bottom
      loggerElement.scrollTop = loggerElement.scrollHeight;
    }
  },
};

// Attach logger to window object
window.logger = virtualLogger;

export {};
