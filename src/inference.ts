import { ForexDataLoader } from './data-loader';
import { TechnicalIndicators } from './technical-indicators';
import { MarketStructureAnalyzer, MarketStructure } from './market-structure';

export interface PopPrediction {
  popPredicted: boolean;
  popProbability: number;
  confidence: number;
  marketStructure: MarketStructure;
  alert: {
    shouldAlert: boolean;
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export class HybridForexPredictor {
  private loader: ForexDataLoader;
  private structureAnalyzer: MarketStructureAnalyzer;
  private volatilityThreshold = 0.015;

  constructor() {
    this.loader = new ForexDataLoader();
    this.structureAnalyzer = new MarketStructureAnalyzer();
  }

  async predict(): Promise<PopPrediction> {
    // Fetch data
    const candles = await this.loader.getHistoricalData('EUR/USD', '1h');
    const priceArrays = this.loader.extractPriceArrays(candles);

    // Calculate indicators
    const sma20 = TechnicalIndicators.sma(priceArrays.closes, 20);
    const sma50 = TechnicalIndicators.sma(priceArrays.closes, 50);
    const rsi = TechnicalIndicators.rsi(priceArrays.closes, 14);
    const macdResult = TechnicalIndicators.macd(priceArrays.closes);
    const atr = TechnicalIndicators.atr(priceArrays.highs, priceArrays.lows, priceArrays.closes, 14);
    const bbands = TechnicalIndicators.bollingerBands(priceArrays.closes, 20);

    // Pop detection
    const currentPrice = priceArrays.closes[priceArrays.closes.length - 1];
    const currentAtr = atr[atr.length - 1];
    const volatility = currentAtr / currentPrice;

    const volatilityArray = atr.map((a, i) => a / priceArrays.closes[i]);
    const volatilityMa = this.calculateMA(volatilityArray, 20);
    const volatilityStd = this.calculateStd(volatilityArray, 20);

    const zScore = (volatility - volatilityMa) / volatilityStd;
    const popProbability = Math.min(1, Math.max(0, zScore / 3) * 0.5 + 0.5);

    const popPredicted = popProbability > 0.5;

    // Market structure analysis
    const marketStructure = this.structureAnalyzer.analyze(
      priceArrays.closes,
      priceArrays.highs,
      priceArrays.lows,
      atr,
      rsi,
      macdResult.macd,
      macdResult.signal
    );

    // Generate alert
    const shouldAlert = popPredicted && popProbability > 0.7;
    const severity =
      popProbability > 0.8 ? 'HIGH' : popPredicted ? 'MEDIUM' : 'LOW';
    const message = this.generateAlertMessage(popProbability, marketStructure);

    return {
      popPredicted,
      popProbability,
      confidence: Math.max(popProbability, 1 - popProbability),
      marketStructure,
      alert: {
        shouldAlert,
        message,
        severity
      }
    };
  }

  private calculateMA(values: number[], period: number): number {
    const filtered = values.filter(v => !isNaN(v));
    const recent = filtered.slice(-period);
    return recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  }

  private calculateStd(values: number[], period: number): number {
    const filtered = values.filter(v => !isNaN(v));
    const recent = filtered.slice(-period);
    if (recent.length === 0) return 0;

    const ma = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - ma, 2), 0) / recent.length;
    return Math.sqrt(variance);
  }

  private generateAlertMessage(popProb: number, structure: MarketStructure): string {
    return (
      `🚨 Pop Alert: ${(popProb * 100).toFixed(1)}% confidence. ` +
      `Trend: ${structure.trend}, ` +
      `Zone: ${structure.priceZone}, ` +
      `Momentum: ${structure.momentum}`
    );
  }
}
