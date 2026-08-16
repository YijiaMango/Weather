/**
 * YijiaMango_Weather — 中央氣象署 Open Data 客戶端
 * 資料集：F-C0032-001（縣市 36h）、F-D0047-*（鄉鎮一週）
 */
(function (global) {
  const BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";
  // 內建授權碼（正式發布用）
  const CWA_API_KEY = "CWA-B5A814BD-5727-46BE-9ABF-308866067A16";

  const COUNTY_WEEKLY = {
    "宜蘭縣": "F-D0047-003",
    "桃園市": "F-D0047-007",
    "新竹縣": "F-D0047-011",
    "苗栗縣": "F-D0047-015",
    "彰化縣": "F-D0047-019",
    "南投縣": "F-D0047-023",
    "雲林縣": "F-D0047-027",
    "嘉義縣": "F-D0047-031",
    "屏東縣": "F-D0047-035",
    "臺東縣": "F-D0047-039",
    "花蓮縣": "F-D0047-043",
    "澎湖縣": "F-D0047-047",
    "基隆市": "F-D0047-051",
    "新竹市": "F-D0047-055",
    "嘉義市": "F-D0047-059",
    "臺北市": "F-D0047-063",
    "高雄市": "F-D0047-067",
    "新北市": "F-D0047-071",
    "臺中市": "F-D0047-075",
    "臺南市": "F-D0047-079",
    "連江縣": "F-D0047-083",
    "金門縣": "F-D0047-087"
  };

  // 官方回傳可能是英文代碼或中文名稱
  const EL_ALIASES = {
    PoP12h: ["PoP12h", "12小時降雨機率", "降雨機率"],
    PoP: ["PoP", "降雨機率", "12小時降雨機率"],
    Wx: ["Wx", "天氣現象"],
    MinT: ["MinT", "最低溫度", "最低溫"],
    MaxT: ["MaxT", "最高溫度", "最高溫"],
    T: ["T", "平均溫度", "溫度"],
    WeatherDescription: ["WeatherDescription", "天氣預報綜合描述"]
  };

  function normName(s) {
    return String(s || "").replace(/台/g, "臺").trim();
  }

  function namesEqual(a, b) {
    return normName(a) === normName(b);
  }

  function getKey() {
    return CWA_API_KEY;
  }

  async function fetchDatastore(datasetId, extra = {}) {
    const url = new URL(`${BASE}/${datasetId}`);
    url.searchParams.set("Authorization", getKey());
    url.searchParams.set("format", "JSON");
    Object.entries(extra).forEach(([k, v]) => {
      if (v != null && v !== "") url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (res.status === 401) throw new Error("BAD_KEY");
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const json = await res.json();
    if (json.success !== true && json.success !== "true") {
      throw new Error(json.message || "CWA_FAIL");
    }
    return json;
  }

  function locList(payload) {
    const rec = payload.records || {};
    if (Array.isArray(rec.Locations) && rec.Locations[0]) {
      return {
        countyName: rec.Locations[0].LocationsName || rec.Locations[0].locationsName,
        towns: rec.Locations[0].Location || rec.Locations[0].location || []
      };
    }
    if (Array.isArray(rec.locations) && rec.locations[0]) {
      return {
        countyName: rec.locations[0].locationsName || rec.locations[0].LocationsName,
        towns: rec.locations[0].location || rec.locations[0].Location || []
      };
    }
    if (Array.isArray(rec.location)) {
      return { countyName: null, towns: rec.location };
    }
    if (Array.isArray(rec.Location)) {
      return { countyName: null, towns: rec.Location };
    }
    return { countyName: null, towns: [] };
  }

  function elementsOf(loc) {
    return loc.weatherElement || loc.WeatherElement || [];
  }

  function elementName(el) {
    return el.elementName || el.ElementName || "";
  }

  function timesOf(el) {
    return el.time || el.Time || [];
  }

  function periodValue(t) {
    const ev = t.elementValue || t.ElementValue || t.parameter || t.Parameter;
    if (Array.isArray(ev)) {
      const v = ev[0];
      if (!v || typeof v !== "object") return v == null ? "" : String(v);
      return (
        v.value ??
        v.Value ??
        v.parameterName ??
        v.ParameterName ??
        v.ProbabilityOfPrecipitation ??
        v.Weather ??
        v.MinTemperature ??
        v.MaxTemperature ??
        v.Temperature ??
        v.WeatherDescription ??
        Object.values(v).find((x) => x != null && x !== "") ??
        ""
      );
    }
    if (ev && typeof ev === "object") {
      return (
        ev.parameterName ||
        ev.ParameterName ||
        ev.value ||
        ev.Value ||
        ev.ProbabilityOfPrecipitation ||
        ev.Weather ||
        ev.MinTemperature ||
        ev.MaxTemperature ||
        ""
      );
    }
    return "";
  }

  function periodStart(t) {
    return t.startTime || t.StartTime || t.dataTime || t.DataTime || "";
  }

  function periodEnd(t) {
    return t.endTime || t.EndTime || "";
  }

  function findElement(byEl, logicalKey) {
    const aliases = EL_ALIASES[logicalKey] || [logicalKey];
    for (const a of aliases) {
      if (byEl[a]) return byEl[a];
    }
    return [];
  }

  function parseTownForecast(loc) {
    const name = loc.locationName || loc.LocationName || "";
    const byEl = {};
    for (const el of elementsOf(loc)) {
      const en = elementName(el);
      byEl[en] = timesOf(el).map((t) => ({
        start: periodStart(t),
        end: periodEnd(t),
        value: String(periodValue(t))
      }));
    }

    const axis = findElement(byEl, "PoP12h");
    const axis2 = axis.length ? axis : findElement(byEl, "PoP");
    const axis3 = axis2.length ? axis2 : findElement(byEl, "Wx");
    const periods = axis3.map((p, i) => {
      const pickAt = (logicalKey) => {
        const arr = findElement(byEl, logicalKey);
        if (arr[i]) return arr[i].value;
        const hit = arr.find((x) => x.start === p.start);
        return hit ? hit.value : "";
      };
      const popRaw = pickAt("PoP12h") || pickAt("PoP") || "0";
      const pop = Math.max(0, Math.min(100, parseInt(popRaw, 10) || 0));
      return {
        start: p.start,
        end: p.end,
        pop,
        wx: pickAt("Wx"),
        minT: pickAt("MinT"),
        maxT: pickAt("MaxT"),
        t: pickAt("T"),
        desc: pickAt("WeatherDescription")
      };
    });
    return { name, periods };
  }

  const cache = {
    county36: null,
    weekly: {}
  };

  function dayKey(iso) {
    if (!iso) return "";
    // 支援 "2026-08-16 18:00:00" 與 ISO
    return String(iso).replace(" ", "T").slice(0, 10);
  }

  function hourOf(iso) {
    const m = String(iso || "").replace(" ", "T").match(/T(\d{2})/);
    return m ? parseInt(m[1], 10) : 12;
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDaysKey(baseKey, offset) {
    const [y, m, d] = baseKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + offset);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function pickPeriod(periods, dayOffset, hour) {
    if (!periods || !periods.length) return null;
    const targetDay = addDaysKey(todayKey(), dayOffset);
    const covering = periods.filter((p) => {
      const s = dayKey(p.start);
      const e = dayKey(p.end);
      return s === targetDay || e === targetDay || (s <= targetDay && (!e || e >= targetDay));
    });
    const list = covering.length ? covering : periods;
    let best = list[0];
    let bestScore = Infinity;
    for (const p of list) {
      const score = Math.abs(hourOf(p.start) - hour);
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  function dayOutlook(periods, dayOffset) {
    const targetDay = addDaysKey(todayKey(), dayOffset);
    const list = (periods || []).filter((p) => dayKey(p.start) === targetDay);
    if (!list.length) return { maxPop: 0, avgPop: 0, wx: "—", minT: "—", maxT: "—", count: 0, periods: [] };
    let maxPop = 0;
    let sum = 0;
    let minT = 99;
    let maxT = -99;
    let wx = list[0].wx;
    for (const p of list) {
      maxPop = Math.max(maxPop, p.pop);
      sum += p.pop;
      const a = parseInt(p.minT, 10);
      const b = parseInt(p.maxT, 10);
      if (!Number.isNaN(a)) minT = Math.min(minT, a);
      if (!Number.isNaN(b)) maxT = Math.max(maxT, b);
      if (p.pop === maxPop && p.wx) wx = p.wx;
    }
    return {
      maxPop,
      avgPop: Math.round(sum / list.length),
      wx,
      minT: minT === 99 ? "—" : String(minT),
      maxT: maxT === -99 ? "—" : String(maxT),
      count: list.length,
      periods: list
    };
  }

  async function loadCounty36h() {
    // 不帶 ElementName：避免部分資料集過濾後欄位異常
    const json = await fetchDatastore("F-C0032-001");
    const { towns } = locList(json);
    const map = {};
    for (const loc of towns) {
      const parsed = parseTownForecast(loc);
      map[normName(parsed.name)] = parsed.periods;
    }
    cache.county36 = { map, at: new Date().toISOString() };
    return cache.county36;
  }

  async function loadCountyWeekly(countyName) {
    const cName = normName(countyName);
    if (cache.weekly[cName]?.towns) return cache.weekly[cName];
    const id = COUNTY_WEEKLY[cName];
    if (!id) throw new Error(`NO_DATASET:${cName}`);
    // 不帶 ElementName：此資料集以中文欄位名回傳
    const json = await fetchDatastore(id);
    const { towns } = locList(json);
    const townMap = {};
    for (const loc of towns) {
      const parsed = parseTownForecast(loc);
      townMap[normName(parsed.name)] = parsed.periods;
    }
    cache.weekly[cName] = { towns: townMap, at: new Date().toISOString(), dataset: id };
    return cache.weekly[cName];
  }

  function getCountyPeriods(countyName) {
    const n = normName(countyName);
    if (cache.weekly[n]?.towns) {
      const all = Object.values(cache.weekly[n].towns);
      if (!all.length) return cache.county36?.map[n] || [];
      const base = all[0];
      return base.map((p, i) => {
        let pop = 0;
        let nOk = 0;
        let wx = p.wx;
        let minT = 99;
        let maxT = -99;
        for (const town of all) {
          const q = town[i];
          if (!q) continue;
          pop += q.pop;
          nOk++;
          if (q.wx) wx = q.wx;
          const a = parseInt(q.minT, 10);
          const b = parseInt(q.maxT, 10);
          if (!Number.isNaN(a)) minT = Math.min(minT, a);
          if (!Number.isNaN(b)) maxT = Math.max(maxT, b);
        }
        return {
          start: p.start,
          end: p.end,
          pop: nOk ? Math.round(pop / nOk) : 0,
          wx,
          minT: minT === 99 ? "—" : String(minT),
          maxT: maxT === -99 ? "—" : String(maxT)
        };
      });
    }
    return cache.county36?.map[n] || [];
  }

  function getTownPeriods(countyName, townName) {
    const c = normName(countyName);
    const t = normName(townName);
    const weekly = cache.weekly[c]?.towns;
    if (weekly) {
      if (weekly[t]) return weekly[t];
      const hit = Object.keys(weekly).find((k) => namesEqual(k, townName) || k.includes(t) || t.includes(k));
      if (hit) return weekly[hit];
    }
    return [];
  }

  global.CWA = {
    getKey,
    hasKey: () => true,
    normName,
    namesEqual,
    cache,
    loadCounty36h,
    loadCountyWeekly,
    getCountyPeriods,
    getTownPeriods,
    pickPeriod,
    dayOutlook,
    todayKey,
    addDaysKey,
    hourOf,
    COUNTY_WEEKLY
  };
})(window);
