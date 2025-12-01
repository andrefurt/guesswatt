// TESTE SIMPLES - Copia e cola na consola do browser (F12 → Console)
// Aguarda 2 segundos para o módulo carregar, depois executa

setTimeout(async () => {
  console.log('=== TEST 1: App State ===');
  console.log('GuessWatt exists:', typeof GuessWatt !== 'undefined');
  
  if (typeof GuessWatt === 'undefined') {
    console.error('❌ GuessWatt não está disponível. Verifica erros na consola.');
    return;
  }
  
  console.log('Data loaded:', GuessWatt?.state?.dataLoaded);
  console.log('Prices count:', GuessWatt?.state?.prices?.length);
  console.log('Conditions count:', GuessWatt?.state?.conditions?.size);
  
  // TEST 2: Se dados não carregaram, forçar load
  if (!GuessWatt.state.dataLoaded) {
    console.log('\n=== TEST 2: Force Load ===');
    try {
      await GuessWatt.loadData();
      console.log('After load - Prices:', GuessWatt.state.prices.length);
      console.log('After load - Conditions:', GuessWatt.state.conditions.size);
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err);
    }
  }
  
  // TEST 3: Verificar estrutura dos dados
  if (GuessWatt.state.prices.length > 0) {
    console.log('\n=== TEST 3: Data Structure ===');
    console.log('First price row:', GuessWatt.state.prices[0]);
    const firstCondition = [...GuessWatt.state.conditions.entries()][0];
    console.log('First condition:', firstCondition);
  }
  
  // TEST 4: Testar cálculo manual
  console.log('\n=== TEST 4: Manual Calculation ===');
  GuessWatt.state.monthlyBill = 95;
  GuessWatt.state.consumption = 250;
  GuessWatt.state.power = 4.6;
  GuessWatt.state.tariffType = 1;
  GuessWatt.state.offPeakPercent = 0.35;
  
  try {
    GuessWatt.runComparison();
    console.log('Results count:', GuessWatt.state.results.length);
    console.log('Best offer:', GuessWatt.state.bestOffer);
    console.log('Stats:', GuessWatt.state.stats);
  } catch (err) {
    console.error('❌ Erro no cálculo:', err);
  }
  
  // TEST 5: Se results = 0, verificar filtros
  if (GuessWatt.state.results.length === 0 && GuessWatt.state.prices.length > 0) {
    console.log('\n=== TEST 5: Filter Debug ===');
    const testPower = 4.6;
    const matchingPrices = GuessWatt.state.prices.filter(p => {
      const power = parseFloat(String(p.Pot_Cont || '').replace(',', '.'));
      return Math.abs(power - testPower) < 0.01;
    });
    console.log('Prices matching power 4.6:', matchingPrices.length);
    console.log('Sample matching price:', matchingPrices[0]);
    
    const uniquePowers = [...new Set(GuessWatt.state.prices.map(p => p.Pot_Cont))];
    console.log('Unique power values in CSV:', uniquePowers.slice(0, 10));
    
    const uniqueTariffs = [...new Set(GuessWatt.state.prices.map(p => p.Contagem))];
    console.log('Unique tariff types (Contagem):', uniqueTariffs);
  }
}, 2000);

