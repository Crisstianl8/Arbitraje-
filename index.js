import fetch from 'node-fetch';

const p2pFee = 0.0014;
const spotFee = 0.0010;
const UMBRAL_ALERTA = 0.7;   // Bajado para que salte más fácil

const TELEGRAM_TOKEN = '8995387228:AAEcAXLBykO7KybrnIkDpNSS-eax1wVOEO4';
const CHAT_ID = '1385846402';

async function obtenerPrecios() {
  try {
    const [usdtRes, btcRes, ethRes, bnbRes, btcSpotRes, ethSpotRes, bnbSpotRes] = await Promise.all([
      fetch('https://criptoya.com/api/binancep2p/USDT/ARS/0.0063'),
      fetch('https://criptoya.com/api/binancep2p/BTC/ARS/0.0063'),
      fetch('https://criptoya.com/api/binancep2p/ETH/ARS/0.22'),
      fetch('https://criptoya.com/api/binancep2p/BNB/ARS/0.75'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
    ]);

    const usdtData = await usdtRes.json();
    const btcData = await btcRes.json();
    const ethData = await ethRes.json();
    const bnbData = await bnbRes.json();

    const data = {
      usdtAsk: Number(usdtData.ask || usdtData.price),
      btcBid: Number(btcData.bid || btcData.price),
      ethBid: Number(ethData.bid || ethData.price),
      bnbBid: Number(bnbData.bid || bnbData.price),
      btcUSDT: Number((await btcSpotRes.json()).price),
      ethUSDT: Number((await ethSpotRes.json()).price),
      bnbUSDT: Number((await bnbSpotRes.json()).price)
    };

    console.log(`📊 USDT: ${data.usdtAsk.toFixed(2)} | ETH Bid: ${data.ethBid.toLocaleString('es-AR')}`);

    return data;
  } catch (e) {
    console.error("❌ Error precios:", e.message);
    return null;
  }
}

function calcularGanancia(monto, usdtAsk, coinBid, coinUSDT, nombre) {
  try {
    const ars = monto * usdtAsk * (1 - p2pFee);
    const coin = ars / coinBid;
    const usdtFinal = coin * coinUSDT * (1 - spotFee);
    const porcentaje = ((usdtFinal - monto) / monto) * 100;

    console.log(`   ${nombre}: ${porcentaje.toFixed(3)}%`);
    return porcentaje;
  } catch (e) {
    console.log(`   ${nombre}: Error en cálculo`);
    return 0;
  }
}

async function enviarTelegram(mensaje) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: mensaje, parse_mode: 'HTML' })
    });
    console.log("✅ Alerta enviada correctamente a Telegram");
  } catch (e) {
    console.error("❌ Error enviando Telegram:", e.message);
  }
}

async function chequear() {
  const data = await obtenerPrecios();
  if (!data) return;

  const monto = 1000;
  let mensaje = `🚨 <b>OPORTUNIDAD DE ARBITRAJE</b>\n\n`;
  let hayOportunidad = false;

  const monedas = [
    { nombre: "ETH", bid: data.ethBid, usdt: data.ethUSDT },
    { nombre: "BNB", bid: data.bnbBid, usdt: data.bnbUSDT },
    { nombre: "BTC", bid: data.btcBid, usdt: data.btcUSDT }
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
    console.log(`⏳ No hay oportunidades > ${UMBRAL_ALERTA}%`);
  }
}

setInterval(chequear, 20000);
chequear();

console.log("🤖 Bot de arbitraje iniciado correctamente...");
