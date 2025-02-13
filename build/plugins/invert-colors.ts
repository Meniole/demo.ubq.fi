import esbuild from "esbuild";
import fs from "fs";
import path from "path";

export const invertColors: esbuild.Plugin = {
  name: "invert-colors",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const contents = await fs.promises.readFile(args.path, "utf8");

      // Simple color scheme inversion
      const processedContents = contents.replace(/prefers-color-scheme: dark/g, "prefers-color-scheme: light");

      // Invert colors
      const invertedContents = processedContents.replace(/#([0-9A-Fa-f]{3,6})([0-9A-Fa-f]{2})?\b/g, (match, rgb, alpha) => {
        let color = rgb.startsWith("#") ? rgb.slice(1) : rgb;
        if (color.length === 3) {
          color = color
            .split("")
            .map((char: string) => char + char)
            .join("");
        }
        const r = parseInt(color.slice(0, 2), 16);
        const g = parseInt(color.slice(2, 4), 16);
        const b = parseInt(color.slice(4, 6), 16);

        // Check if the color is greyscale (R, G, and B components are equal)
        if (r === g && g === b) {
          // Invert RGB values
          const invertedColorValue = (255 - r).toString(16).padStart(2, "0");
          // Return the inverted greyscale color with alpha channel if present
          return `#${invertedColorValue}${invertedColorValue}${invertedColorValue}${alpha || ""}`;
        }

        // If the color is not greyscale, return it as is, including the alpha channel if present
        return `#${color}${alpha || ""}`;
      });

      // Skip if filename already starts with 'inverted-' to avoid circular processing
      const filename = path.basename(args.path);
      if (filename.startsWith("inverted-")) {
        return { contents, loader: "css" };
      }

      // Generate output path with 'inverted-' prefix in same directory as input
      const outputPath = path.join(path.dirname(args.path), `inverted-${filename}`);

      // Write inverted contents
      await fs.promises.writeFile(outputPath, invertedContents, "utf8");

      // Return original contents for the build
      return { contents: contents, loader: "css" };
    });
  },
};
