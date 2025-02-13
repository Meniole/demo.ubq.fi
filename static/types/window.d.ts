import { ExternalProvider } from "@ethersproject/providers";

declare global {
  interface Window {
    ethereum: ExternalProvider & { on: (event: string, callback) => void };
  }
}
