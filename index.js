import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const p2pFee = 0.0014;
const spotFee = 0.0010;

const MONTO_USDT = 1000;
const GANANCIA_MINIMA = 1; // %

let ultimaAlerta = {
  BTC: false,
  ETH: false,
  BNB: false
};

async function enviarTelegram(msg) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    await axios.post(url, {
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: "HTML"
    });

    console.log("Mensaje enviado");
  } catch (err) {
    console.error("Error Telegram:", err.message);
  }
}

async function obtenerDatos() {
  try {
    const [
      usdtRes,
      btcRes,
      ethRes,
      bnbRes,
      btcSpotRes,
      ethSpotRes,
      bnbSpotRes
    ] = await Promise.all([
      axios.get("https://criptoya.com/api/binancep2p/USDT/ARS/0.0063"),
      axios.get("https://criptoya.com/api/binancep2p/BTC/ARS/0.0063"),
      axios.get("https://criptoya.com/api/binancep2p/ETH/ARS/0.22"),
      axios.get("https://criptoya.com/api/binancep2p/BNB/ARS/0.75"),

      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"),
      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT")
    ]);

    return {
      usdtAsk: usdtRes.data.ask,

      btcBid: btcRes.data.bid,
      ethBid: ethRes.data.bid,
      bnbBid: bnbRes.data.bid,

      btcUSDT: parseFloat(btcSpotRes.data.price),
      ethUSDT: parseFloat(ethSpotRes.data.price),
      bnbUSDT: parseFloat(bnbSpotRes.data.price)
    };
  } catch (err) {
    console.error("Error obteniendo datos:", err.message);
    return null;
  }
}

function calcularArbitraje(
  montoInicial,
  usdtAsk,
  coinBid,
  coinUSDT
) {
  const ars = montoInicial * usdtAsk * (1 - p2pFee);

  const coin = ars / coinBid;

  const usdtFinal = coin * coinUSDT * (1 - spotFee);

  const ganancia = usdtFinal - montoInicial;

  const porcentaje = (ganancia / montoInicial) * 100;

  return {
    usdtFinal,
    ganancia,
    porcentaje
  };
}

async function revisar() {
  console.log("Revisando oportunidades...");

  const data = await obtenerDatos();

  if (!data) return;

  const monedas = [
    {
      nombre: "BTC",
      bid: data.btcBid,
      usdt: data.btcUSDT
    },
    {
      nombre: "ETH",
      bid: data.ethBid,
      usdt: data.ethUSDT
    },
    {
      nombre: "BNB",
      bid: data.bnbBid,
      usdt: data.bnbUSDT
    }
  ];

  for (const moneda of monedas) {
    const r = calcularArbitraje(
      MONTO_USDT,
      data.usdtAsk,
      moneda.bid,
      moneda.usdt
    );

    console.log(
      `${moneda.nombre}: ${r.porcentaje.toFixed(2)}%`
    );

    if (r.porcentaje >= GANANCIA_MINIMA) {

      if (!ultimaAlerta[moneda.nombre]) {

        ultimaAlerta[moneda.nombre] = true;

        const mensaje = `
🚨 <b>ARBITRAJE DETECTADO</b>

🪙 Moneda: <b>${moneda.nombre}</b>

💰 Ganancia:
<b>${r.porcentaje.toFixed(2)}%</b>

📈 USDT Final:
${r.usdtFinal.toFixed(2)}

💵 Ganancia:
${r.ganancia.toFixed(2)} USDT
`;

        await enviarTelegram(mensaje);
      }

    } else {

      ultimaAlerta[moneda.nombre] = false;

    }
  }
}

console.log("Bot iniciado...");

revisar();

setInterval(revisar, 15000);
