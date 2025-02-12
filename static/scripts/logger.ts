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
    const loggerElement = document.getElementById("logger") as HTMLPreElement;
    if (loggerElement) {
      // Create a new div for the log entry
      const logEntry = document.createElement("div");

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

      logEntry.textContent = logString;

      // Append new log entry
      loggerElement.appendChild(logEntry);

      // Calculate new height based on number of entries
      const entries = loggerElement.children.length;
      const rowHeight = 12; // Line height
      const marginHeight = 8; // Total margin per row (4px top + 4px bottom)
      const totalHeight = entries * (rowHeight + marginHeight);

      // Set new height with minimum of 24px
      const newHeight = Math.max(totalHeight, 24);
      loggerElement.style.height = `${newHeight}px`;
    }
  },
};

// Attach logger to window object
window.logger = virtualLogger;

export {};
