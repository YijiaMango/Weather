# YijiaMango_Weather｜台灣降雨小幫手

台灣縣市／鄉鎮市區降雨可視化小工具：真實行政區界、鄉鎮級 drill-down、地圖拖曳／雙指縮放與定位。

| 名稱 | 說明 |
|------|------|
| **YijiaMango_Weather** | 專案／產品代號 |
| **台灣降雨小幫手** | 中文顯示名稱 |

## 🌐 線上體驗

**[開啟應用 → https://yijiamango.github.io/Weather/](https://yijiamango.github.io/Weather/)**

> 首次開啟請允許瀏覽器定位權限，即可自動對應到所在鄉鎮。

## 功能

- 22 縣市真實邊界總覽
- 點擊縣市後細分至鄉鎮市區（368 區）
- 地圖自由拖曳、滾輪／雙指縮放
- 裝置定位自動聚焦
- 24 小時逐時降雨／機率圖（模擬資料）

## 本機開啟

直接開啟 `index.html`，並確保同目錄有 `weather-data/tw-topo.js`。

若定位被 `file://` 擋下，可用本機靜態伺服器：

```bash
npx serve .
```

然後開啟終端機顯示的網址。

## 技術

- 純 HTML / Canvas / JavaScript
- 圖資：[taiwan-atlas](https://github.com/dkaoster/taiwan-atlas)（TopoJSON）
- [`topojson-client`](https://github.com/topojson/topojson-client)（CDN）

## Repo

https://github.com/YijiaMango/Weather
