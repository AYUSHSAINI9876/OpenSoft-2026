export interface StockData {
  symbol: string
  name: string
  price: number
  currency: string
  tokenSymbol?: string
  changePercent: number
  changeValue?: number
  isDerived?: boolean
}

// Live symbols — keep in sync with backend market presets.
export const indianStocks: StockData[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 214.30, currency: 'USD', tokenSymbol: 'AAPL', changePercent: 0.28 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 437.80, currency: 'USD', tokenSymbol: 'MSFT', changePercent: 0.63 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 1223.40, currency: 'USD', tokenSymbol: 'NVDA', changePercent: 2.79 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 197.10, currency: 'USD', tokenSymbol: 'AMZN', changePercent: 2.33 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', price: 247.80, currency: 'USD', tokenSymbol: 'TSLA', changePercent: -0.11 },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', price: 176.20, currency: 'USD', tokenSymbol: 'GOOGL', changePercent: 0.45 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', price: 502.40, currency: 'USD', tokenSymbol: 'META', changePercent: 1.10 },
]

export const indices: StockData[] = [
  { symbol: 'SPX', name: 'S&P 500', price: 6576.71, currency: 'USD', changePercent: 1.78 },
  { symbol: 'NDX', name: 'Nasdaq 100', price: 24074.79, currency: 'USD', changePercent: 1.89, isDerived: true },
  { symbol: 'DJI', name: 'Dow Jones', price: 46278.50, currency: 'USD', changePercent: 1.95 },
  { symbol: 'RUT', name: 'Russell 2000', price: 2187.00, currency: 'USD', changePercent: 2.60 },
]

export const worldIndices: StockData[] = [
  { symbol: 'DAX', name: 'Germany 40 Index', price: 19342.10, currency: 'EUR', changePercent: -0.07 },
  { symbol: 'CAC', name: 'France 40 Index', price: 7928.40, currency: 'EUR', changePercent: -0.47, isDerived: true },
  { symbol: 'HSI', name: 'Hang Seng Index', price: 18342.10, currency: 'HKD', changePercent: 0.15 },
  { symbol: 'NI225', name: 'Japan 225 Index', price: 52252.21, currency: 'JPY', changePercent: 1.43 },
  { symbol: 'UKX', name: 'FTSE 100 Index', price: 9965.16, currency: 'GBP', changePercent: 0.72, isDerived: true },
]

export const communityTrends: StockData[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', price: 68250.00, currency: 'USD', tokenSymbol: 'BTC', changePercent: -2.89 },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', price: 3225.00, currency: 'USD', tokenSymbol: 'ETH', changePercent: 3.75 },
  { symbol: 'SOLUSD', name: 'Solana / US Dollar', price: 162.94, currency: 'USD', tokenSymbol: 'SOL', changePercent: 4.84 },
  { symbol: 'BNBUSD', name: 'BNB / US Dollar', price: 602.30, currency: 'USD', tokenSymbol: 'BNB', changePercent: 4.53 },
  { symbol: 'XRPUSD', name: 'XRP / US Dollar', price: 0.62, currency: 'USD', tokenSymbol: 'XRP', changePercent: 5.22 },
]

export const highestVolume: StockData[] = [
  { symbol: 'COIN', name: 'Coinbase Global, Inc.', price: 246.95, currency: 'USD', tokenSymbol: 'COIN', changePercent: 1.76 },
  { symbol: 'MSTR', name: 'MicroStrategy Incorporated', price: 1449.40, currency: 'USD', tokenSymbol: 'MSTR', changePercent: 16.98 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 168.40, currency: 'USD', tokenSymbol: 'AMD', changePercent: 0.95 },
  { symbol: 'SMCI', name: 'Super Micro Computer', price: 872.50, currency: 'USD', tokenSymbol: 'SMCI', changePercent: 1.32 },
]

