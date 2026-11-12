import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import db from "./src/db.ts";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/weather", async (req, res) => {
    const { city, lat, lon } = req.query;
    const apiKey = process.env.VITE_OPENWEATHER_API_KEY;

    if (!apiKey) {
      // Return mock data if API key is not configured
      const mockCity = city || "Mock City";
      const mockLat = lat || 0;
      const mockLon = lon || 0;
      return res.json({
        city: mockCity,
        temp: "25.0",
        humidity: 80,
        pressure: 1010,
        rainfall: "15.50",
        description: "Rain, Clouds",
        current: {
          temp: 26.5,
          humidity: 78,
          pressure: 1012,
          windSpeed: 5.5,
          description: "moderate rain",
          icon: "10d",
          visibility: 8000,
          timestamp: Math.floor(Date.now() / 1000)
        },
        day1: {
          temp: "24.5",
          humidity: 82,
          pressure: 1008,
          rainfall: "10.00",
          description: "Rain"
        },
        day2: {
          temp: "25.5",
          humidity: 75,
          pressure: 1012,
          rainfall: "5.50",
          description: "Clouds"
        },
        coord: { lat: Number(mockLat), lon: Number(mockLon) },
        isForecast: true,
        forecastPeriod: "Next 48 Hours"
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

      // Fetch both in parallel
      const [forecastRes, currentRes] = await Promise.all([
        axios.get(forecastUrl),
        axios.get(currentUrl)
      ]);
      
      const forecastData = forecastRes.data;
      const currentData = currentRes.data;

      // Filter for the next 48 hours (16 intervals of 3 hours)
      const forecast2Days = forecastData.list.slice(0, 16);
      
      // Calculate aggregate values for Day 1 (first 8 intervals) and Day 2 (next 8 intervals)
      const day1Forecast = forecast2Days.slice(0, 8);
      const day2Forecast = forecast2Days.slice(8, 16);

      const processForecast = (forecast: any[]) => {
        let totalRainfall = 0;
        let maxHumidity = 0;
        let minPressure = 2000;
        let avgTemp = 0;
        const descriptions = new Set<string>();

        forecast.forEach((item: any) => {
          totalRainfall += item.rain ? (item.rain['3h'] || 0) : 0;
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
          description: Array.from(descriptions).join(", ")
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
          timestamp: currentData.dt
        },
        day1: day1Data,
        day2: day2Data,
        coord: forecastData.city.coord,
        isForecast: true,
        forecastPeriod: "Next 48 Hours"
      });
    } catch (error) {
      res.status(404).json({ error: "City not found" });
    }
  });

  app.post("/api/predict", (req, res) => {
    const { city, lat, lon, temp, humidity, rainfall, pressure, description } = req.body;
    
    // Simulated river level - more grounded in rainfall
    const baseRiverLevel = 2 + (Math.random() * 2); // 2-4m base
    const rainImpact = Number(rainfall) * 0.5;
    const riverLevel = baseRiverLevel + rainImpact;

    // Heuristic for 2-day forecast
    let score = 0;
    const factors: Array<{ factor: string; impact: 'High' | 'Medium' | 'Low'; value: string }> = [];
    
    // 1. Rainfall is the primary driver
    const rainVal = Number(rainfall);
    const rainScoreImpact = rainVal * 4;
    score += rainScoreImpact;
    if (rainVal > 0) {
      factors.push({ 
        factor: 'Precipitation', 
        impact: rainVal > 30 ? 'High' : rainVal > 10 ? 'Medium' : 'Low',
        value: `${rainVal.toFixed(1)}mm`
      });
    }

    // 2. Humidity and Pressure are secondary
    const humVal = Number(humidity);
    score += (humVal / 20);
    if (humVal > 80) {
      factors.push({ factor: 'High Humidity', impact: 'Low', value: `${humVal}%` });
    }

    const pressVal = Number(pressure);
    if (pressVal < 1000) {
      score += 5;
      factors.push({ factor: 'Low Atmospheric Pressure', impact: 'Medium', value: `${pressVal}hPa` });
    } else if (pressVal < 1005) {
      score += 2;
    }

    // 3. River level impact
    score += (riverLevel * 1.5);
    if (riverLevel > 4) {
      factors.push({ factor: 'Elevated River Levels', impact: 'High', value: `${riverLevel.toFixed(1)}m` });
    } else if (riverLevel > 3) {
      factors.push({ factor: 'Moderate River Levels', impact: 'Medium', value: `${riverLevel.toFixed(1)}m` });
    }

    // 4. Weather Description Impact
    const desc = (description || "").toLowerCase();
    if (desc.includes("rain") || desc.includes("storm") || desc.includes("thunderstorm")) {
      score += 5;
      factors.push({ factor: 'Storm Conditions', impact: 'Medium', value: description });
    } else if (desc.includes("clear")) {
      score -= 5;
    }

    let riskLevel = "Low";
    // Recalibrated thresholds
    if (score > 35) riskLevel = "High";
    else if (score > 20) riskLevel = "Medium";

    // Confidence Score Calculation (Simulated based on data consistency)
    // Higher confidence if we have strong indicators
    const confidenceScore = Math.min(85 + (score / 10) + (Math.random() * 10), 99).toFixed(1);

    // Farmer Specific Risk Calculation
    let farmerRisk = "Low";
    let farmerAdvisory = "Conditions are favorable for most agricultural activities. Proceed with standard operations.";
    
    const tempVal = Number(temp);
    // humVal is already declared above

    if (riskLevel === "High") {
      farmerRisk = "Critical";
      if (rainVal > 50) {
        farmerAdvisory = "CRITICAL FLOOD WARNING: Immediate threat of severe crop waterlogging and topsoil erosion. Evacuate livestock to higher ground immediately. Secure all farm equipment. Do not attempt to cross flooded access roads.";
      } else {
        farmerAdvisory = "HIGH RISK: Significant threat to crops. Halt all field operations. Clear primary drainage channels immediately and secure loose equipment. Prepare for potential power outages affecting irrigation/storage.";
      }
    } else if (riskLevel === "Medium") {
      farmerRisk = "High";
      if (rainVal > 20) {
        farmerAdvisory = "MODERATE FLOOD RISK with Heavy Rain: Delay all fertilizer and pesticide applications to prevent runoff. Inspect and clear secondary drainage ditches. Avoid using heavy machinery to prevent soil compaction.";
      } else if (tempVal > 30) {
        farmerAdvisory = "MODERATE RISK with High Heat: Heat stress likely for livestock and crops. Ensure maximum ventilation in enclosures and provide extra shade/water. Irrigate during early morning or late evening to minimize evaporation.";
      } else {
        farmerAdvisory = "MODERATE RISK: Monitor low-lying fields for early signs of ponding. Postpone non-essential field traffic. Keep emergency pumps fueled and ready.";
      }
    } else {
      // Low Risk Level, but check weather anomalies
      if (rainVal > 15) {
        farmerRisk = "Medium";
        farmerAdvisory = "ELEVATED RAIN: Beneficial for dry soil, but monitor for localized pooling. Delay chemical spraying until foliage is dry. Good time for indoor maintenance.";
      } else if (humVal > 85 && tempVal > 25) {
        farmerRisk = "Medium";
        farmerAdvisory = "DISEASE ALERT: High humidity and warmth create ideal conditions for fungal diseases (e.g., blight, mildew) and rapid pest reproduction. Apply preventative fungicides if applicable and scout fields closely.";
      } else if (rainVal < 2 && tempVal > 32) {
        farmerRisk = "Medium";
        farmerAdvisory = "DROUGHT/HEAT STRESS: High temperatures with minimal rain. Increase irrigation frequency for shallow-rooted crops. Monitor livestock for heat exhaustion. Delay pruning to avoid additional plant stress.";
      } else if (tempVal < 5) {
        farmerRisk = "Medium";
        farmerAdvisory = "FROST WARNING: Temperatures approaching freezing. Deploy frost protection measures (row covers, heaters, or wind machines) for sensitive crops. Ensure greenhouse heating systems are fully operational.";
      }
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO prediction_history (city, lat, lon, temp, humidity, rainfall, pressure, river_level, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(city, lat, lon, temp, humidity, rainfall, pressure, riverLevel, riskLevel);

      res.json({
        city,
        riskLevel,
        farmerRisk,
        farmerAdvisory,
        riverLevel: riverLevel.toFixed(2),
        score: score.toFixed(2),
        confidenceScore,
        contributingFactors: factors
      });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/api/history", (req, res) => {
    try {
      const history = db.prepare("SELECT * FROM prediction_history ORDER BY timestamp DESC LIMIT 10").all();
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
