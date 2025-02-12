export enum NetworkIds {
  Mainnet = 1,
  Goerli = 5,
  Gnosis = 100,
  Anvil = 31337,
}

export enum Tokens {
  DAI = "0x6b175474e89094c44da98b954eedeac495271d0f",
  WXDAI = "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d",
}

export const networkNames = {
  [NetworkIds.Mainnet]: "Ethereum Mainnet",
  [NetworkIds.Goerli]: "Goerli Testnet",
  [NetworkIds.Gnosis]: "Gnosis Chain",
  [NetworkIds.Anvil]: "http://127.0.0.1:8545",
};

export function getNetworkName(networkId?: number) {
  const networkName = networkNames[networkId as keyof typeof networkNames];
  if (!networkName) {
    console.error(`Unknown network ID: ${networkId}`);
  }
  return networkName ?? "Unknown Network";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const nftAddress = "0xAa1bfC0e51969415d64d6dE74f27CDa0587e645b";
