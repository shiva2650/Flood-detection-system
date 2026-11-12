import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  assignRescueTeamInDb,
  computeDeterministicTriage,
  createCommunityMessageInDb,
  createDurableSosRequest,
  createMassAlertBroadcastInDb,
  dispatchAutomaticLocalityAlertInDb,
  getAllAlertNetState,
  getRecentPredictionHistory,
  insertPredictionRecord,
  moderateCommunityMessageInDb,
  overrideSosPriorityInDb,
  registerOrUpdateCitizenProfileInDb,
  registerVolunteerInDb,
  retryLocalizedAlertInDb,
  updateRescueMissionStatusInDb,
  updateShelterInDb,
  updateSosStatusInDb,
} from "./src/db/repository.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { DEMO_ACCOUNTS } from "./src/middleware/auth.ts";

dotenv.config();

interface SystemReliabilityState {
  instances: Array<{
    id: string;
    name: string;
    role: "Primary" | "Replica";
    status: "Healthy" | "Stopped (Failover Active)";
    uptimeSec: number;
    processedCount: number;
    cpuLoadPct: number;
  }>;
  rabbitMq: {
    status: "Connected (Durable Broker)" | "Degraded (Retry Active)";
    sosQueueDepth: number;
    notificationQueueDepth: number;
    publisherConfirms: boolean;
    ackedMessages: number;
    retryCount: number;
    dlqCount: number;
    dlqMessages: Array<{ id: string; reason: string; timestamp: string }>;
  };
  redis: {
    status: "Connected";
    cachedKeys: number;
    dedupHits: number;
    rateLimitBlocks: number;
  };
  database: {
    engine: "Cloud SQL PostgreSQL (Transactional)";
    status: "Connected";
    activePoolConnections: number;
  };
  metrics: {
    incomingSosRatePerMin: number;
    notificationThroughputPerSec: number;
    avgLatencyMs: number;
  };
}

const reliabilityState: SystemReliabilityState = {
  instances: [
    {
      id: "node-1",
      name: "alertnet-app-instance-01",
      role: "Primary",
      status: "Healthy",
      uptimeSec: 18420,
      processedCount: 142,
      cpuLoadPct: 24,
    },
    {
      id: "node-2",
      name: "alertnet-app-instance-02",
      role: "Replica",
      status: "Healthy",
      uptimeSec: 18415,
      processedCount: 138,
      cpuLoadPct: 21,
    },
  ],
  rabbitMq: {
    status: "Connected (Durable Broker)",
    sosQueueDepth: 0,
    notificationQueueDepth: 0,
    publisherConfirms: true,
    ackedMessages: 280,
    retryCount: 3,
    dlqCount: 0,
    dlqMessages: [],
  },
  redis: {
    status: "Connected",
    cachedKeys: 64,
    dedupHits: 4,
    rateLimitBlocks: 0,
  },
  database: {
    engine: "Cloud SQL PostgreSQL (Transactional)",
    status: "Connected",
    activePoolConnections: 4,
  },
  metrics: {
    incomingSosRatePerMin: 5,
    notificationThroughputPerSec: 4200,
    avgLatencyMs: 38,
  },
};