export const mostVolatile: StockData[] = [
  { symbol: 'AVAXUSD', name: 'Avalanche / US Dollar', price: 45.00, currency: 'USD', tokenSymbol: 'AVAX', changePercent: 7.40, isDerived: true },
  { symbol: 'DOGEUSD', name: 'Dogecoin / US Dollar', price: 0.204, currency: 'USD', tokenSymbol: 'DOGE', changePercent: 9.72, isDerived: true },
  { symbol: 'ADAUSD', name: 'Cardano / US Dollar', price: 0.61, currency: 'USD', tokenSymbol: 'ADA', changePercent: -13.18, isDerived: true },
  { symbol: 'DOTUSD', name: 'Polkadot / US Dollar', price: 7.44, currency: 'USD', tokenSymbol: 'DOT', changePercent: -4.75, isDerived: true },
  { symbol: 'LTCUSD', name: 'Litecoin / US Dollar', price: 83.10, currency: 'USD', tokenSymbol: 'LTC', changePercent: -7.46 },
  { symbol: 'LINKUSD', name: 'Chainlink / US Dollar', price: 16.16, currency: 'USD', tokenSymbol: 'LINK', changePercent: 0.65, isDerived: true },
]

export const gainers: StockData[] = [
  { symbol: 'CRVUSD', name: 'Curve DAO / US Dollar', price: 0.52, currency: 'USD', tokenSymbol: 'CRV', changePercent: 20.00, isDerived: true },
  { symbol: 'SUIUSD', name: 'Sui / US Dollar', price: 1.26, currency: 'USD', tokenSymbol: 'SUI', changePercent: 20.00, isDerived: true },
  { symbol: 'ARBUSD', name: 'Arbitrum / US Dollar', price: 1.39, currency: 'USD', tokenSymbol: 'ARB', changePercent: 20.00, isDerived: true },
  { symbol: 'OPUSD', name: 'Optimism / US Dollar', price: 3.74, currency: 'USD', tokenSymbol: 'OP', changePercent: 19.97, isDerived: true },
  { symbol: 'INJUSD', name: 'Injective / US Dollar', price: 32.44, currency: 'USD', tokenSymbol: 'INJ', changePercent: 19.61, isDerived: true },
  { symbol: 'APTUSD', name: 'Aptos / US Dollar', price: 8.15, currency: 'USD', tokenSymbol: 'APT', changePercent: 19.38 },
]

export const losers: StockData[] = [
  { symbol: 'UNIUSD', name: 'Uniswap / US Dollar', price: 11.46, currency: 'USD', tokenSymbol: 'UNI', changePercent: -20.00 },
  { symbol: 'ATOMUSD', name: 'Cosmos / US Dollar', price: 9.36, currency: 'USD', tokenSymbol: 'ATOM', changePercent: -19.86 },
  { symbol: 'FILUSD', name: 'Filecoin / US Dollar', price: 6.00, currency: 'USD', tokenSymbol: 'FIL', changePercent: -19.57, isDerived: true },
  { symbol: 'ALGOUSD', name: 'Algorand / US Dollar', price: 0.257, currency: 'USD', tokenSymbol: 'ALGO', changePercent: -17.22, isDerived: true },
  { symbol: 'NEARUSD', name: 'NEAR / US Dollar', price: 5.89, currency: 'USD', tokenSymbol: 'NEAR', changePercent: -15.80, isDerived: true },
  { symbol: 'ETCUSD', name: 'Ethereum Classic / US Dollar', price: 27.73, currency: 'USD', tokenSymbol: 'ETC', changePercent: -15.05, isDerived: true },
]

const universeSource = [
  ...indianStocks,
  ...indices,
  ...worldIndices,
  ...communityTrends,
  ...highestVolume,
  ...mostVolatile,
  ...gainers,
  ...losers,
]

const uniqueUniverse = new Map<string, StockData>()
universeSource.forEach((item) => {
  if (!uniqueUniverse.has(item.symbol)) uniqueUniverse.set(item.symbol, item)
})

export const terminalUniverse = Array.from(uniqueUniverse.values()).map((item) => ({
  symbol: item.symbol,
  price: item.price,
}))
