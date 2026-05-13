import fetch from 'node-fetch';

const p2pFee = 0.0014;
const spotFee = 0.0010;
const UMBRAL_ALERTA = 1.0; // Cambia a 0.8 o 1.2 si quieres

const TELEGRAM_TOKEN = 'PEGA_AQUI_TU_TOKEN';
const CHAT_ID = 'PEGA_AQUI_TU_CHAT_ID';

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

    return {
      usdtAsk: (await usdt.json()).ask,
      btcBid: (await btc.json()).bid,
      ethBid: (await eth.json()).bid,
      bnbBid: (await bnb.json()).bid,
      btcUSDT: parseFloat((await btcSpot.json()).price),
      ethUSDT: parseFloat((await ethSpot.json()).price),
      bnbUSDT: parseFloat((await bnbSpot.json()).price)
    };
  } catch (e) {
    console.error("Error:", e);
    return null;
  }
}

function calcularGanancia(monto, usdtAsk, coinBid, coinUSDT) {
  const ars = monto * usdtAsk * (1 - p2pFee);
  const coin = ars / coinBid;
  const usdtFinal = coin * coinUSDT * (1 - spotFee);
  return ((usdtFinal - monto) / monto) * 100;
}

async function enviarTelegram(mensaje) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: mensaje, parse_mode: 'HTML' })
    });
  } catch (e) { console.error("Error Telegram", e); }
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

  let mensaje = `🚨 <b>OPORTUNIDAD DE ARBITRAJE</b>\n\n`;
  let hayOportunidad = false;

  for (const coin of monedas) {
    const porc = calcularGanancia(monto, data.usdtAsk, coin.bid, coin.usdt);
    if (porc >= UMBRAL_ALERTA) {
      mensaje += `🔹 <b>${coin.nombre}</b>: <b>${porc.toFixed(2)}%</b>\n`;
      hayOportunidad = true;
    }
  }

  if (hayOportunidad) {
    mensaje += `\n💰 Monto: ${monto} USDT\n📊 USDT ARS: ${data.usdtAsk.toFixed(2)}`;
    await enviarTelegram(mensaje);
    console.log(`✅ Alerta enviada - ${new Date().toLocaleTimeString()}`);
  }
}

// Ejecutar cada 25 segundos
setInterval(chequear, 25000);
chequear();

console.log("🤖 Bot de arbitraje iniciado correctamente...");