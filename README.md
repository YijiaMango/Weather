# YijiaMango_Weather｜台灣降雨小幫手

台灣縣市／鄉鎮市區降雨地圖：真實行政區界、一週預報、定位與雙指縮放。

| 名稱 | 說明 |
|------|------|
| **YijiaMango_Weather** | 專案／產品代號 |
| **台灣降雨小幫手** | 中文顯示名稱 |

## 資料來源（官方）

預報**只使用中央氣象署 Open Data**，已停用模擬數據。

| 資料集 | 用途 |
|--------|------|
| `F-C0032-001` | 縣市 36 小時總覽 |
| `F-D0047-*`（3 天） | 鄉鎮逐時氣溫／濕度／體感／舒適度；逐 3 小時降雨機率、風、天氣現象 |
| `F-D0047-*`（一週） | 鄉鎮 12 小時降雨機率、高低溫、紫外線、綜合描述 |

應用已內建授權，開啟即可讀取官方預報。

## 正式發布網址

**應用：** https://yijiamango.github.io/Weather/  

分享預覽（LINE／社群）：
- 標題：`YijiaMango_Weather｜台灣降雨小幫手`
- 說明：`台灣縣市／鄉鎮降雨地圖 · 一週預報 · 定位即看`
- 圖片：`https://yijiamango.github.io/Weather/og.png`

## 發布工具（本專案標準流程）

此 repo 即發布來源：`main` → GitHub Pages（根目錄）。

```powershell
cd C:\Users\Tt\Desktop\Weather-repo
.\publish.ps1 -Message "你的更新說明"
node verify-publish.js
```

`publish.ps1` 會：
1. 同步 `Desktop\weather.html` → `index.html`
2. commit + push `main`
3. 印出正式網址

`verify-publish.js` 會核對線上 title／OG／版面是否正確。

## 功能

- 22 縣市真實邊界；點擊後細分鄉鎮市區
- 未來一週展望 + 當日 24 小時逐時圖（模擬資料）
- 拖曳、滾輪／雙指縮放、裝置定位

## 本機開啟

開啟 `index.html`（需同目錄 `weather-data/tw-topo.js`）。定位若被 `file://` 擋住：

```bash
npx serve .
```

## 技術

- HTML / Canvas / JavaScript
- 圖資：[taiwan-atlas](https://github.com/dkaoster/taiwan-atlas)
- [`topojson-client`](https://github.com/topojson/topojson-client)（CDN）
