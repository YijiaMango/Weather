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

  async function loadNearbyWebcam(lat, lon, radiusKm = 160) {
    const u = new URL(CAM_URL);
    u.searchParams.set("nearby", `${lat.toFixed(4)},${lon.toFixed(4)},${radiusKm}`);
    u.searchParams.set("limit", "1");
    u.searchParams.set("include", "images,location,player,urls");
    const res = await fetch(u.toString(), {
      headers: { "x-windy-api-key": CAM_KEY }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `CAM_HTTP_${res.status}`);
    const list = json.webcams || json.data || [];
    const cam = list[0] || null;
    cache.webcam = cam;
    return cam;
  }

  function embedMapUrl(lat, lon, overlay = "rain") {
    const q = new URLSearchParams({
      lat: lat.toFixed(3),
      lon: lon.toFixed(3),
      zoom: "8",
      level: "surface",
      overlay,
      menu: "",
      message: "",
      marker: "true",
      calendar: "now",
      pressure: overlay === "pressure" ? "true" : "",
      type: "map",
      location: "coordinates",
      detail: "",
      detailLat: lat.toFixed(3),
      detailLon: lon.toFixed(3),
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
    loadNearbyWebcam,
    embedMapUrl
  };
})(window);
