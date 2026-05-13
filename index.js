import fetch from 'node-fetch';

const p2pFee = 0.0014;
const spotFee = 0.0010;
const UMBRAL_ALERTA = 0.8; // Bajado a 0.8% para probar más fácil

const TELEGRAM_TOKEN = '8995387228:AAEcAXLBykO7KybrnIkDpNSS-eax1wVOEO4';
const CHAT_ID = '1385846402';

async function obtenerPrecios() {
  try {
    const [usdt, btc, eth, bnb, btcSpot, ethSpot, bnbSpot] = await Promise.all([
      fetch('https://criptoya.com/api/binancep2p/USDT/ARS/0.0063'),
      fetch('https://criptoya.com/api/binancep2p/BTC/ARS/0.0063'),
      fetch('https://criptoya.com/api/binancep2p/ETH/ARS/0.22'),
      fetch('https://criptoya.com/api/binancep2p/BNB/ARS/0.75'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
    ]);

    const data = {
      usdtAsk: (await usdt.json()).ask,
      btcBid: (await btc.json()).bid,
      ethBid: (await eth.json()).bid,
      bnbBid: (await bnb.json()).bid,
      btcUSDT: parseFloat((await btcSpot.json()).price),
      ethUSDT: parseFloat((await ethSpot.json()).price),
      bnbUSDT: parseFloat((await bnbSpot.json()).price)
    };

    console.log(`📊 Precios actualizados - USDT: ${data.usdtAsk.toFixed(2)} ARS`);
    return data;
  } catch (e) {
    console.error("❌ Error obteniendo precios:", e.message);
    return null;
  }
}

function calcularGanancia(monto, usdtAsk, coinBid, coinUSDT) {
  const ars = monto * usdtAsk * (1 - p2pFee);
  const coin = ars / coinBid;
  const usdtFinal = coin * coinUSDT * (1 - spotFee);
  const porcentaje = ((usdtFinal - monto) / monto) * 100;
  return porcentaje;
}

async function enviarTelegram(mensaje) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: CHAT_ID, 
        text: mensaje, 
        parse_mode: 'HTML' 
      })
    });
    
    const result = await response.json();
    console.log("📨 Telegram response:", result);
    return result;
  } catch (e) {
    console.error("❌ Error enviando Telegram:", e.message);
  }
}

async function chequear() {
  const data = await obtenerPrecios();
  if (!data) return;

  const monto = 1000;
  const monedas = [
    { nombre: "BTC", bid: data.btcBid, usdt: data.btcUSDT },
    { nombre: "ETH", bid: data.ethBid, usdt: data.ethUSDT },
    { nombre: "BNB", bid: data.bnbBid, usdt: data.bnbUSDT }
  ];

  console.log(`🔍 Buscando oportunidades > ${UMBRAL_ALERTA}%...`);

  let hayOportunidad = false;
  let mensaje = `🚨 <b>OPORTUNIDAD DE ARBITRAJE</b>\n\n`;

  for (const coin of monedas) {
    const porc = calcularGanancia(monto, data.usdtAsk, coin.bid, coin.usdt);
    console.log(`   ${coin.nombre}: ${porc.toFixed(3)}%`);

    if (porc >= UMBRAL_ALERTA) {
      mensaje += `🔹 <b>${coin.nombre}</b>: <b>${porc.toFixed(2)}%</b>\n`;
      hayOportunidad = true;
    }
  }

  if (hayOportunidad) {
    mensaje += `\n💰 Monto: ${monto} USDT\n📊 USDT → ARS: ${data.usdtAsk.toFixed(2)}`;
    console.log("🚀 Enviando alerta a Telegram...");
    await enviarTelegram(mensaje);
  } else {
    console.log("⏳ No hay oportunidades suficientes en este momento.");
  }
}

// Ejecutar cada 20 segundos
setInterval(chequear, 20000);
chequear();

console.log("🤖 Bot de arbitraje iniciado correctamente...");
