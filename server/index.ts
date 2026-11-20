
import express from "express";
import cors from "cors";
import screenshot from "screenshot-desktop";
import { createWorker } from "tesseract.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const robot = require("robotjs");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "1mb" }));

type Mode = "observe" | "execute";

interface OCRWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

let running = false;
let mode: Mode = "observe";

let latest: {
  status: string;
  text: OCRWord[];
  image: string | null;
  events: { time: string; message: string }[];
} = {
  status: "idle",
  text: [],
  image: null,
  events: [],
};

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

const log = (message: string) => {
  latest.events = [
    { time: new Date().toISOString(), message },
    ...latest.events,
  ].slice(0, 100);
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────
// OCR: PARSER TSV
// ─────────────────────────────────────

function parseTSV(tsv: string): OCRWord[] {
  return tsv
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const cols = line.split("\t");

      return {
        level: Number(cols[0]),
        text: cols.slice(11).join("\t").trim(),
        confidence: Number(cols[10]),
        x: Number(cols[6]),
        y: Number(cols[7]),
        width: Number(cols[8]),
        height: Number(cols[9]),
      };
    })
    .filter(
      (word) =>
        word.level === 5 &&
        word.text.length > 0 &&
        word.confidence > 45 &&
        Number.isFinite(word.x) &&
        Number.isFinite(word.y) &&
        Number.isFinite(word.width) &&
        Number.isFinite(word.height)
    )
    .map(({ level, ...word }) => word);
}

// ─────────────────────────────────────
// SCREEN CAPTURE + OCR
// ─────────────────────────────────────

async function capture() {
  const buffer = await screenshot({ format: "png" });

  if (!worker) {
    worker = await createWorker("eng");
  }

  const result = await worker.recognize(
    buffer,
    {},
    { tsv: true }
  );

  latest.image =
    `data:image/png;base64,${buffer.toString("base64")}`;

  latest.text = parseTSV(result.data.tsv ?? "");

  log(`Captura: ${latest.text.length} palabras reconocidas`);
}

// ─────────────────────────────────────
// API: STATE
// ─────────────────────────────────────

app.get("/api/state", (_req, res) => {
  res.json(latest);
});

// ─────────────────────────────────────
// API: OBSERVE
// ─────────────────────────────────────

app.post("/api/observe", async (_req, res) => {
  if (running) {
    return res.status(409).json({
      error: "Motor ocupado",
    });
  }

  running = true;
  latest.status = "observing";

  try {
    await capture();

    latest.status = "idle";

    res.json({ ok: true });
  } catch (error) {
    latest.status = "error";

    res.status(500).json({
      error: String(error),
    });
  } finally {
    running = false;
  }
});

// ─────────────────────────────────────
// API: ACTION
// ─────────────────────────────────────

app.post("/api/action", async (req, res) => {
  if (running) {
    return res.status(409).json({
      error: "Motor ocupado",
    });
  }

  const { type, x, y, direction, amount, text } = req.body;

  const allowed = ["move", "click", "scroll", "type"];

  if (!allowed.includes(type)) {
    return res.status(400).json({
      error: "Acción inválida",
    });
  }

  if (mode !== "execute") {
    return res.status(403).json({
      error: "Activa el modo ejecución",
    });
  }

  running = true;
  latest.status = "acting";

  try {
    if (type === "move" || type === "click") {
      const screen = robot.getScreenSize();

      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= screen.width ||
        y >= screen.height
      ) {
        throw new Error("Coordenadas inválidas");
      }

      robot.moveMouseSmooth(x, y);

      if (type === "click") {
        robot.mouseClick();
      }
    }

    if (type === "scroll") {
      if (
        !["up", "down"].includes(direction) ||
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 8
      ) {
        throw new Error("Scroll inválido");
      }

      robot.scrollMouse(
        0,
        direction === "up" ? amount : -amount
      );
    }

    if (type === "type") {
      if (
        typeof text !== "string" ||
        text.length > 200
      ) {
        throw new Error("Texto inválido");
      }

      robot.typeString(text);
    }

    log(`Acción: ${type}`);

    await sleep(250);

    latest.status = "idle";

    res.json({ ok: true });
  } catch (error) {
    latest.status = "error";

    res.status(400).json({
      error: String(error),
    });
  } finally {
    running = false;
  }
});

// ─────────────────────────────────────
// API: MODE
// ─────────────────────────────────────

app.post("/api/mode", (req, res) => {
  mode = req.body.mode === "execute"
    ? "execute"
    : "observe";

  log(`Modo: ${mode}`);

  res.json({ mode });
});

// ─────────────────────────────────────
// API: STOP
// ─────────────────────────────────────

app.post("/api/stop", (_req, res) => {
  mode = "observe";

  log("Ejecución deshabilitada");

  res.json({ ok: true });
});

// ─────────────────────────────────────
// START SERVER
// ─────────────────────────────────────

app.listen(4317, "127.0.0.1", () => {
  console.log("VCA local: http://127.0.0.1:4317");
});
