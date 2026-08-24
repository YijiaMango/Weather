# YijiaMango Weather｜台灣降雨小幫手

台灣縣市／鄉鎮市區降雨單頁：中央氣象署 Open Data + Windy 公開資料。真實行政區界、當日雷達疊圖（拉桿同步）、一週預報、定位與雙指縮放。

| 名稱 | 說明 |
|------|------|
| **YijiaMango Weather** | 專案／產品代號 |
| **台灣降雨小幫手** | 中文顯示名稱 |

畫面頂部是 sticky **瀏海**：品牌名、麵包屑、當日拉桿、逐時圖、一週星期列。捲地圖或右側 Windy 時時間軸維持可見。

## 版面

- **瀏海（全寬、黏頂）**：標題、目前縣市／鄉鎮、00–23 拉桿、降雨機率／氣溫圖、未來 7 日
- **左**：行政區地圖 + 氣象署雷達疊圖
- **右**：附近公開 webcam、Windy 地圖（圖層用 Windy 原生選單）
- **底（全寬）**：測站雨量、氣象署預報、GFS 模式欄

手機順序：瀏海 → 地圖 → Windy → 數值卡。單擊選區、雙擊在定位與全台之間切換。無縣市下拉。

今天且未手動拖過拉桿時，時刻跟著裝置時鐘；整點後約 30 秒追上。降雨機率只畫官方有涵蓋的小時。今天本機日記存在 `YijiaMangoWeather.dayJournal.v1`，午夜才清。

## 資料來源

| 資料集 | 用途 |
|--------|------|
| `F-C0032-001` | 縣市 36 小時總覽 |
| `F-D0047-*`（3 天） | 鄉鎮逐時氣溫／濕度／體感／舒適度；逐 3 小時降雨機率、風、天氣現象 |
| `F-D0047-*`（一週） | 鄉鎮 12 小時降雨機率、高低溫、紫外線、綜合描述 |
| `CV1_TW_1000_*` | 氣象署官網公開雷達時間序列（深色 `invert`；僅今天、與拉桿同步） |
| `O-A0002-001` | 自動雨量站即時觀測（10 分／1／3／24 小時） |
| Windy Point Forecast | 選點 GFS 模式雨量／氣溫／風／氣壓 |
| Windy Map Forecast | 雨／風／氣壓／雷達模式圖 |
| Windy Webcams（`node.windy.com`） | 附近公開攝影機畫面 |

應用已內建授權。雷達不提供未來幀；未來時段看預報圖與 Windy 模式。

> NCDR「落雨小幫手」的 -20～+120 分外延需另申請 datahub token；本站使用氣象署官網公開雷達時間序列疊圖。

## 正式發布網址

**應用：** https://yijiamango.github.io/Weather/

分享預覽（LINE／社群）：
- 標題：`YijiaMango Weather｜台灣降雨小幫手`
- 說明：`整合中央氣象署與 Windy 公開資料 · 縣市／鄉鎮降雨`
- 圖片：`https://yijiamango.github.io/Weather/og.png`

## 發布

此 repo 即發布來源：`main` → GitHub Pages（根目錄）。

Cursor agent 回合結束由 `.cursor/hooks.json` 的 `stop` hook（`.cursor/hooks/auto-publish.ps1`）commit + push，不必再開背景迴圈。手動發布：

```powershell
.\publish.ps1 -Message "你的更新說明"
node verify-publish.js
```

`publish.ps1` 會 commit 工作區改動並 push `main`，印出正式網址。`verify-publish.js` 核對線上 title／OG／瀏海版面。

## 功能

- 22 縣市真實邊界；點擊後細分鄉鎮市區
- sticky 瀏海：當日 24 小時拉桿＋逐時圖＋一週展望
- 當日雷達疊圖與拉桿同步；Windy 模式圖對準同一小時
- 底欄數值：雨量站、氣象署、GFS
- 拖曳、滾輪／雙指縮放、裝置定位

## 本機開啟

開啟 `index.html`（需同目錄 `weather-data/tw-topo.js`）。定位若被 `file://` 擋住：

```bash
npx serve .
```

## 技術

單頁、無 bundler。地圖畫在 Canvas；氣象署／Windy 用 `fetch` 與 embed。

| | |
|--|--|
| 前端 | HTML / CSS / Canvas / JavaScript |
| 圖資 | [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) TopoJSON，本機檔 `weather-data/tw-topo.js` |
| 解碼 | [topojson-client](https://github.com/topojson/topojson-client) v3（jsDelivr CDN） |
| 字型 | Noto Sans TC（Google Fonts） |
| 發布 | GitHub Pages（`main` 根目錄） |
