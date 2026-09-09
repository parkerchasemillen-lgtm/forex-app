import { HybridForexPredictor } from './inference';

async function main() {
  console.log('\n🚀 Starting Forex Hybrid Model...\n');

  const predictor = new HybridForexPredictor();

  // Make single prediction
  console.log('📊 Running prediction...\n');
  const result = await predictor.predict();

  console.log('========================================');
  console.log('        PREDICTION RESULT');
  console.log('========================================\n');
  console.log(`✅ Pop Predicted: ${result.popPredicted}`);
  console.log(`📈 Probability: ${(result.popProbability * 100).toFixed(2)}%`);
  console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(2)}%`);

  console.log('\n========================================');
  console.log('        ALERT INFORMATION');
  console.log('========================================\n');
  console.log(result.alert.message);
  console.log(`🚨 Severity: ${result.alert.severity}`);
  console.log(`📢 Should Alert: ${result.alert.shouldAlert}`);

  console.log('\n========================================');
  console.log('        MARKET STRUCTURE');
  console.log('========================================\n');
  console.log(`📊 Current Price: ${result.marketStructure.currentPrice.toFixed(5)}`);
  console.log(`📈 Trend: ${result.marketStructure.trend}`);
  console.log(`💪 Trend Strength: ${(result.marketStructure.trendStrength * 100).toFixed(2)}%`);
  console.log(`🔴 Support: ${result.marketStructure.support.toFixed(5)}`);
  console.log(`🟢 Resistance: ${result.marketStructure.resistance.toFixed(5)}`);
  console.log(`📍 Price Zone: ${result.marketStructure.priceZone}`);
  console.log(`🔄 Regime: ${result.marketStructure.regime}`);
  console.log(`⬆️  Momentum: ${result.marketStructure.momentum}`);
  console.log(`📊 RSI Status: ${result.marketStructure.rsiStatus}`);
  console.log(`💨 Volatility: ${(result.marketStructure.volatility * 100).toFixed(3)}%`);
  console.log(`📏 ATR: ${result.marketStructure.atr.toFixed(5)}`);
  console.log(`📐 Distance to Resistance: ${(result.marketStructure.distanceToResistance * 100).toFixed(2)}%`);
  console.log(`📐 Distance to Support: ${(result.marketStructure.distanceToSupport * 100).toFixed(2)}%`);

  console.log('\n========================================');
  console.log('        REAL-TIME MONITORING');
  console.log('========================================\n');
  console.log('✅ Monitoring enabled - checking every 60 seconds...\n');

  // Monitor every 60 seconds
  let checkCount = 0;
  setInterval(async () => {
    checkCount++;
    const currentResult = await predictor.predict();

    console.log(`\n[Check ${checkCount}] ${new Date().toLocaleTimeString()}`);
    console.log(`Pop Probability: ${(currentResult.popProbability * 100).toFixed(2)}%`);

    if (currentResult.alert.shouldAlert) {
      console.log('\n' + '='.repeat(40));
      console.log('🚨 🚨 🚨 ALERT TRIGGERED! 🚨 🚨 🚨');
      console.log('='.repeat(40));
      console.log(currentResult.alert.message);
      console.log(`💰 Current Price: ${currentResult.marketStructure.currentPrice.toFixed(5)}`);
      console.log(`🎯 Severity: ${currentResult.alert.severity}`);
      console.log('='.repeat(40) + '\n');
    }
  }, 60000); // Every 60 seconds
}

main().catch(console.error);
