const https = require("https");
const fs = require("fs");

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    }).on("error", reject);
  });
}

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

(async () => {
  const html = await get("https://yijiamango.github.io/Weather/");
  const body = html.split("<body")[1] || "";
  const out = {
    title: pick(html, /<title>([^<]*)<\/title>/),
    description: pick(html, /name="description" content="([^"]*)"/),
    ogTitle: pick(html, /property="og:title" content="([^"]*)"/),
    ogDesc: pick(html, /property="og:description" content="([^"]*)"/),
    ogImage: pick(html, /property="og:image" content="([^"]*)"/),
    ogUrl: pick(html, /property="og:url" content="([^"]*)"/),
    hasOldLuoYu: html.includes("落雨小幫手"),
    hasWeekStrip: html.includes('id="weekStrip"'),
    timelineBeforeMap:
      body.indexOf('class="timeline-card"') > -1 &&
      body.indexOf('class="timeline-card"') < body.indexOf('class="main-grid"'),
    brandPrimary: html.includes("> YijiaMango_Weather</div>"),
  };
  console.log(JSON.stringify(out, null, 2));

  const local = fs.readFileSync("C:/Users/Tt/Desktop/Weather-repo/index.html", "utf8");
  console.log(
    JSON.stringify(
      {
        localOgTitle: pick(local, /property="og:title" content="([^"]*)"/),
        localOgDesc: pick(local, /property="og:description" content="([^"]*)"/),
        localMatchesLiveTitle: pick(local, /<title>([^<]*)<\/title>/) === out.title,
      },
      null,
      2
    )
  );
})();
