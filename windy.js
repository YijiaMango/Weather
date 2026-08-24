/**
 * Windy 公開資料客戶端（Point Forecast / Map Forecast / Webcams）
 * Point Forecast / Map Forecast / Webcams — 金鑰各一把，不可混用
 */
(function (global) {
  const POINT_KEY = "kyp2WG6jTpNXy00TZe74vJrozJEnZYds";
  const MAP_KEY = "ckb5xi8wIwXJ0bTD4cvJWxcRz4HeIQye";
  const CAM_KEY = "Ctpc24UUUrMwip1YuTOoJO655EnYbome";

  const POINT_URL = "https://api.windy.com/api/point-forecast/v2";
  const CAM_URL = "https://api.windy.com/webcams/api/v3/webcams";

  const cache = {
    point: null,
    webcam: null,
    at: 0
  };

  function hypot(a, b) {
    return Math.sqrt(a * a + b * b);
  }

  function pickIndex(ts, targetMs) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < ts.length; i++) {
      const d = Math.abs(ts[i] - targetMs);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  async function loadPoint(lat, lon) {
    const res = await fetch(POINT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat,
        lon,
        model: "gfs",
        parameters: ["precip", "temp", "wind", "pressure", "rh"],
        levels: ["surface"],
        key: POINT_KEY
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `POINT_HTTP_${res.status}`);
    cache.point = json;
    cache.at = Date.now();
    return json;
  }

  function precipMmToPop(mm) {
    if (mm == null || Number.isNaN(mm)) return null;
    if (mm < 0) mm = 0;
    if (mm < 0.05) return 0;
    return Math.round(Math.min(100, 100 * (1 - Math.exp(-mm / 2.8))));
  }

  /** GFS 約 3h 一筆、涵蓋近 10 天；回傳當地 0–23 時的雨量推估 PoP／氣溫 */
  function hourlyForDay(json, dayOffset) {
    if (!json?.ts?.length) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + dayOffset);
    const startMs = start.getTime();
    const endMs = startMs + 86400000;
    const hours = Array.from({ length: 24 }, () => ({ pop: null, t: null, precipMm: null }));
    const precip = json["past3hprecip-surface"] || [];
    const temp = json["temp-surface"] || [];
    for (let i = 0; i < json.ts.length; i++) {
      const tEnd = +json.ts[i] < 1e12 ? +json.ts[i] * 1000 : +json.ts[i];
      if (!tEnd) continue;
      const prev = +json.ts[i - 1];
      const tStart = i > 0 ? (prev < 1e12 ? prev * 1000 : prev) : tEnd - 3 * 3600000;
      const mm = precip[i] == null ? null : precip[i] * 1000;
      const pop = precipMmToPop(mm);
      const tempC = temp[i] == null ? null : temp[i] - 273.15;
      const lo = Math.max(startMs, tStart);
      const hi = Math.min(endMs, tEnd);
      if (hi <= lo) continue;
      for (let ms = lo; ms < hi; ms += 3600000) {
        const h = new Date(ms).getHours();
        hours[h] = { pop, t: tempC, precipMm: mm };
      }
    }
    return hours;
  }

  function snapshotAt(json, targetMs) {
    if (!json?.ts?.length) return null;
    const i = pickIndex(json.ts, targetMs);
    const precipM = json["past3hprecip-surface"]?.[i];
    const tempK = json["temp-surface"]?.[i];
    const u = json["wind_u-surface"]?.[i];
    const v = json["wind_v-surface"]?.[i];
    const pa = json["pressure-surface"]?.[i];
    const rh = json["rh-surface"]?.[i];
    const shuffled = !!(json.warning && /shuffled|testing/i.test(json.warning));
    return {
      at: json.ts[i],
      precipMm: precipM == null ? null : precipM * 1000,
      tempC: tempK == null ? null : tempK - 273.15,
      windMs: u == null || v == null ? null : hypot(u, v),
      pressureHpa: pa == null ? null : pa / 100,
      rh: rh == null ? null : rh,
      model: "GFS",
      shuffled,
      warning: json.warning || ""
    };
  }

  function normalizeCam(cam) {
    if (!cam) return null;
    const loc = cam.location || {};
    return {
      id: cam.webcamId || cam.id,
      title: cam.title,
      location: {
        city: loc.city || loc.title || "",
        region: loc.region || loc.subcountry || ""
      },
      images: cam.images,
      player: cam.player,
      urls: cam.urls
    };
  }

  async function loadOfficialWebcam(lat, lon, radiusKm) {
    const u = new URL(CAM_URL);
    u.searchParams.set("nearby", `${lat.toFixed(4)},${lon.toFixed(4)},${radiusKm}`);
    u.searchParams.set("limit", "1");
    u.searchParams.set("include", "images,location,player,urls");
    const res = await fetch(u.toString(), {
      headers: { "x-windy-api-key": CAM_KEY }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `CAM_HTTP_${res.status}`);
    return normalizeCam((json.webcams || json.data || [])[0] || null);
  }

  /** Windy 網站公開列表（embed 同款），不需 Webcams 商業金鑰 */
  async function loadPublicWebcam(lat, lon) {
    const u = new URL("https://node.windy.com/webcams/v1.0/list");
    u.searchParams.set("nearby", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("limit", "1");
    u.searchParams.set("lang", "zh-TW");
    const res = await fetch(u.toString());
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `CAM_HTTP_${res.status}`);
    return normalizeCam((json.cams || json.webcams || [])[0] || null);
  }

  async function loadNearbyWebcam(lat, lon, radiusKm = 160) {
    try {
      const cam = await loadOfficialWebcam(lat, lon, radiusKm);
      if (cam) {
        cache.webcam = cam;
        return cam;
      }
    } catch (_) {
      // Testing key 仍 401；401 沒 CORS，瀏覽器只看得到 Failed to fetch
    }
    const cam = await loadPublicWebcam(lat, lon);
    cache.webcam = cam;
    return cam;
  }

  function embedMapUrl(_lat, _lon, overlay = "rain", targetMs = Date.now()) {
    const now = new Date();
    const nowHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
    const hoursAhead = Math.max(-24, Math.min(240, Math.round((targetMs - nowHourStart) / 36e5)));
    const q = new URLSearchParams({
      lat: "23.72",
      lon: "120.97",
      zoom: "6",
      level: "surface",
      overlay,
      menu: "",
      message: "",
      marker: "",
      calendar: "in",
      forecast: String(hoursAhead),
      pressure: overlay === "pressure" ? "true" : "",
      type: "map",
      location: "coordinates",
      detail: "",
      metricWind: "m/s",
      metricTemp: "°C",
      radarRange: "-1"
    });
    return `https://embed.windy.com/embed2.html?${q.toString()}`;
  }

  global.WINDY = {
    POINT_KEY,
    MAP_KEY,
    CAM_KEY,
    cache,
    loadPoint,
    snapshotAt,
    hourlyForDay,
    precipMmToPop,
    loadNearbyWebcam,
    embedMapUrl
  };
})(window);
