import { TechnicalIndicators } from './technical-indicators';

export interface MarketStructure {
  trend: 'UP' | 'DOWN';
  trendStrength: number;
  support: number;
  resistance: number;
  midPoint: number;
  regime: 'TRENDING' | 'RANGING';
  priceZone: 'NEAR_RESISTANCE' | 'NEAR_SUPPORT' | 'MID_RANGE';
  momentum: 'BULLISH' | 'BEARISH';
  rsiStatus: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  currentPrice: number;
  distanceToResistance: number;
  distanceToSupport: number;
  volatility: number;
  atr: number;
}

export class MarketStructureAnalyzer {
  analyze(
    closes: number[],
    highs: number[],
    lows: number[],
    atrs: number[],
    rsis: number[],
    macds: number[],
    macdSignals: number[]
  ): MarketStructure {
    const lookback = 50;
    const recent = {
      closes: closes.slice(-lookback),
      highs: highs.slice(-lookback),
      lows: lows.slice(-lookback),
      atrs: atrs.slice(-lookback),
      rsis: rsis.slice(-lookback),
      macds: macds.slice(-lookback),
      macdSignals: macdSignals.slice(-lookback)
    };

    const currentPrice = closes[closes.length - 1];
    const sma50 = TechnicalIndicators.sma(closes, 50)[closes.length - 1];

    // 1. Trend
    const trend = currentPrice > sma50 ? 'UP' : 'DOWN';
    const trendStrength = Math.abs(currentPrice - sma50) / currentPrice;

    // 2. Support & Resistance
    const support = Math.min(...recent.lows);
    const resistance = Math.max(...recent.highs);
    const midPoint = (support + resistance) / 2;

    // 3. Market Regime
    const currentAtr = atrs[atrs.length - 1];
    const volatility = currentAtr / currentPrice;
    const regime = volatility > 0.01 ? 'TRENDING' : 'RANGING';

    // 4. Price Position
    const priceRange = resistance - support;
    const pricePosition = (currentPrice - support) / priceRange;

    let priceZone: 'NEAR_RESISTANCE' | 'NEAR_SUPPORT' | 'MID_RANGE';
    if (pricePosition > 0.7) {
      priceZone = 'NEAR_RESISTANCE';
    } else if (pricePosition < 0.3) {
      priceZone = 'NEAR_SUPPORT';
    } else {
      priceZone = 'MID_RANGE';
    }

    // 5. Momentum
    const currentMacd = macds[macds.length - 1];
    const currentSignal = macdSignals[macdSignals.length - 1];
    const momentum = currentMacd > currentSignal ? 'BULLISH' : 'BEARISH';

    // 6. RSI Status
    const currentRsi = rsis[rsis.length - 1];
    let rsiStatus: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    if (currentRsi > 70) {
      rsiStatus = 'OVERBOUGHT';
    } else if (currentRsi < 30) {
      rsiStatus = 'OVERSOLD';
    } else {
      rsiStatus = 'NEUTRAL';
    }

    return {
      trend,
      trendStrength,
      support,
      resistance,
      midPoint,
      regime,
      priceZone,
      momentum,
      rsiStatus,
      currentPrice,
      distanceToResistance: (resistance - currentPrice) / currentPrice,
      distanceToSupport: (currentPrice - support) / currentPrice,
      volatility,
      atr: currentAtr
    };
  }
}
