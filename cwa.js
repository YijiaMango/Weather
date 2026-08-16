/**
 * YijiaMango Weather — 中央氣象署 Open Data 客戶端
 * F-C0032-001 縣市 36h｜F-D0047-* 鄉鎮 3 天細預報＋一週
 */
(function (global) {
  const BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";
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

  // 一週代碼 -2 = 該縣 3 天細預報
  const COUNTY_3DAY = {};
  Object.keys(COUNTY_WEEKLY).forEach((name) => {
    const id = COUNTY_WEEKLY[name];
    const n = parseInt(id.split("-").pop(), 10) - 2;
    COUNTY_3DAY[name] = `F-D0047-${String(n).padStart(3, "0")}`;
  });

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
    if (Array.isArray(rec.location)) return { countyName: null, towns: rec.location };
    if (Array.isArray(rec.Location)) return { countyName: null, towns: rec.Location };
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

  function fieldBag(t) {
    const ev = t.elementValue || t.ElementValue || t.parameter || t.Parameter;
    if (Array.isArray(ev) && ev[0] && typeof ev[0] === "object") return ev[0];
    if (ev && typeof ev === "object" && !Array.isArray(ev)) return ev;
    if (ev == null) return {};
    return { value: String(ev) };
  }

  function pickField(fields, keys) {
    for (const k of keys) {
      if (fields[k] != null && fields[k] !== "") return String(fields[k]);
    }
    return "";
  }

  function periodStart(t) {
    return t.startTime || t.StartTime || t.dataTime || t.DataTime || "";
  }

  function periodEnd(t) {
    return t.endTime || t.EndTime || "";
  }

  function byElementMap(loc) {
    const byEl = {};
    for (const el of elementsOf(loc)) {
      byEl[elementName(el)] = timesOf(el);
    }
    return byEl;
  }

  function findTimes(byEl, names) {
    for (const n of names) {
      if (byEl[n]?.length) return byEl[n];
    }
    return [];
  }

  function covering(list, isoStart) {
    if (!list.length) return null;
    const exact = list.find((x) => x.start === isoStart);
    if (exact) return exact;
    const t = toMs(isoStart);
    if (Number.isNaN(t)) return null;
    return list.find((x) => {
      const a = toMs(x.start);
      const b = x.end ? toMs(x.end) : a + 3 * 3600 * 1000;
      return t >= a && t < b;
    }) || null;
  }

  function toMs(iso) {
    if (!iso) return NaN;
    return new Date(String(iso).replace(" ", "T")).getTime();
  }

  function dayKey(iso) {
    if (!iso) return "";
    return String(iso).replace(" ", "T").slice(0, 10);
  }

  function hourOf(iso) {
    const m = String(iso || "").replace(" ", "T").match(/T(\d{2})/);
    return m ? parseInt(m[1], 10) : 12;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function addDaysKey(baseKey, offset) {
    const [y, m, d] = baseKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + offset);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function parse3DayTown(loc) {
    const name = loc.locationName || loc.LocationName || "";
    const byEl = byElementMap(loc);

    const tempTimes = findTimes(byEl, ["溫度", "T"]);
    const hourly = tempTimes.map((t) => {
      const f = fieldBag(t);
      const start = periodStart(t);
      const rhT = covering(
        findTimes(byEl, ["相對濕度", "RH"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      const tdT = covering(
        findTimes(byEl, ["露點溫度", "Td"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      const atT = covering(
        findTimes(byEl, ["體感溫度", "AT"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      const ciT = covering(
        findTimes(byEl, ["舒適度指數", "CI"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      return {
        start,
        end: periodEnd(t),
        t: pickField(f, ["Temperature", "value", "parameterName"]),
        td: tdT ? pickField(tdT.f, ["DewPoint", "value"]) : "",
        rh: rhT ? pickField(rhT.f, ["RelativeHumidity", "value"]) : "",
        at: atT ? pickField(atT.f, ["ApparentTemperature", "value"]) : "",
        ci: ciT ? pickField(ciT.f, ["ComfortIndex", "value"]) : "",
        ciDesc: ciT ? pickField(ciT.f, ["ComfortIndexDescription"]) : ""
      };
    });

    const popTimes = findTimes(byEl, ["3小時降雨機率", "PoP3h", "PoP"]);
    const slots3h = popTimes.map((t) => {
      const start = periodStart(t);
      const f = fieldBag(t);
      const wxT = covering(
        findTimes(byEl, ["天氣現象", "Wx"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      const wsT = covering(
        findTimes(byEl, ["風速", "WS"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      const wdT = covering(
        findTimes(byEl, ["風向", "WD"]).map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) })),
        start
      );
      const descT = covering(
        findTimes(byEl, ["天氣預報綜合描述", "WeatherDescription"]).map((x) => ({
          start: periodStart(x),
          end: periodEnd(x),
          f: fieldBag(x)
        })),
        start
      );
      const hourHit = hourly.find((h) => h.start === start) || covering(
        hourly.map((h) => ({ ...h, f: {} })),
        start
      );
      const pop = Math.max(0, Math.min(100, parseInt(pickField(f, ["ProbabilityOfPrecipitation", "value", "parameterName"]), 10) || 0));
      return {
        start,
        end: periodEnd(t),
        pop,
        wx: wxT ? pickField(wxT.f, ["Weather", "parameterName", "value"]) : "",
        wxCode: wxT ? pickField(wxT.f, ["WeatherCode", "parameterValue"]) : "",
        windSpeed: wsT ? pickField(wsT.f, ["WindSpeed", "value"]) : "",
        beaufort: wsT ? pickField(wsT.f, ["BeaufortScale"]) : "",
        windDir: wdT ? pickField(wdT.f, ["WindDirection", "value"]) : "",
        desc: descT ? pickField(descT.f, ["WeatherDescription", "value"]) : "",
        t: hourHit?.t || "",
        rh: hourHit?.rh || "",
        at: hourHit?.at || "",
        td: hourHit?.td || "",
        ci: hourHit?.ci || "",
        ciDesc: hourHit?.ciDesc || "",
        resolution: "3h"
      };
    });

    return { name, hourly, slots3h };
  }

  function parseWeeklyTown(loc) {
    const name = loc.locationName || loc.LocationName || "";
    const byEl = byElementMap(loc);
    const axis = findTimes(byEl, ["12小時降雨機率", "PoP12h", "降雨機率", "PoP", "天氣現象", "Wx"]);

    const wrap = (names) =>
      findTimes(byEl, names).map((t) => ({
        start: periodStart(t),
        end: periodEnd(t),
        f: fieldBag(t)
      }));

    const wxArr = wrap(["天氣現象", "Wx"]);
    const minTArr = wrap(["最低溫度", "MinT"]);
    const maxTArr = wrap(["最高溫度", "MaxT"]);
    const tArr = wrap(["平均溫度", "溫度", "T"]);
    const tdArr = wrap(["平均露點溫度", "露點溫度", "Td"]);
    const rhArr = wrap(["平均相對濕度", "相對濕度", "RH"]);
    const maxAtArr = wrap(["最高體感溫度", "MaxAT"]);
    const minAtArr = wrap(["最低體感溫度", "MinAT"]);
    const maxCiArr = wrap(["最大舒適度指數", "MaxCI"]);
    const minCiArr = wrap(["最小舒適度指數", "MinCI"]);
    const wsArr = wrap(["風速", "WS"]);
    const wdArr = wrap(["風向", "WD"]);
    const uviArr = wrap(["紫外線指數", "UVI"]);
    const descArr = wrap(["天氣預報綜合描述", "WeatherDescription"]);

    const periods = axis.map((t) => {
      const start = periodStart(t);
      const f = fieldBag(t);
      const g = (arr) => covering(arr, start);
      const popRaw = pickField(f, ["ProbabilityOfPrecipitation", "parameterName", "value"]);
      const pop = Math.max(0, Math.min(100, parseInt(popRaw, 10) || 0));
      const wx = g(wxArr);
      const minT = g(minTArr);
      const maxT = g(maxTArr);
      const avgT = g(tArr);
      const td = g(tdArr);
      const rh = g(rhArr);
      const maxAt = g(maxAtArr);
      const minAt = g(minAtArr);
      const maxCi = g(maxCiArr);
      const minCi = g(minCiArr);
      const ws = g(wsArr);
      const wd = g(wdArr);
      const uvi = g(uviArr);
      const desc = g(descArr);
      return {
        start,
        end: periodEnd(t),
        pop,
        wx: wx ? pickField(wx.f, ["Weather", "parameterName", "value"]) : pickField(f, ["Weather", "parameterName"]),
        wxCode: wx ? pickField(wx.f, ["WeatherCode", "parameterValue"]) : "",
        minT: minT ? pickField(minT.f, ["MinTemperature", "value", "parameterName"]) : "",
        maxT: maxT ? pickField(maxT.f, ["MaxTemperature", "value", "parameterName"]) : "",
        t: avgT ? pickField(avgT.f, ["Temperature", "value", "parameterName"]) : "",
        td: td ? pickField(td.f, ["DewPoint", "value"]) : "",
        rh: rh ? pickField(rh.f, ["RelativeHumidity", "value"]) : "",
        maxAt: maxAt ? pickField(maxAt.f, ["MaxApparentTemperature", "value"]) : "",
        minAt: minAt ? pickField(minAt.f, ["MinApparentTemperature", "value"]) : "",
        maxCi: maxCi ? pickField(maxCi.f, ["MaxComfortIndex", "value"]) : "",
        maxCiDesc: maxCi ? pickField(maxCi.f, ["MaxComfortIndexDescription"]) : "",
        minCi: minCi ? pickField(minCi.f, ["MinComfortIndex", "value"]) : "",
        minCiDesc: minCi ? pickField(minCi.f, ["MinComfortIndexDescription"]) : "",
        windSpeed: ws ? pickField(ws.f, ["WindSpeed", "value"]) : "",
        beaufort: ws ? pickField(ws.f, ["BeaufortScale"]) : "",
        windDir: wd ? pickField(wd.f, ["WindDirection", "value"]) : "",
        uvi: uvi ? pickField(uvi.f, ["UVIndex", "value"]) : "",
        uviLevel: uvi ? pickField(uvi.f, ["UVExposureLevel"]) : "",
        desc: desc ? pickField(desc.f, ["WeatherDescription", "value"]) : "",
        resolution: "12h"
      };
    });

    // 若 axis 本身不是 PoP（例如只有 Wx），補降雨機率
    const popArr = wrap(["12小時降雨機率", "PoP12h", "降雨機率", "PoP"]);
    if (popArr.length && periods.length && !findTimes(byEl, ["12小時降雨機率", "PoP12h", "降雨機率", "PoP"]).length) {
      /* no-op */
    } else if (popArr.length) {
      for (const p of periods) {
        const hit = covering(popArr, p.start);
        if (hit) {
          const v = parseInt(pickField(hit.f, ["ProbabilityOfPrecipitation", "parameterName", "value"]), 10);
          if (!Number.isNaN(v)) p.pop = Math.max(0, Math.min(100, v));
        }
      }
    }

    return { name, periods };
  }

  function parseCounty36(loc) {
    const name = loc.locationName || loc.LocationName || "";
    const byEl = byElementMap(loc);
    const popEl = findTimes(byEl, ["PoP", "降雨機率"]);
    const wxEl = findTimes(byEl, ["Wx", "天氣現象"]);
    const minEl = findTimes(byEl, ["MinT", "最低溫度"]);
    const maxEl = findTimes(byEl, ["MaxT", "最高溫度"]);
    const ciEl = findTimes(byEl, ["CI", "舒適度"]);
    const axis = popEl.length ? popEl : wxEl;
    const wxWrapped = wxEl.map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) }));
    const minWrapped = minEl.map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) }));
    const maxWrapped = maxEl.map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) }));
    const ciWrapped = ciEl.map((x) => ({ start: periodStart(x), end: periodEnd(x), f: fieldBag(x) }));
    const periods = axis.map((t) => {
      const start = periodStart(t);
      const f = fieldBag(t);
      const wx = covering(wxWrapped, start);
      const minT = covering(minWrapped, start);
      const maxT = covering(maxWrapped, start);
      const ci = covering(ciWrapped, start);
      return {
        start,
        end: periodEnd(t),
        pop: Math.max(0, Math.min(100, parseInt(pickField(f, ["parameterName", "ProbabilityOfPrecipitation", "value"]), 10) || 0)),
        wx: wx ? pickField(wx.f, ["parameterName", "Weather", "value"]) : "",
        wxCode: wx ? pickField(wx.f, ["parameterValue", "WeatherCode"]) : "",
        minT: minT ? pickField(minT.f, ["parameterName", "MinTemperature", "value"]) : "",
        maxT: maxT ? pickField(maxT.f, ["parameterName", "MaxTemperature", "value"]) : "",
        ci: ci ? pickField(ci.f, ["parameterName", "ComfortIndex", "value"]) : "",
        resolution: "12h"
      };
    });
    return { name, periods };
  }

  const cache = {
    county36: null,
    packs: {} // county -> { towns: {name: townPack}, at, datasets }
  };

  function emptyTown() {
    return { name: "", hourly: [], slots3h: [], weekly: [] };
  }

  function mergeTownPack(a, b) {
    return {
      name: a.name || b.name,
      hourly: a.hourly?.length ? a.hourly : b.hourly || [],
      slots3h: a.slots3h?.length ? a.slots3h : b.slots3h || [],
      weekly: a.weekly?.length ? a.weekly : b.weekly || []
    };
  }

  async function loadCounty36h() {
    const json = await fetchDatastore("F-C0032-001");
    const { towns } = locList(json);
    const map = {};
    for (const loc of towns) {
      const parsed = parseCounty36(loc);
      map[normName(parsed.name)] = parsed.periods;
    }
    cache.county36 = { map, at: new Date().toISOString() };
    return cache.county36;
  }

  async function loadCountyForecast(countyName) {
    const cName = normName(countyName);
    if (cache.packs[cName]?.towns) return cache.packs[cName];
    const id3 = COUNTY_3DAY[cName];
    const id7 = COUNTY_WEEKLY[cName];
    if (!id3 || !id7) throw new Error(`NO_DATASET:${cName}`);

    const [j3, j7] = await Promise.all([fetchDatastore(id3), fetchDatastore(id7)]);
    const towns3 = locList(j3).towns;
    const towns7 = locList(j7).towns;
    const townMap = {};

    for (const loc of towns3) {
      const p = parse3DayTown(loc);
      townMap[normName(p.name)] = {
        name: p.name,
        hourly: p.hourly,
        slots3h: p.slots3h,
        weekly: []
      };
    }
    for (const loc of towns7) {
      const p = parseWeeklyTown(loc);
      const key = normName(p.name);
      const prev = townMap[key] || emptyTown();
      townMap[key] = {
        name: p.name || prev.name,
        hourly: prev.hourly,
        slots3h: prev.slots3h,
        weekly: p.periods
      };
    }

    cache.packs[cName] = {
      towns: townMap,
      at: new Date().toISOString(),
      datasets: { day3: id3, week: id7 }
    };
    return cache.packs[cName];
  }

  // 相容舊呼叫名稱
  async function loadCountyWeekly(countyName) {
    const pack = await loadCountyForecast(countyName);
    return {
      towns: Object.fromEntries(
        Object.entries(pack.towns).map(([k, v]) => [k, v.weekly])
      ),
      at: pack.at,
      dataset: `${pack.datasets.day3}+${pack.datasets.week}`
    };
  }

  function getTownPack(countyName, townName) {
    const c = normName(countyName);
    const t = normName(townName);
    const towns = cache.packs[c]?.towns;
    if (!towns) return emptyTown();
    if (towns[t]) return towns[t];
    const hit = Object.keys(towns).find((k) => namesEqual(k, townName) || k.includes(t) || t.includes(k));
    return hit ? towns[hit] : emptyTown();
  }

  function avgTownPacks(countyName) {
    const towns = Object.values(cache.packs[normName(countyName)]?.towns || {});
    if (!towns.length) return emptyTown();
    const base = towns[0];
    const hourly = (base.hourly || []).map((h, i) => {
      let t = 0, td = 0, rh = 0, at = 0, n = 0;
      for (const town of towns) {
        const q = town.hourly[i];
        if (!q) continue;
        const a = parseFloat(q.t); if (!Number.isNaN(a)) t += a;
        const b = parseFloat(q.td); if (!Number.isNaN(b)) td += b;
        const c = parseFloat(q.rh); if (!Number.isNaN(c)) rh += c;
        const d = parseFloat(q.at); if (!Number.isNaN(d)) at += d;
        n++;
      }
      return {
        ...h,
        t: n ? String(Math.round(t / n)) : h.t,
        td: n ? String(Math.round(td / n)) : h.td,
        rh: n ? String(Math.round(rh / n)) : h.rh,
        at: n ? String(Math.round(at / n)) : h.at
      };
    });
    const slots3h = (base.slots3h || []).map((p, i) => {
      let pop = 0, n = 0;
      let wx = p.wx;
      for (const town of towns) {
        const q = town.slots3h[i];
        if (!q) continue;
        pop += q.pop; n++;
        if (q.wx) wx = q.wx;
      }
      return { ...p, pop: n ? Math.round(pop / n) : p.pop, wx };
    });
    const weekly = (base.weekly || []).map((p, i) => {
      let pop = 0, n = 0, minT = 99, maxT = -99;
      let wx = p.wx;
      for (const town of towns) {
        const q = town.weekly[i];
        if (!q) continue;
        pop += q.pop; n++;
        if (q.wx) wx = q.wx;
        const a = parseInt(q.minT, 10); const b = parseInt(q.maxT, 10);
        if (!Number.isNaN(a)) minT = Math.min(minT, a);
        if (!Number.isNaN(b)) maxT = Math.max(maxT, b);
      }
      return {
        ...p,
        pop: n ? Math.round(pop / n) : p.pop,
        wx,
        minT: minT === 99 ? p.minT : String(minT),
        maxT: maxT === -99 ? p.maxT : String(maxT)
      };
    });
    return { name: countyName, hourly, slots3h, weekly };
  }

  function resolvePack(countyName, townName) {
    if (townName) return getTownPack(countyName, townName);
    if (countyName && cache.packs[normName(countyName)]) return avgTownPacks(countyName);
    return emptyTown();
  }

  function getTownPeriods(countyName, townName) {
    const pack = getTownPack(countyName, townName);
    return pack.slots3h.length ? pack.slots3h : pack.weekly;
  }

  function getCountyPeriods(countyName) {
    const n = normName(countyName);
    if (cache.packs[n]) {
      const pack = avgTownPacks(countyName);
      return pack.slots3h.length ? pack.slots3h.concat(
        pack.weekly.filter((w) => !pack.slots3h.some((s) => dayKey(s.start) === dayKey(w.start) && hourOf(s.start) === hourOf(w.start)))
      ) : pack.weekly;
    }
    return cache.county36?.map[n] || [];
  }

  function coversHour(p, day, hour) {
    const targetDay = addDaysKey(todayKey(), day);
    const s = toMs(p.start);
    const e = p.end ? toMs(p.end) : s + 3 * 3600 * 1000;
    if (Number.isNaN(s)) return dayKey(p.start) === targetDay && hourOf(p.start) === hour;
    const dt = new Date(`${targetDay}T${String(hour).padStart(2, "0")}:00:00`);
    const t = dt.getTime();
    return t >= s && t < e;
  }

  function hourlySeries(countyName, townName, dayOffset) {
    const pack = resolvePack(countyName, townName);
    const targetDay = addDaysKey(todayKey(), dayOffset);
    const out = [];
    for (let h = 0; h < 24; h++) {
      const hourIsoGuess = `${targetDay}T${String(h).padStart(2, "0")}:00:00+08:00`;
      const hourPoint = (pack.hourly || []).find((x) => dayKey(x.start) === targetDay && hourOf(x.start) === h)
        || covering((pack.hourly || []).map((x) => ({ ...x })), hourIsoGuess);
      const slot3 = (pack.slots3h || []).find((p) => coversHour(p, dayOffset, h));
      const slot12 = (pack.weekly || []).find((p) => coversHour(p, dayOffset, h));
      const pop = slot3 ? slot3.pop : (slot12 ? slot12.pop : 0);
      const src = slot3 ? "3h" : (slot12 ? "12h" : (hourPoint ? "1h" : "—"));
      out.push({
        hour: h,
        start: hourPoint?.start || slot3?.start || slot12?.start || hourIsoGuess,
        pop,
        t: hourPoint?.t || slot3?.t || slot12?.t || "",
        td: hourPoint?.td || slot3?.td || slot12?.td || "",
        rh: hourPoint?.rh || slot3?.rh || slot12?.rh || "",
        at: hourPoint?.at || slot3?.at || slot12?.maxAt || slot12?.minAt || "",
        ci: hourPoint?.ci || slot3?.ci || slot12?.maxCi || "",
        ciDesc: hourPoint?.ciDesc || slot3?.ciDesc || slot12?.maxCiDesc || "",
        wx: slot3?.wx || slot12?.wx || "",
        wxCode: slot3?.wxCode || slot12?.wxCode || "",
        windSpeed: slot3?.windSpeed || slot12?.windSpeed || "",
        beaufort: slot3?.beaufort || slot12?.beaufort || "",
        windDir: slot3?.windDir || slot12?.windDir || "",
        minT: slot12?.minT || "",
        maxT: slot12?.maxT || "",
        uvi: slot12?.uvi || "",
        uviLevel: slot12?.uviLevel || "",
        desc: slot3?.desc || slot12?.desc || "",
        resolution: src
      });
    }
    return out;
  }

  function snapshot(countyName, townName, dayOffset, hour) {
    const series = hourlySeries(countyName, townName, dayOffset);
    const hit = series[hour] || series[0] || null;
    if (!hit) return null;
    const pack = resolvePack(countyName, townName);
    const daySlots = (pack.weekly || []).filter((p) => dayKey(p.start) === addDaysKey(todayKey(), dayOffset));
    const day3 = (pack.slots3h || []).filter((p) => dayKey(p.start) === addDaysKey(todayKey(), dayOffset));
    let minT = hit.minT, maxT = hit.maxT;
    if ((!minT || !maxT) && daySlots.length) {
      minT = daySlots.map((p) => parseInt(p.minT, 10)).filter((n) => !Number.isNaN(n));
      maxT = daySlots.map((p) => parseInt(p.maxT, 10)).filter((n) => !Number.isNaN(n));
      minT = minT.length ? String(Math.min(...minT)) : hit.minT;
      maxT = maxT.length ? String(Math.max(...maxT)) : hit.maxT;
    }
    const uvi = daySlots.find((p) => p.uvi)?.uvi || hit.uvi;
    const uviLevel = daySlots.find((p) => p.uviLevel)?.uviLevel || hit.uviLevel;
    return {
      ...hit,
      minT: minT || "—",
      maxT: maxT || "—",
      uvi: uvi || "",
      uviLevel: uviLevel || "",
      day3Count: day3.length,
      day12Count: daySlots.length,
      hasHourly: !!(pack.hourly && pack.hourly.length)
    };
  }

  function pickPeriod(periods, dayOffset, hour) {
    if (!periods || !periods.length) return null;
    const coveringList = periods.filter((p) => coversHour(p, dayOffset, hour));
    if (coveringList.length) return coveringList[0];
    const targetDay = addDaysKey(todayKey(), dayOffset);
    const sameDay = periods.filter((p) => dayKey(p.start) === targetDay);
    const list = sameDay.length ? sameDay : periods;
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
    // periods 可能是 3h 或 12h；優先用傳入，否則由外部 hourlySeries 聚合
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

  function dayOutlookFromPack(countyName, townName, dayOffset) {
    const pack = resolvePack(countyName, townName);
    const series = hourlySeries(countyName, townName, dayOffset);
    const hasData = series.some((h) => h.resolution !== "—");
    if (!hasData && !(pack.weekly || []).length) {
      return { maxPop: 0, avgPop: 0, wx: "—", minT: "—", maxT: "—", count: 0, periods: [], peakHour: 12 };
    }
    let maxPop = 0;
    let sum = 0;
    let peakHour = 12;
    let wx = "—";
    for (const h of series) {
      sum += h.pop;
      if (h.pop > maxPop) {
        maxPop = h.pop;
        peakHour = h.hour;
        if (h.wx) wx = h.wx;
      } else if (h.pop === maxPop && h.wx) wx = h.wx;
    }
    const weeklyDay = dayOutlook(pack.weekly, dayOffset);
    const slotsDay = dayOutlook(pack.slots3h, dayOffset);
    return {
      maxPop: Math.max(maxPop, weeklyDay.maxPop, slotsDay.maxPop),
      avgPop: Math.round(sum / 24),
      wx: wx !== "—" ? wx : (slotsDay.wx !== "—" ? slotsDay.wx : weeklyDay.wx),
      minT: weeklyDay.minT !== "—" ? weeklyDay.minT : "—",
      maxT: weeklyDay.maxT !== "—" ? weeklyDay.maxT : "—",
      count: series.filter((h) => h.resolution !== "—").length,
      periods: pack.slots3h.filter((p) => dayKey(p.start) === addDaysKey(todayKey(), dayOffset)).length
        ? pack.slots3h.filter((p) => dayKey(p.start) === addDaysKey(todayKey(), dayOffset))
        : pack.weekly.filter((p) => dayKey(p.start) === addDaysKey(todayKey(), dayOffset)),
      peakHour,
      resolution: pack.slots3h.some((p) => dayKey(p.start) === addDaysKey(todayKey(), dayOffset)) ? "3h" : "12h"
    };
  }

  const SAT_PRODUCTS = {
    tw_color: { id: "O-B0028-003", label: "台灣·彩色" },
    tw_color_hi: { id: "O-C0042-002", label: "台灣·彩色高解析" },
    tw_enhance: { id: "O-B0030-003", label: "台灣·色調強化" },
    tw_vis: { id: "O-B0031-003", label: "台灣·可見光" },
    ea_color: { id: "O-B0028-002", label: "東亞·彩色" },
    globe_color: { id: "O-B0028-001", label: "全景·彩色" }
  };

  // 雷達整合回波圖（約每 10 分鐘更新）— 對齊 NCDR 落雨小幫手的「即時感」
  const RADAR_PRODUCTS = {
    near: { id: "O-A0058-003", label: "鄰近·無地形" },
    near_clear: { id: "O-A0058-006", label: "鄰近·透明底" },
    wide: { id: "O-A0058-001", label: "大範圍·無地形" },
    wide_clear: { id: "O-A0058-005", label: "大範圍·透明底" },
    terrain: { id: "O-A0058-002", label: "大範圍·有地形" }
  };

  async function fetchFileApi(datasetId) {
    const url = new URL(`https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/${datasetId}`);
    url.searchParams.set("Authorization", getKey());
    url.searchParams.set("format", "JSON");
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return res.json();
  }

  function parseImageProduct(json, fallbackLabel, datasetId, key) {
    const ds = json.cwaopendata?.dataset || json.dataset || {};
    const resource = ds.Resource || ds.resource || {};
    const geo = ds.GeoInfo || ds.geoInfo || {};
    const obs = ds.ObsTime?.Datetime || ds.ObsTime?.DateTime || json.cwaopendata?.sent || "";
    const imageUrl = resource.ProductURL || resource.productURL || resource.uri || resource.URI || "";
    if (!imageUrl) throw new Error("NO_IMAGE_URL");
    const bust = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
    return {
      key,
      dataset: datasetId,
      label: fallbackLabel,
      desc: resource.ResourceDesc || resource.resourceDesc || fallbackLabel,
      obsTime: obs,
      imageUrl: bust,
      rawUrl: imageUrl,
      lonRange: geo.LongitudeRange || "",
      latRange: geo.LatitudeRange || "",
      at: new Date().toISOString()
    };
  }

  async function loadSatellite(productKey = "tw_color_hi") {
    const prod = SAT_PRODUCTS[productKey] || SAT_PRODUCTS.tw_color_hi;
    const json = await fetchFileApi(prod.id);
    const pack = parseImageProduct(json, prod.label, prod.id, productKey);
    cache.satellite = pack;
    return pack;
  }

  async function loadRadar(productKey = "near") {
    const prod = RADAR_PRODUCTS[productKey] || RADAR_PRODUCTS.near;
    const json = await fetchFileApi(prod.id);
    const pack = parseImageProduct(json, prod.label, prod.id, productKey);
    cache.radar = pack;
    return pack;
  }

  function stationCoords(st) {
    const list = st.GeoInfo?.Coordinates || [];
    const wgs = list.find((c) => c.CoordinateName === "WGS84") || list[0];
    if (!wgs) return null;
    return {
      lon: parseFloat(wgs.StationLongitude),
      lat: parseFloat(wgs.StationLatitude)
    };
  }

  function rainNums(st) {
    const e = st.RainfallElement || {};
    const n = (obj) => {
      const v = parseFloat(obj?.Precipitation);
      return Number.isFinite(v) && v >= 0 ? v : 0;
    };
    return {
      now: n(e.Now),
      m10: n(e.Past10Min),
      h1: n(e.Past1hr),
      h3: n(e.Past3hr),
      h6: n(e.Past6Hr || e.Past6hr),
      h12: n(e.Past12hr),
      h24: n(e.Past24hr)
    };
  }

  async function loadRainStations() {
    const json = await fetchDatastore("O-A0002-001");
    const stations = json.records?.Station || json.records?.station || [];
    const list = [];
    for (const st of stations) {
      const c = stationCoords(st);
      if (!c || Number.isNaN(c.lon) || Number.isNaN(c.lat)) continue;
      const rain = rainNums(st);
      list.push({
        id: st.StationId,
        name: st.StationName,
        county: normName(st.GeoInfo?.CountyName || ""),
        town: normName(st.GeoInfo?.TownName || ""),
        lon: c.lon,
        lat: c.lat,
        obsTime: st.ObsTime?.DateTime || st.ObsTime?.Datetime || "",
        rain
      });
    }
    cache.rainStations = { list, at: new Date().toISOString() };
    return cache.rainStations;
  }

  function nearestRain(lon, lat, countyName, townName) {
    const list = cache.rainStations?.list || [];
    if (!list.length) return null;
    const cName = normName(countyName);
    const tName = normName(townName);
    let pool = list;
    if (cName && tName) {
      const sameTown = list.filter((s) => s.county === cName && (s.town === tName || s.town.includes(tName) || tName.includes(s.town)));
      if (sameTown.length) pool = sameTown;
      else {
        const sameCounty = list.filter((s) => s.county === cName);
        if (sameCounty.length) pool = sameCounty;
      }
    } else if (cName) {
      const sameCounty = list.filter((s) => s.county === cName);
      if (sameCounty.length) pool = sameCounty;
    }
    let best = null;
    let bestD = Infinity;
    for (const s of pool) {
      const d = Math.hypot(s.lon - lon, s.lat - lat);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best ? { ...best, distKm: bestD * 111 } : null;
  }

  function rainForCounty(countyName) {
    const list = (cache.rainStations?.list || []).filter((s) => s.county === normName(countyName));
    if (!list.length) return null;
    let max1 = 0;
    let max10 = 0;
    let sum1 = 0;
    for (const s of list) {
      max1 = Math.max(max1, s.rain.h1);
      max10 = Math.max(max10, s.rain.m10);
      sum1 += s.rain.h1;
    }
    return { max1h: max1, max10m: max10, avg1h: sum1 / list.length, count: list.length };
  }

  global.CWA = {
    getKey,
    hasKey: () => true,
    normName,
    namesEqual,
    cache,
    loadCounty36h,
    loadCountyForecast,
    loadCountyWeekly,
    getCountyPeriods,
    getTownPeriods,
    getTownPack,
    resolvePack,
    hourlySeries,
    snapshot,
    pickPeriod,
    dayOutlook,
    dayOutlookFromPack,
    loadSatellite,
    loadRadar,
    loadRainStations,
    nearestRain,
    rainForCounty,
    todayKey,
    addDaysKey,
    hourOf,
    COUNTY_WEEKLY,
    COUNTY_3DAY,
    SAT_PRODUCTS,
    RADAR_PRODUCTS
  };
})(window);