function selectActiveInstance() {
  const healthy = reliabilityState.instances.filter((i) => i.status === "Healthy");
  if (healthy.length === 0) {
    reliabilityState.instances[0].status = "Healthy";
    return reliabilityState.instances[0];
  }
  const chosen = healthy[Math.floor(Math.random() * healthy.length)];
  chosen.processedCount += 1;
  return chosen;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const PORT = Number(process.env.PORT) || 3000;

  server.on("upgrade", (req, socket, head) => {
    const pathname = req.url ? req.url.split("?")[0] : "";
    const protocol = req.headers["sec-websocket-protocol"] || "";
    if (pathname === "/ws" || protocol.includes("vite-hmr") || pathname === "/") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  app.use(express.json({ limit: "2mb" }));

  const broadcastEvent = (type: string, payload: any) => {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && (client as any).isAlertNetClient) {
        client.send(message);
      }
    });
  };

  wss.on("connection", (ws, req) => {
    const protocol = req?.headers?.["sec-websocket-protocol"] || "";
    if (protocol.includes("vite-hmr")) {
      ws.send(JSON.stringify({ type: "connected" }));
      return;
    }
    (ws as any).isAlertNetClient = true;
    ws.send(
      JSON.stringify({
        type: "system:connected",
        payload: { reliability: reliabilityState },
        timestamp: new Date().toISOString(),
      })
    );
  });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Existing Weather Endpoint (Preserved + Simulation flag)
  app.get("/api/weather", async (req, res) => {
    const { city, lat, lon } = req.query;
    const apiKey = process.env.VITE_OPENWEATHER_API_KEY;

    if (!apiKey) {
      const mockCity = String(city || "Hyderabad");
      const mockLat = lat ? Number(lat) : 17.385;
      const mockLon = lon ? Number(lon) : 78.4867;
      return res.json({
        city: mockCity,
        temp: "25.4",
        humidity: 86,
        pressure: 1002,
        rainfall: "38.50",
        description: "Heavy Rain, Overcast Clouds",
        current: {
          temp: 25.4,
          humidity: 86,
          pressure: 1002,
          windSpeed: 8.2,
          windDeg: 215,
          description: "heavy intensity rain",
          icon: "10d",
          visibility: 4500,
          timestamp: Math.floor(Date.now() / 1000),
        },
        day1: {
          temp: "24.8",
          humidity: 88,
          pressure: 1000,
          rainfall: "24.00",
          description: "Heavy Rain",
        },
        day2: {
          temp: "25.9",
          humidity: 81,
          pressure: 1005,
          rainfall: "14.50",
          description: "Moderate Rain",
        },
        coord: { lat: mockLat, lon: mockLon },
        isForecast: true,
        isSimulatedWeather: true,
        forecastPeriod: "Next 48 Hours",
      });
    }

    try {
      let forecastUrl = "";
      let currentUrl = "";

      if (lat && lon) {
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
        currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      } else if (city) {
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`;
        currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
      } else {
        return res.status(400).json({ error: "City or coordinates are required" });
      }

      const [forecastRes, currentRes] = await Promise.all([
        axios.get(forecastUrl),
        axios.get(currentUrl),
      ]);

      const forecastData = forecastRes.data;
      const currentData = currentRes.data;
      const forecast2Days = forecastData.list.slice(0, 16);
      const day1Forecast = forecast2Days.slice(0, 8);
      const day2Forecast = forecast2Days.slice(8, 16);

      const processForecast = (forecast: any[]) => {
        let totalRainfall = 0;
        let maxHumidity = 0;
        let minPressure = 2000;
        let avgTemp = 0;
        const descriptions = new Set<string>();

        forecast.forEach((item: any) => {
          totalRainfall += item.rain ? item.rain["3h"] || 0 : 0;
          if (item.main.humidity > maxHumidity) maxHumidity = item.main.humidity;
          if (item.main.pressure < minPressure) minPressure = item.main.pressure;
          avgTemp += item.main.temp;
          if (item.weather?.[0]?.main) descriptions.add(item.weather[0].main);
        });

        return {
          temp: (avgTemp / forecast.length).toFixed(1),
          humidity: maxHumidity,
          pressure: minPressure,
          rainfall: totalRainfall.toFixed(2),
          description: Array.from(descriptions).join(", "),
        };
      };

      const day1Data = processForecast(day1Forecast);
      const day2Data = processForecast(day2Forecast);
      const overallData = processForecast(forecast2Days);

      res.json({
        city: forecastData.city.name,
        ...overallData,
        current: {
          temp: currentData.main.temp,
          humidity: currentData.main.humidity,
          pressure: currentData.main.pressure,
          windSpeed: currentData.wind.speed,
          windDeg: currentData.wind.deg,
          description: currentData.weather[0].description,
          icon: currentData.weather[0].icon,
          visibility: currentData.visibility,
          timestamp: currentData.dt,
        },
        day1: day1Data,
        day2: day2Data,
        coord: forecastData.city.coord,
        isForecast: true,
        isSimulatedWeather: false,
        forecastPeriod: "Next 48 Hours",
      });
    } catch (error) {
      res.status(404).json({ error: "City not found" });
    }
  });

  // Flood Prediction Endpoint (Upgraded with 0-100 Risk Score, Low/Moderate/High/Critical classification & Cloud SQL storage)
  app.post("/api/predict", async (req, res) => {
    const { city, lat, lon, temp, humidity, rainfall, pressure, description, isSimulated } = req.body;

    const baseRiverLevel = 2.4;
    const rainVal = Number(rainfall) || 0;
    const humVal = Number(humidity) || 0;
    const pressVal = Number(pressure) || 1010;
    const tempVal = Number(temp) || 25;

    const rainImpact = rainVal * 0.065;
    const riverLevel = baseRiverLevel + rainImpact;

    let rawScore = 0;
    const factors: Array<{ factor: string; impact: "High" | "Medium" | "Low"; value: string }> = [];

    rawScore += Math.min(55, rainVal * 1.15);
    if (rainVal > 0) {
      factors.push({
        factor: "48h Cumulative Precipitation",
        impact: rainVal > 35 ? "High" : rainVal > 15 ? "Medium" : "Low",
        value: `${rainVal.toFixed(1)}mm`,
      });
    }

    rawScore += Math.max(0, (humVal - 50) * 0.3);
    if (humVal > 80) {
      factors.push({ factor: "Atmospheric Saturation", impact: "Medium", value: `${humVal}%` });
    }

    if (pressVal < 1002) {
      rawScore += 12;
      factors.push({
        factor: "Low Barometric Pressure Depression",
        impact: "Medium",
        value: `${pressVal}hPa`,
      });
    } else if (pressVal < 1008) {
      rawScore += 5;
    }

    rawScore += Math.min(25, riverLevel * 3.8);
    if (riverLevel > 4.2) {
      factors.push({
        factor: "Elevated Basin Gauge Level",
        impact: "High",
        value: `${riverLevel.toFixed(2)}m`,
      });
    } else if (riverLevel > 3.2) {
      factors.push({
        factor: "Moderate Basin Gauge Level",
        impact: "Medium",
        value: `${riverLevel.toFixed(2)}m`,
      });
    }

    const desc = (description || "").toLowerCase();
    if (desc.includes("rain") || desc.includes("storm") || desc.includes("thunderstorm")) {
      rawScore += 8;
      factors.push({ factor: "Active Convective Storm System", impact: "Medium", value: description });
    }

    const normalizedScore = Math.min(100, Math.max(5, Math.round(rawScore)));

    // 4-tier classification (Critical, High, Moderate/Medium, Low) + backward-compatible riskLevel
    let riskCategory: "Low" | "Moderate" | "High" | "Critical" = "Low";
    let riskLevel: "Low" | "Medium" | "High" = "Low";
    if (normalizedScore >= 80) {
      riskCategory = "Critical";
      riskLevel = "High";
    } else if (normalizedScore >= 60) {
      riskCategory = "High";
      riskLevel = "High";
    } else if (normalizedScore >= 35) {
      riskCategory = "Moderate";
      riskLevel = "Medium";
    }

    const confidenceScore = Math.min(98.5, 86 + normalizedScore * 0.11).toFixed(1);

    let farmerRisk = "Low";
    let farmerAdvisory =
      "Conditions are favorable for most agricultural activities. Proceed with standard operations.";

    if (riskLevel === "High") {
      farmerRisk = "Critical";
      if (rainVal > 45) {
        farmerAdvisory =
          "CRITICAL FLOOD WARNING: Immediate threat of severe crop waterlogging and topsoil erosion. Evacuate livestock to higher ground immediately. Secure all farm equipment and avoid submerged causeways.";
      } else {
        farmerAdvisory =
          "HIGH RISK: Significant threat to low-lying crops. Halt field operations, clear primary drainage channels immediately, and secure irrigation pump houses.";
      }
    } else if (riskLevel === "Medium") {
      farmerRisk = "High";
      if (rainVal > 20) {
        farmerAdvisory =
          "MODERATE FLOOD RISK with Heavy Rain: Delay all fertilizer and pesticide applications to prevent runoff. Inspect and clear secondary drainage ditches.";
      } else if (tempVal > 30) {
        farmerAdvisory =
          "MODERATE RISK with High Heat: Ensure maximum ventilation in livestock enclosures and irrigate during early morning or late evening.";
      } else {
        farmerAdvisory =
          "MODERATE RISK: Monitor low-lying fields for early signs of ponding. Keep emergency dewatering pumps fueled and ready.";
      }
    } else {
      if (rainVal > 15) {
        farmerRisk = "Medium";
        farmerAdvisory =
          "ELEVATED RAIN: Beneficial for dry soil, but monitor for localized pooling. Delay chemical spraying until foliage is dry.";
      } else if (humVal > 85 && tempVal > 25) {
        farmerRisk = "Medium";
        farmerAdvisory =
          "DISEASE ALERT: High humidity and warmth create ideal conditions for fungal blight and mildew. Scout fields closely.";
      }
    }

    try {
      await insertPredictionRecord({
        city: city || "Hyderabad",
        lat: Number(lat) || 17.385,
        lon: Number(lon) || 78.4867,
        temp: tempVal,
        humidity: humVal,
        rainfall: rainVal,
        pressure: pressVal,
        riverLevel,
        riskLevel,
        riskScore: normalizedScore,
        isSimulation: Boolean(isSimulated),
      });

      const responsePayload = {
        city,
        riskLevel,
        riskCategory,
        farmerRisk,
        farmerAdvisory,
        riverLevel: riverLevel.toFixed(2),
        score: normalizedScore.toFixed(0),
        confidenceScore,
        forecastHorizon: "48 Hours",
        contributingFactors: factors,
      };

      broadcastEvent("prediction:created", responsePayload);
      res.json(responsePayload);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Database error" });
    }
  });

  app.get("/api/history", async (_req, res) => {
    try {
      const history = await getRecentPredictionHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Database error" });
    }
  });

  // AlertNet Unified Command State
  app.get("/api/alertnet/state", async (_req, res) => {
    try {
      const data = await getAllAlertNetState();
      res.json({
        ...data,
        reliability: reliabilityState,
        demoAccounts: Object.entries(DEMO_ACCOUNTS).map(([token, info]) => ({
          token,
          ...info,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load AlertNet state" });
    }
  });

  // User Auth Sync
  app.post("/api/alertnet/auth/sync", async (req, res) => {
    const { uid, email, name, role } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ error: "uid and email are required" });
    }
    try {
      const user = await getOrCreateUser(uid, email, name, role);
      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync user" });
    }
  });

  // Citizen SOS Submission (Durable storage before ACK + Idempotency + AI Triage + Clustering)
  app.post("/api/alertnet/sos", async (req, res) => {
    const startTime = Date.now();
    const {
      idempotencyKey,
      citizenUid,
      citizenName,
      phone,
      lat,
      lon,
      region,
      category,
      peopleCount,
      severity,
      medicalNeeds,
      vulnerableGroups,
      waterDepthCm,
      description,
      mediaNote,
      isSimulated,
    } = req.body;

    if (!idempotencyKey || !citizenName || lat === undefined || lon === undefined || !category) {
      return res.status(400).json({
        error: "Missing required SOS fields (idempotencyKey, citizenName, lat, lon, category).",
      });
    }

    try {
      const activeInstance = selectActiveInstance();
      reliabilityState.rabbitMq.sosQueueDepth += 1;

      // 1. Deterministic explainable triage baseline (instant & resilient)
      const triage = computeDeterministicTriage({
        category,
        severity: severity || "High",
        peopleCount: Number(peopleCount) || 1,
        medicalNeeds,
        vulnerableGroups,
        waterDepthCm: Number(waterDepthCm) || 0,
      });

      // 2. Durable PostgreSQL insertion BEFORE acknowledging receipt
      const result = await createDurableSosRequest({
        idempotencyKey: String(idempotencyKey),
        citizenUid,
        citizenName: String(citizenName).trim(),
        phone: phone ? String(phone).trim() : undefined,
        lat: Number(lat),
        lon: Number(lon),
        region: region || "Central Basin",
        category,
        peopleCount: Math.max(1, Number(peopleCount) || 1),
        severity: severity || "High",
        medicalNeeds,
        vulnerableGroups,
        waterDepthCm: Number(waterDepthCm) || 0,
        description,
        mediaNote,
        priority: triage.priority,
        priorityScore: triage.priorityScore,
        priorityReason: triage.priorityReason,
        isSimulated: Boolean(isSimulated),
      });

      reliabilityState.rabbitMq.sosQueueDepth = Math.max(
        0,
        reliabilityState.rabbitMq.sosQueueDepth - 1
      );
      reliabilityState.rabbitMq.ackedMessages += 1;
      if (result.deduplicated) {
        reliabilityState.redis.dedupHits += 1;
      }

      const elapsed = Date.now() - startTime;
      reliabilityState.metrics.avgLatencyMs = Math.round(
        reliabilityState.metrics.avgLatencyMs * 0.8 + elapsed * 0.2
      );

      broadcastEvent("sos:created", {
        sos: result.record,
        deduplicated: result.deduplicated,
        processedBy: activeInstance.name,
        reliability: reliabilityState,
      });

      res.status(result.deduplicated ? 200 : 201).json({
        acknowledged: true,
        durableStorageConfirmed: true,
        deduplicated: result.deduplicated,
        processedByInstance: activeInstance.name,
        sos: result.record,
      });
    } catch (error: any) {
      reliabilityState.rabbitMq.retryCount += 1;
      res.status(500).json({ error: error.message || "Failed to process SOS request" });
    }
  });

  // Admin Manual Priority Override
  app.post("/api/alertnet/sos/:id/override", async (req, res) => {
    const sosId = Number(req.params.id);
    const { priority, reason, actorName, actorRole } = req.body;
    if (!sosId || !["P0", "P1", "P2", "P3"].includes(priority)) {
      return res.status(400).json({ error: "Valid SOS ID and priority (P0-P3) required" });
    }
    try {
      const updated = await overrideSosPriorityInDb({
        sosId,
        priority,
        reason: reason || "Commander operational assessment",
        actorName: actorName || "Cmdr. Rajeshwari Rao (NDMA)",
        actorRole: actorRole || "admin",
      });
      broadcastEvent("sos:updated", { sos: updated });
      res.json({ sos: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to override priority" });
    }
  });

  // Update or Cancel SOS Status
  app.post("/api/alertnet/sos/:id/status", async (req, res) => {
    const sosId = Number(req.params.id);
    const { status, description, actorName, actorRole } = req.body;
    if (!sosId || !status) {
      return res.status(400).json({ error: "SOS ID and status are required" });
    }
    try {
      const updated = await updateSosStatusInDb({
        sosId,
        status,
        description,
        actorName: actorName || "Citizen / Responder",
        actorRole: actorRole || "citizen",
      });
      broadcastEvent("sos:updated", { sos: updated });
      res.json({ sos: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update SOS status" });
    }
  });

  // Assign Rescue Team to SOS or Cluster
  app.post("/api/alertnet/teams/assign", async (req, res) => {
    const { teamId, sosId, clusterCode, actorName, actorRole } = req.body;
    if (!teamId) {
      return res.status(400).json({ error: "teamId is required" });
    }
    try {
      const updatedTeam = await assignRescueTeamInDb({
        teamId: Number(teamId),
        sosId: sosId ? Number(sosId) : undefined,
        clusterCode,
        actorName: actorName || "Cmdr. Rajeshwari Rao (NDMA)",
        actorRole: actorRole || "admin",
      });
      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.json({ team: updatedTeam, state: fullState });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to assign rescue team" });
    }
  });

  // Rescue Team Mission Status Update
  app.post("/api/alertnet/teams/:id/status", async (req, res) => {
    const teamId = Number(req.params.id);
    const { status, actorName, actorRole } = req.body;
    if (!teamId || !status) {
      return res.status(400).json({ error: "teamId and status are required" });
    }
    try {
      const updatedTeam = await updateRescueMissionStatusInDb({
        teamId,
        status,
        actorName: actorName || "Capt. Vikram Singh (NDRF Alpha-1)",
        actorRole: actorRole || "rescue",
      });
      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.json({ team: updatedTeam, state: fullState });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update mission status" });
    }
  });

  // Smart Shelter Update (with overbooking protection)
  app.post("/api/alertnet/shelters/:id", async (req, res) => {
    const shelterId = Number(req.params.id);
    const { occupiedCapacity, foodPacks, waterLiters, medicalSupplies, actorName, actorRole } =
      req.body;
    try {
      const updatedShelter = await updateShelterInDb({
        shelterId,
        occupiedCapacity: Number(occupiedCapacity),
        foodPacks: Number(foodPacks),
        waterLiters: Number(waterLiters),
        medicalSupplies: String(medicalSupplies || "Adequate"),
        actorName: actorName || "Meera Nair (Highland Relief Camp)",
        actorRole: actorRole || "shelter",
      });
      broadcastEvent("shelter:updated", { shelter: updatedShelter });
      res.json({ shelter: updatedShelter });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update shelter" });
    }
  });

  // Multi-Channel Mass Alert Broadcast (Supports 100,000+ residents simulation)
  app.post("/api/alertnet/alerts/broadcast", async (req, res) => {
    const {
      title,
      message,
      severity,
      targetRegion,
      channels,
      targetPopulation,
      isSimulation,
      actorName,
      actorRole,
    } = req.body;
    if (!title || !message || !targetRegion) {
      return res.status(400).json({ error: "title, message, and targetRegion are required" });
    }
    try {
      reliabilityState.rabbitMq.notificationQueueDepth += 1;
      const alertRecord = await createMassAlertBroadcastInDb({
        title,
        message,
        severity: severity || "Warning",
        targetRegion,
        channels: Array.isArray(channels) && channels.length > 0 ? channels : ["SMS", "Email", "Push"],
        targetPopulation: Number(targetPopulation) || 120000,
        isSimulation: isSimulation !== false,
        actorName: actorName || "Cmdr. Rajeshwari Rao (NDMA)",
        actorRole: actorRole || "admin",
      });
      reliabilityState.rabbitMq.notificationQueueDepth = 0;
      reliabilityState.rabbitMq.ackedMessages += 1;

      broadcastEvent("alert:broadcast", { alert: alertRecord, reliability: reliabilityState });
      res.status(201).json({ alert: alertRecord });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to broadcast mass alert" });
    }
  });

  // Demo Scenario: Rapid Burst of 100 SOS Requests with Clustering & Prioritization
  app.post("/api/alertnet/demo/burst-100", async (req, res) => {
    const count = Math.min(100, Math.max(10, Number(req.body.count) || 100));
    const baseCenters = [
      { region: "Central Basin", lat: 17.3865, lon: 78.4885 },
      { region: "Lower Delta Sector 4", lat: 17.3755, lon: 78.4745 },
      { region: "Riverfront Industrial", lat: 17.3695, lon: 78.505 },
      { region: "Southern Floodplain", lat: 17.358, lon: 78.481 },
    ];
    const categories = [
      "Rising Water / Trapped",
      "Medical Emergency",
      "Evacuation Assistance",
      "Structural Collapse",
      "Food & Water Supply",
    ];
    const severities = ["Critical", "High", "Moderate", "Low"];
    const names = [
      "Arjun Rao",
      "Kavitha Reddy",
      "Mohammed Irfan",
      "Sunitha Devi",
      "Venkatesh Goud",
      "Priya Nair",
      "Harish Chandra",
      "Deepika Verma",
      "Suresh Babu",
      "Padma Lakshmi",
    ];

    try {
      reliabilityState.rabbitMq.sosQueueDepth += count;
      reliabilityState.metrics.incomingSosRatePerMin = count;

      const createdRecords = [];
      const batchId = Date.now();

      for (let i = 0; i < count; i++) {
        const hub = baseCenters[i % baseCenters.length];
        const jitterLat = hub.lat + (Math.random() - 0.5) * 0.008;
        const jitterLon = hub.lon + (Math.random() - 0.5) * 0.008;
        const category = categories[i % categories.length];
        const severity = severities[i % severities.length];
        const peopleCount = (i % 7) + 1;
        const waterDepthCm = severity === "Critical" ? 135 + (i % 40) : severity === "High" ? 85 + (i % 30) : 45;
        const medicalNeeds =
          category === "Medical Emergency"
            ? "Emergency cardiac / respiratory support"
            : i % 5 === 0
            ? "Pediatric fever & insulin"
            : "None reported";
        const vulnerableGroups =
          i % 3 === 0 ? "Elderly & Children" : i % 4 === 0 ? "Mobility-Impaired" : "None";

        const triage = computeDeterministicTriage({
          category,
          severity,
          peopleCount,
          medicalNeeds,
          vulnerableGroups,
          waterDepthCm,
        });

        const activeInstance = selectActiveInstance();
        const resItem = await createDurableSosRequest({
          idempotencyKey: `sim-burst-${batchId}-${i}`,
          citizenName: `${names[i % names.length]} (#${i + 1})`,
          phone: `+91-98480-${String(10000 + i).slice(-5)}`,
          lat: Number(jitterLat.toFixed(5)),
          lon: Number(jitterLon.toFixed(5)),
          region: hub.region,
          category,
          peopleCount,
          severity,
          medicalNeeds,
          vulnerableGroups,
          waterDepthCm,
          description: `[SIMULATED FLOOD SURGE #${i + 1}] Rapid water ingress reported in ${hub.region}. Processed by ${activeInstance.name}.`,
          mediaNote: "Simulated Burst Sensor & Citizen Telemetry",
          priority: triage.priority,
          priorityScore: triage.priorityScore,
          priorityReason: triage.priorityReason,
          isSimulated: true,
        });

        createdRecords.push(resItem.record);
      }

      reliabilityState.rabbitMq.sosQueueDepth = 0;
      reliabilityState.rabbitMq.ackedMessages += count;

      const updatedState = await getAllAlertNetState();
      broadcastEvent("state:sync", {
        ...updatedState,
        reliability: reliabilityState,
      });

      res.json({
        generatedCount: createdRecords.length,
        clustersCount: updatedState.incidentClusters.length,
        state: updatedState,
        reliability: reliabilityState,
      });
    } catch (error: any) {
      reliabilityState.rabbitMq.sosQueueDepth = 0;
      res.status(500).json({ error: error.message || "Failed to execute burst simulation" });
    }
  });

  // System Failover & DLQ Simulation Control
  app.post("/api/alertnet/system/failover", (req, res) => {
    const { action, instanceId } = req.body;

    if (action === "toggle_instance") {
      const target = reliabilityState.instances.find((i) => i.id === (instanceId || "node-1"));
      if (target) {
        if (target.status === "Healthy") {
          target.status = "Stopped (Failover Active)";
          target.cpuLoadPct = 0;
        } else {
          target.status = "Healthy";
          target.cpuLoadPct = 22;
        }
      }
    } else if (action === "simulate_dlq") {
      reliabilityState.rabbitMq.retryCount += 3;
      reliabilityState.rabbitMq.dlqCount += 1;
      reliabilityState.rabbitMq.dlqMessages.unshift({
        id: `MSG-DLQ-${Math.floor(1000 + Math.random() * 9000)}`,
        reason:
          "SMS Gateway Provider Timeout after 3 exponential backoff retries (routed to Dead-Letter Queue for replay)",
        timestamp: new Date().toISOString(),
      });
    } else if (action === "replay_dlq") {
      reliabilityState.rabbitMq.ackedMessages += reliabilityState.rabbitMq.dlqCount;
      reliabilityState.rabbitMq.dlqCount = 0;
      reliabilityState.rabbitMq.dlqMessages = [];
    }

    broadcastEvent("system:reliability", reliabilityState);
    res.json({ reliability: reliabilityState });
  });

  // Citizen Registration, Login & Profile/Locality/Language Update
  app.post("/api/alertnet/citizens/register", async (req, res) => {
    const {
      uid,
      name,
      phone,
      email,
      state,
      city,
      locality,
      language,
      lat,
      lon,
      locationGranted,
    } = req.body;

    if (!name || !phone || !locality) {
      return res.status(400).json({ error: "Name, mobile number, and locality are required." });
    }

    try {
      const citizen = await registerOrUpdateCitizenProfileInDb({
        uid,
        name: String(name).trim(),
        phone: String(phone).trim(),
        email: String(email || `${String(name).toLowerCase().replace(/\s+/g, ".")}@alertnet.in`).trim(),
        state: String(state || "Telangana").trim(),
        city: String(city || "Hyderabad").trim(),
        locality: String(locality).trim(),
        language: language === "te" || language === "hi" ? language : "en",
        lat: Number(lat) || 17.385,
        lon: Number(lon) || 78.4867,
        locationGranted: locationGranted !== false,
      });

      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.status(201).json({ citizen, state: fullState });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to save citizen profile" });
    }
  });

  // Locality-Based Community Chat Post
  app.post("/api/alertnet/community", async (req, res) => {
    const { citizenUid, authorName, locality, city, language, messageType, content, lat, lon } =
      req.body;
    if (!authorName || !locality || !content) {
      return res.status(400).json({ error: "authorName, locality, and content are required" });
    }
    try {
      const created = await createCommunityMessageInDb({
        citizenUid: String(citizenUid || "citizen-anon"),
        authorName: String(authorName).trim(),
        locality: String(locality).trim(),
        city: String(city || "Hyderabad").trim(),
        language: language === "te" || language === "hi" ? language : "en",
        messageType:
          messageType === "help_request" ||
          messageType === "hazard_report" ||
          messageType === "direct_assist"
            ? messageType
            : "update",
        content: String(content).trim(),
        lat: lat ? Number(lat) : undefined,
        lon: lon ? Number(lon) : undefined,
      });

      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.status(201).json({ message: created, state: fullState });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to post community message" });
    }
  });

  // Moderate / Flag / Verify Locality Community Chat Message
  app.post("/api/alertnet/community/:id/moderate", async (req, res) => {
    const messageId = Number(req.params.id);
    const { action, flagReason, actorName, actorRole } = req.body;
    if (!messageId || !["verify", "flag", "unflag", "upvote"].includes(action)) {
      return res.status(400).json({ error: "Valid messageId and moderation action required" });
    }
    try {
      const updated = await moderateCommunityMessageInDb({
        messageId,
        action,
        flagReason,
        actorName: actorName || "Cmdr. Rajeshwari Rao (NDMA)",
        actorRole: actorRole || "admin",
      });
      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.json({ message: updated, state: fullState });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to moderate community message" });
    }
  });

  // Volunteer Registration & Safe Coordination
  app.post("/api/alertnet/volunteers", async (req, res) => {
    const { uid, name, phone, email, state, city, locality, skills, availability, safetyAcknowledged } =
      req.body;
    if (!name || !phone || !locality || !skills) {
      return res.status(400).json({ error: "Name, phone, locality, and skills are required" });
    }
    try {
      const volunteer = await registerVolunteerInDb({
        uid,
        name: String(name).trim(),
        phone: String(phone).trim(),
        email: String(email || "volunteer@alertnet.in").trim(),
        state: String(state || "Telangana").trim(),
        city: String(city || "Hyderabad").trim(),
        locality: String(locality).trim(),
        skills: String(skills).trim(),
        availability: String(availability || "Immediate").trim(),
        safetyAcknowledged: Boolean(safetyAcknowledged),
      });
      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.status(201).json({ volunteer, state: fullState });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to register volunteer" });
    }
  });

  // Automatic Location-Based Multilingual Emergency Alert Dispatch (EN / TE / HI)
  app.post("/api/alertnet/alerts/auto-locality", async (req, res) => {
    const {
      locality,
      city,
      state,
      riskLevel,
      riskScore,
      titleEn,
      titleTe,
      titleHi,
      messageEn,
      messageTe,
      messageHi,
      recommendedAction,
      forceDispatch,
      actorName,
    } = req.body;

    if (!locality || !riskLevel) {
      return res.status(400).json({ error: "locality and riskLevel are required" });
    }

    const score = Number(riskScore) || 82;
    const defaultTitleEn = `${String(riskLevel).toUpperCase()} FLOOD WARNING: ${locality}`;
    const defaultTitleTe = `వరద అత్యవసర హెచ్చరిక (${riskLevel}): ${locality}`;
    const defaultTitleHi = `बाढ़ आपातकालीन चेतावनी (${riskLevel}): ${locality}`;

    const defaultMsgEn = `Official AlertNet Warning for ${locality}, ${city || "Hyderabad"}: Flood Risk is ${riskLevel} (Score ${score}/100). ${
      recommendedAction || "Move to upper floors or evacuate to the nearest verified shelter immediately."
    } Helpline: 112 / 108.`;
    const defaultMsgTe = `${locality} ప్రాంత నివాసితులకు అత్యవసర వరద హెచ్చరిక: వరద ప్రమాద స్థాయి ${riskLevel} (${score}/100). వెంటనే సురక్షిత ఎత్తైన ప్రాంతానికి లేదా పునరావాస కేంద్రానికి వెళ్లండి. సహాయ నంబర్: 112 / 108.`;
    const defaultMsgHi = `${locality} के निवासियों के लिए आधिकारिक बाढ़ चेतावनी: बाढ़ जोखिम स्तर ${riskLevel} (${score}/100) है। कृपया तुरंत सुरक्षित ऊंचे स्थान या निकटतम राहत शिविर में जाएं। हेल्पलाइन: 112 / 108।`;

    try {
      const result = await dispatchAutomaticLocalityAlertInDb({
        locality: String(locality),
        city: String(city || "Hyderabad"),
        state: String(state || "Telangana"),
        riskLevel:
          riskLevel === "Critical" || riskLevel === "High" || riskLevel === "Moderate"
            ? riskLevel
            : "Low",
        riskScore: score,
        titleEn: titleEn || defaultTitleEn,
        titleTe: titleTe || defaultTitleTe,
        titleHi: titleHi || defaultTitleHi,
        messageEn: messageEn || defaultMsgEn,
        messageTe: messageTe || defaultMsgTe,
        messageHi: messageHi || defaultMsgHi,
        recommendedAction:
          recommendedAction ||
          (riskLevel === "Critical"
            ? "EVACUATE IMMEDIATELY to verified high-ground shelter"
            : "MOVE TO UPPER FLOORS & monitor official updates"),
        forceDispatch: Boolean(forceDispatch),
        actorName: actorName || "Cmdr. Rajeshwari Rao (NDMA)",
      });

      if (result.deduplicated) {
        reliabilityState.redis.dedupHits += 1;
      } else {
        reliabilityState.rabbitMq.ackedMessages += 3;
      }

      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.status(result.deduplicated ? 200 : 201).json({
        alert: result.alert,
        deduplicated: result.deduplicated,
        state: fullState,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to dispatch automatic locality alert" });
    }
  });

  // Retry Failed Localized SMS Deliveries
  app.post("/api/alertnet/alerts/:id/retry", async (req, res) => {
    const alertId = Number(req.params.id);
    const { actorName } = req.body;
    if (!alertId) {
      return res.status(400).json({ error: "Valid alert ID required" });
    }
    try {
      const updated = await retryLocalizedAlertInDb(
        alertId,
        actorName || "Cmdr. Rajeshwari Rao (NDMA)"
      );
      const fullState = await getAllAlertNetState();
      broadcastEvent("state:sync", fullState);
      res.json({ alert: updated, state: fullState });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to retry failed SMS deliveries" });
    }
  });

  // Multilingual AI Personal Safety Chatbot (English, Telugu, Hindi)
  app.post("/api/gemini/assistant", async (req, res) => {
    const { message, language, region, currentRisk, riskScore, citizenName } = req.body;
    const langLabel =
      language === "te" ? "Telugu (తెలుగు)" : language === "hi" ? "Hindi (हिन्दी)" : "English";

    try {
      const systemInstruction = `You are the official AlertNet AI Personal Flood Safety Chatbot for citizens and disaster management authorities.
CRITICAL LANGUAGE RULE: You MUST respond strictly in ${langLabel}. Use clear, compassionate, and authoritative emergency guidance.
Citizen Context:
- Citizen Name: ${citizenName || "Registered Citizen"}
- Locality / Region: ${region || "Central Basin"}, Hyderabad
- Current Flood Risk Level: ${currentRisk || "High"} (Risk Score: ${riskScore || 78}/100)

Verified Shelters & Emergency Facilities (DO NOT invent unverified facilities):
1. Shelters:
   - St. Jude High Ground Relief Camp (Lower Delta Sector 4, 280 beds open, wheelchair accessible, Contact: +91-40-2400-1101)
   - Central Civic Dome Shelter (Central Basin, 120 beds open, power backup, Contact: +91-40-2400-1102)
   - Highland Civic Convention Relief Center (Highland East, 290 beds open, Contact: +91-40-2400-1103)
2. Verified Emergency Hospitals:
   - Osmania General Emergency Trauma Center (Lower Delta Sector 4, 84 emergency beds, 12 ambulances, Contact: 108 / +91-40-24600146)
   - NIMS Flood Medical Relief Wing (Central Basin, 62 emergency beds, Contact: 108 / +91-40-23489000)
   - Gandhi Disaster Response Hospital (Riverfront Industrial, 110 emergency beds, Contact: 108 / +91-40-27505566)
   - Highland Multi-Specialty Emergency Hub (Highland East, 45 beds, Contact: 108 / +91-40-27114400)
3. Verified Blocked vs. Safer Evacuation Routes:
   - AVOID: Old River Bridge Approach (3.2 ft water), Central Underpass #2 (Submerged), West Culvert Service Road.
   - USE SAFER ROUTES: East Arterial Elevated Corridor, Tank Bund Upper Boulevard, East Causeway Elevated Highway.
4. Emergency Helplines: National Emergency: 112 | Ambulance: 108 | State Disaster Control (NDRF/SDMA): 1070 / 1078.
Never invent unverified emergency information. Remind users in life-threatening danger to press the red Emergency SOS button or call 112 immediately.`;

      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ parts: [{ text: String(message || "Provide flood safety instructions for my locality.") }] }],
        config: {
          systemInstruction,
        },
      });

      res.json({ reply: result.text || "" });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || "Failed to generate assistant response",
      });
    }
  });

  // Existing Gemini Endpoints (Preserved)
  app.post("/api/gemini/monthly-outlook", async (req, res) => {
    const { city, temp, rain } = req.body;
    try {
      const prompt = `As an agricultural meteorologist, provide a 30-day agricultural outlook for ${city}. 
      Current 2-day forecast shows avg temp ${temp}°C and total rain ${rain}mm.
      Provide the response in JSON format with the following structure:
      {
        "summary": "Short overall outlook",
        "weeks": [
          { "week": 1, "condition": "e.g. Moderate Rain", "advice": "e.g. Prepare drainage" },
          { "week": 2, "condition": "...", "advice": "..." },
          { "week": 3, "condition": "...", "advice": "..." },
          { "week": 4, "condition": "...", "advice": "..." }
        ],
        "riskLevel": "Low/Medium/High",
        "primaryConcern": "e.g. Soil Saturation"
      }`;

      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" },
      });

      const outlook = JSON.parse(result.text || "{}");
      res.json(outlook);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to generate monthly outlook" });
    }
  });

  app.post("/api/gemini/extended-advisory", async (req, res) => {
    const { city, riskLevel, temp, rainfall, baseAdvisory, outlookSummary } = req.body;
    try {
      const prompt = `You are an expert agricultural advisor. Based on the following conditions in ${city}:
      - Flood Risk Level: ${riskLevel}
      - Temperature: ${temp}°C
      - Rainfall: ${rainfall}mm
      - Base Advisory: ${baseAdvisory}
      - Monthly Outlook: ${outlookSummary}
      
      Provide a specific, actionable, and expanded agricultural advisory for farmers in this region. Include advice on crop protection, livestock management, and equipment safety. Keep it concise but detailed (about 3-4 sentences).`;

      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ parts: [{ text: prompt }] }],
      });

      res.json({ text: result.text || "" });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to generate extended advisory" });
    }
  });

  app.post("/api/gemini/water-bodies", async (req, res) => {
    const { lat, lon, city } = req.body;
    try {
      const prompt = `Identify ONLY the nearest and most significant water bodies (rivers, lakes, reservoirs, canals) that directly affect the flood risk of ${city} (lat: ${lat}, lon: ${lon}). 
      Focus on those within immediate proximity or upstream that pose a direct hydrological threat.
      Provide their current general conditions and specific flood risk factors based on their geography and proximity to the city.
      Format the output as a clean, concise list with Name, Type, Distance, Condition, and Direct Impact/Risk Factor for each.`;

      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: Number(lat), longitude: Number(lon) },
            },
          },
        },
      });

      let text = result.text || "";
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        const links = chunks
          .map((chunk: any) => chunk.maps)
          .filter((m: any) => m && m.uri)
          .map((m: any) => `- [${m.title || "View on Google Maps"}](${m.uri})`);
        if (links.length > 0) {
          text += `\n\n### Grounded Map Locations\n${links.join("\n")}`;
        }
      }

      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to analyze water bodies" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`AlertNet Server & WebSocket running on http://localhost:${PORT}`);
  });
}

startServer();
