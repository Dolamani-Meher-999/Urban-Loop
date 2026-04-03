import Post from "../models/Post.js";
import axios from "axios";

const cache = new Map();

const CACHE_TTL = {
  news:    15 * 60 * 1000,
  places:  60 * 60 * 1000,
  weather: 30 * 60 * 1000,
  events:  60 * 60 * 1000,
};

function getCache(key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

async function fetchPosts(city) {
  return Post.find({ city })
    .populate("user", "name username avatar")
    .sort({ createdAt: -1 })
    .limit(20);
}

async function fetchNews(city) {
  const cacheKey = `news:${city}`;
  const cached = getCache(cacheKey, CACHE_TTL.news);
  if (cached) return cached;
  try {
    const res = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q:        city,
        language: "en",
        sortBy:   "publishedAt",
        pageSize: 6,
        apiKey:   process.env.NEWSAPI_KEY,
      },
      timeout: 5000,
    });
    const data = (res.data.articles || []).map((a) => ({
      title:       a.title,
      description: a.description,
      url:         a.url,
      urlToImage:  a.urlToImage,
      source:      a.source?.name,
      publishedAt: a.publishedAt,
    }));
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("NewsAPI error:", err.message);
    return [];
  }
}

async function fetchWeather(city) {
  const cacheKey = `weather:${city}`;
  const cached = getCache(cacheKey, CACHE_TTL.weather);
  if (cached) return cached;
  try {
    const res = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        q:     city,
        appid: process.env.OPENWEATHER_KEY,
        units: "metric",
      },
      timeout: 5000,
    });
    const d    = res.data;
    const data = {
      temp:        Math.round(d.main.temp),
      feelsLike:   Math.round(d.main.feels_like),
      humidity:    d.main.humidity,
      description: d.weather?.[0]?.description,
      icon:        d.weather?.[0]?.icon,
      windSpeed:   d.wind?.speed,
    };
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("OpenWeather error:", err.message);
    return null;
  }
}

async function fetchPlaces(city) {
  const cacheKey = `places:${city}`;
  const cached = getCache(cacheKey, CACHE_TTL.places);
  if (cached) return cached;
  try {
    const geoRes = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: `${city}, India`, format: "json", limit: 1 },
      headers: { "User-Agent": "UrbanLoop/1.0" },
      timeout: 5000,
    });
    if (!geoRes.data.length) return [];
    const { lat, lon } = geoRes.data[0];

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"](around:5000,${lat},${lon});
        node["amenity"="cafe"](around:5000,${lat},${lon});
        node["amenity"="cinema"](around:5000,${lat},${lon});
        node["amenity"="bar"](around:5000,${lat},${lon});
        node["amenity"="hospital"](around:5000,${lat},${lon});
        node["amenity"="museum"](around:5000,${lat},${lon});
        node["leisure"="park"](around:5000,${lat},${lon});
        node["shop"="mall"](around:5000,${lat},${lon});
      );
      out body 60;
    `;

    const placesRes = await axios.get("https://overpass-api.de/api/interpreter", {
      params: { data: query },
      timeout: 15000,
    });

    const data = (placesRes.data.elements || [])
      .filter((p) => p.tags?.name)
      .map((p) => ({
        name:     p.tags.name,
        category: p.tags.amenity || p.tags.leisure || p.tags.shop || "place",
        address:  [p.tags["addr:street"], p.tags["addr:city"]]
                    .filter(Boolean).join(", ") || city,
        lat:      p.lat,
        lon:      p.lon,
      }))
      .filter((p, i, self) => i === self.findIndex((t) => t.name === p.name))
      .slice(0, 40);

    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("Places error:", err.message);
    return [];
  }
}

async function fetchEvents(city) {
  const cacheKey = `events:${city}`;
  const cached = getCache(cacheKey, CACHE_TTL.events);
  if (cached) return cached;
  try {
    const res = await axios.get("https://api.predicthq.com/v1/events/", {
      params: {
        q:        city,
        country:  "IN",
        limit:    20,
        sort:     "start",
        state:    "active,predicted",
        category: "concerts,festivals,sports,expos,conferences,community",
      },
      headers: {
        Authorization: `Bearer ${process.env.PREDICTHQ_KEY}`,
        Accept:        "application/json",
      },
      timeout: 5000,
    });
    const seen = new Set();
    const data = (res.data.results || [])
      .filter((e) => {
        if (seen.has(e.title)) return false;
        seen.add(e.title);
        return true;
      })
      .slice(0, 6)
      .map((e) => ({
        title:    e.title,
        category: e.category,
        start:    e.start,
        end:      e.end,
        labels:   e.labels,
      }));
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("PredictHQ error:", err.response?.data || err.message);
    return [];
  }
}

export const getExploreData = async (req, res) => {
  const city = req.params.city.trim();
  if (!city) return res.status(400).json({ message: "City is required" });
  try {
    const [news, places, weather, events] = await Promise.all([
      fetchNews(city),
      fetchPlaces(city),
      fetchWeather(city),
      fetchEvents(city),
    ]);
    res.json({ city, news, places, weather, events });
  } catch (err) {
    console.error("EXPLORE ERROR:", err);
    res.status(500).json({ message: "Failed to load explore data" });
  }
};