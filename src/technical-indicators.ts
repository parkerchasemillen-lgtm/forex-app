export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export class TechnicalIndicators {
  /**
   * Simple Moving Average
   */
  static sma(prices: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  /**
   * Exponential Moving Average
   */
  static ema(prices: number[], period: number): number[] {
    const result: number[] = [];
    const k = 2 / (period + 1);
    let emaValue: number | null = null;

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else if (i === period - 1) {
        emaValue = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        result.push(emaValue);
      } else {
        emaValue = prices[i] * k + emaValue! * (1 - k);
        result.push(emaValue);
      }
    }
    return result;
  }

  /**
   * Relative Strength Index
   */
  static rsi(prices: number[], period: number = 14): number[] {
    const result: number[] = [];
    const changes: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
      const change = changes[i];
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;

    result.push(NaN);

    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      if (change > 0) avgGain = (avgGain * (period - 1) + change) / period;
      else avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;

      const rs = avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      result.push(rsi);
    }

    return result;
  }

  /**
   * Average True Range (Volatility)
   */
  static atr(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number[] {
    const result: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 0; i < highs.length; i++) {
      let tr: number;
      if (i === 0) {
        tr = highs[i] - lows[i];
      } else {
        const val1 = highs[i] - lows[i];
        const val2 = Math.abs(highs[i] - closes[i - 1]);
        const val3 = Math.abs(lows[i] - closes[i - 1]);
        tr = Math.max(val1, val2, val3);
      }
      trueRanges.push(tr);
    }

    let atrValue = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(NaN);

    for (let i = period; i < trueRanges.length; i++) {
      atrValue = (atrValue * (period - 1) + trueRanges[i]) / period;
      result.push(atrValue);
    }

    return result;
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  static macd(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
    const ema12 = this.ema(prices, 12);
    const ema26 = this.ema(prices, 26);

    const macdLine: number[] = [];
    for (let i = 0; i < ema12.length; i++) {
      if (!isNaN(ema12[i]) && !isNaN(ema26[i])) {
        macdLine.push(ema12[i] - ema26[i]);
      } else {
        macdLine.push(NaN);
      }
    }

    const signal = this.ema(macdLine, 9);
    const histogram: number[] = [];

    for (let i = 0; i < macdLine.length; i++) {
      if (!isNaN(macdLine[i]) && !isNaN(signal[i])) {
        histogram.push(macdLine[i] - signal[i]);
      } else {
        histogram.push(NaN);
      }
    }

    return { macd: macdLine, signal, histogram };
  }

  /**
   * Bollinger Bands
   */
  static bollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = this.sma(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (isNaN(middle[i])) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle[i], 2), 0) / period;
        const std = Math.sqrt(variance);

        upper.push(middle[i] + std * stdDev);
        lower.push(middle[i] - std * stdDev);
      }
    }

    return { upper, middle, lower };
  }
}
