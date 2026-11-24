
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ===================================
// CONFIGURACION
// ===================================

const {
  PORT = 3000,
  CHANNEL_ID,
  READ_API_KEY,
  TALKBACK_ID,
  TALKBACK_API_KEY
} = process.env;

// Validar variables necesarias
if (
  !CHANNEL_ID ||
  !TALKBACK_ID ||
  !TALKBACK_API_KEY
) {
  throw new Error(
    "Faltan variables de configuracion en el archivo .env"
  );
}

// ===================================
// CONSULTAR ESTADO DE THINGSPEAK
// ===================================

app.get("/api/estado", async (req, res) => {

  try {

    const url = new URL(
      `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json`
    );

    // Agregar clave de lectura si existe
    if (READ_API_KEY) {
      url.searchParams.set("api_key", READ_API_KEY);
    }

    console.log("Consultando ThingSpeak...");

    const respuesta = await fetch(url);

    const texto = await respuesta.text();

    console.log("HTTP ThingSpeak:", respuesta.status);

    if (!respuesta.ok) {
      throw new Error(
        `ThingSpeak respondio HTTP ${respuesta.status}: ${texto}`
      );
    }

    const data = JSON.parse(texto);

    console.log("Datos recibidos:", data);

    // Verificar si existen registros
    if (!data.created_at) {
      return res.status(404).json({
        error: "No existen registros en ThingSpeak",
        respuesta: data
      });
    }

    // Convertir datos a formato de la aplicacion
    const estado = {

      fecha: data.created_at,

      lleno: data.field1 === "1",

      bomba: data.field2 === "1",

      caudal: Number(data.field3 ?? 0),

      litros: Number(data.field4 ?? 0),

      automatico: data.field5 === "1",

      alarma: data.field6 === "1"

    };

    console.log("Estado enviado:", estado);

    res.json(estado);

  } catch (error) {

    console.error(
      "ERROR AL CONSULTAR THINGSPEAK:",
      error.message
    );

    res.status(502).json({

      error: "No se pudo consultar el estado",

      detalle: error.message

    });

  }

});

// ===================================
// ENVIAR COMANDOS A TALKBACK
// ===================================

app.post("/api/control", async (req, res) => {

  const { comando } = req.body || {};

  // Validar comando
  if (!["AUTO", "ON", "OFF"].includes(comando)) {

    return res.status(400).json({

      error: "Comando invalido",

      comandosPermitidos: ["AUTO", "ON", "OFF"]

    });

  }

  try {

    const url =
      `https://api.thingspeak.com/talkbacks/${TALKBACK_ID}/commands.json`;

    // Preparar datos
    const body = new URLSearchParams({

      api_key: TALKBACK_API_KEY,

      command_string: comando

    });

    console.log("Enviando comando:", comando);

    const respuesta = await fetch(url, {

      method: "POST",

      headers: {

        "Content-Type":
          "application/x-www-form-urlencoded"

      },

      body: body

    });

    const texto = await respuesta.text();

    console.log("HTTP TalkBack:", respuesta.status);

    if (!respuesta.ok) {

      throw new Error(
        `TalkBack respondio HTTP ${respuesta.status}: ${texto}`
      );

    }

    let data;

    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error(
        "Respuesta de TalkBack no es JSON: " + texto
      );
    }

    console.log("Respuesta TalkBack:", data);

    res.status(202).json({

      mensaje: "Comando enviado correctamente",

      comando: comando,

      id: data.id

    });

  } catch (error) {

    console.error(
      "ERROR AL ENVIAR COMANDO:",
      error.message
    );

    res.status(502).json({

      error: "No se pudo enviar el comando",

      detalle: error.message

    });

  }

});

// ===================================
// RUTA PRINCIPAL
// ===================================

app.get("/", (req, res) => {

  res.json({

    mensaje: "API de llenado automatico funcionando",

    estado: "/api/estado",

    control: "/api/control"

  });

});

// ===================================
// INICIAR SERVIDOR
// ===================================

app.listen(PORT, () => {

  console.log("--------------------------------");

  console.log("API DE LLENADO AUTOMATICO");

  console.log(`Servidor iniciado en puerto ${PORT}`);


  console.log("--------------------------------");

});
