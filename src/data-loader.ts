import { CandleData } from './technical-indicators';

export class ForexDataLoader {
  /**
   * Generate mock forex data for testing
   */
  async getHistoricalData(
    symbol: string = 'EUR/USD',
    interval: string = '1h'
  ): Promise<CandleData[]> {
    return this.generateMockData(100);
  }

  /**
   * Mock data generator
   */
  private generateMockData(count: number): CandleData[] {
    const data: CandleData[] = [];
    let basePrice = 1.0850;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 0.0020;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * 0.0005;
      const low = Math.min(open, close) - Math.random() * 0.0005;

      data.push({
        timestamp: Date.now() - (count - i) * 3600000,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000000
      });

      basePrice = close;
    }

    return data;
  }

  /**
   * Convert candle data to arrays
   */
  extractPriceArrays(candles: CandleData[]): {
    closes: number[];
    opens: number[];
    highs: number[];
    lows: number[];
    volumes: number[];
  } {
    return {
      closes: candles.map(c => c.close),
      opens: candles.map(c => c.open),
      highs: candles.map(c => c.high),
      lows: candles.map(c => c.low),
      volumes: candles.map(c => c.volume || 0)
    };
  }
}
