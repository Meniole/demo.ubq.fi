import { execSync } from "child_process";
import { config } from "dotenv";
import esbuild from "esbuild";
import { yamlPlugin } from "esbuild-plugin-yaml";
import { access, mkdir } from "fs/promises";
import { join } from "path";
import { invertColors } from "./plugins/invert-colors";

// Ensure output directory exists
const outDir = join("static/dist");

async function ensureOutDir() {
  try {
    await mkdir(outDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create output directory:", err);
    process.exit(1);
  }
}

import { pwaManifest } from "./plugins/pwa-manifest";
const typescriptEntries = ["static/scripts/logger.ts", "static/scripts/demoing/demoing.ts"];
const cssEntries = ["static/style/style.css", "static/style/special.css"];
export const entries = [...typescriptEntries, ...cssEntries];

export const esBuildContext: esbuild.BuildOptions = {
  plugins: [invertColors, pwaManifest, yamlPlugin({})],
  sourcemap: true,
  entryPoints: entries,
  bundle: true,
  minify: false,
  loader: {
    ".png": "dataurl",
    ".woff": "dataurl",
    ".woff2": "dataurl",
    ".eot": "dataurl",
    ".ttf": "dataurl",
    ".svg": "dataurl",
  },
  outdir: outDir,
  outbase: "static",
  absWorkingDir: process.cwd(),
  define: createEnvDefines(["SUPABASE_URL", "SUPABASE_ANON_KEY", "FRONTEND_URL"], {
    commitHash: execSync(`git rev-parse --short HEAD`).toString().trim(),
  }),
};

async function build() {
  // Create output directory before building
  await ensureOutDir();

  try {
    const result = await esbuild.build(esBuildContext);

    if (result.metafile) {
      const outputs = Object.keys(result.metafile.outputs);
      console.log("Outputs:", outputs);

      // Verify files were written
      for (const output of outputs) {
        try {
          await access(output);
          console.log(`✓ Verified ${output}`);
        } catch (err) {
          console.error(`✗ Failed to write ${output}`);
          throw err;
        }
      }
    }
    console.log("\tesbuild complete");
  } catch (err) {
    console.error("Build failed:", err);
    if (err instanceof Error && "errors" in err) {
      console.error("Detailed errors:", JSON.stringify(err.errors, null, 2));
    }
    process.exit(1);
  }
}

build().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

function createEnvDefines(environmentVariables: string[], generatedAtBuild: Record<string, unknown>): Record<string, string> {
  const defines: Record<string, string> = {};
  config();
  for (const name of environmentVariables) {
    const envVar = process.env[name];
    if (!envVar) throw new Error("No envVar");
    defines[name] = JSON.stringify(envVar); // Use empty string as fallback
  }
  Object.keys(generatedAtBuild).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(generatedAtBuild, key)) {
      defines[key] = JSON.stringify(generatedAtBuild[key]);
    }
  });
  return defines;
}
