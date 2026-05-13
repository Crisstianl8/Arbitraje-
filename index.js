import fetch from 'node-fetch';

const p2pFee = 0.0014;
const spotFee = 0.0010;
const UMBRAL_ALERTA = 0.6;   // Muy bajo para probar

const TELEGRAM_TOKEN = 'T8995387228:AAEcAXLBykO7KybrnIkDpNSS-eax1wVOEO4';
const CHAT_ID = '1385846402';

async function obtenerPrecios() {
  try {
    const responses = await Promise.all([
      fetch('https://criptoya.com/api/binancep2p/USDT/ARS/0.0063'),
      fetch('https://criptoya.com/api/binancep2p/ETH/ARS/0.22'),
      fetch('https://criptoya.com/api/binancep2p/BNB/ARS/0.75'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
    ]);

    const [usdtData, ethP2P, bnbP2P, ethSpotData, bnbSpotData] = await Promise.all(
      responses.map(r => r.json())
    );

    const data = {
      usdtAsk: Number(usdtData.ask || usdtData.price),
      ethBid: Number(ethP2P.bid || ethP2P.price),
      bnbBid: Number(bnbP2P.bid || bnbP2P.price),
      ethUSDT: Number(ethSpotData.price),
      bnbUSDT: Number(bnbSpotData.price)
    };

    console.log(`📊 USDT Ask: ${data.usdtAsk}`);
    console.log(`📊 ETH Bid: ${data.ethBid} | ETH Spot: ${data.ethUSDT}`);
    console.log(`📊 BNB Bid: ${data.bnbBid} | BNB Spot: ${data.bnbUSDT}`);

    return data;
  } catch (e) {
    console.error("❌ Error grave:", e.message);
    return null;
  }
}

function calcularGanancia(monto, usdtAsk, coinBid, coinUSDT, nombre) {
  if (!usdtAsk || !coinBid || !coinUSDT || isNaN(usdtAsk) || isNaN(coinBid) || isNaN(coinUSDT)) {
    console.log(`❌ ${nombre} → Datos inválidos (NaN)`);
    return 0;
  }

  const arsNeto = monto * usdtAsk * (1 - p2pFee);
  const coinComprado = arsNeto / coinBid;
  const usdtFinal = coinComprado * coinUSDT * (1 - spotFee);
  const porcentaje = ((usdtFinal - monto) / monto) * 100;

  console.log(`   ${nombre}: ${porcentaje.toFixed(3)}%`);
  return porcentaje;
}

async function enviarTelegram(mensaje) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: mensaje, parse_mode: 'HTML' })
    });
    console.log("✅ MENSAJE ENVIADO A TELEGRAM");
  } catch (e) {
    console.error("❌ Error Telegram:", e.message);
  }
}

async function chequear() {
  const data = await obtenerPrecios();
  if (!data) return;

  const monto = 1000;
  let mensaje = `🚨 <b>OPORTUNIDAD DE ARBITRAJE</b>\n\n`;
  let hayOportunidad = false;

  // Solo ETH y BNB (los que estás viendo ganancia)
  const monedas = [
    { nombre: "ETH", bid: data.ethBid, usdt: data.ethUSDT },
    { nombre: "BNB", bid: data.bnbBid, usdt: data.bnbUSDT }
  ];

  for (const coin of monedas) {
    const porc = calcularGanancia(monto, data.usdtAsk, coin.bid, coin.usdt, coin.nombre);
    if (porc >= UMBRAL_ALERTA) {
      mensaje += `🔹 <b>${coin.nombre}</b>: <b>${porc.toFixed(2)}%</b>\n`;
      hayOportunidad = true;
    }
  }

  if (hayOportunidad) {
    mensaje += `\n💰 Monto: ${monto} USDT\n📊 USDT ARS: ${data.usdtAsk.toFixed(2)}`;
    await enviarTelegram(mensaje);
  } else {
    console.log(`⏳ Sin oportunidades > ${UMBRAL_ALERTA}%`);
  }
}

setInterval(chequear, 15000);
chequear();

console.log("🤖 Bot iniciado correctamente...");
