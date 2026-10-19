# YijiaMango Weather｜台灣降雨小幫手

台灣縣市／鄉鎮市區降雨檢視。以中央氣象署開放資料為主、Windy 公開資料為輔，於單一頁面呈現行政區選取、當日雷達、逐時預報與一週展望。

**應用：** https://yijiamango.github.io/Weather/

## 技術重點

- 單頁應用，無打包工具。行政區圖以 Canvas 繪製；氣象署與 Windy 以 `fetch` 及公開 embed 取得。
- 22 縣市真實邊界（taiwan-atlas TopoJSON），點選後進入鄉鎮市區。
- 時間軸黏附於頁頂：00–23 時拉桿、降雨機率／氣溫圖、未來七日。未手動調整時，時刻跟隨裝置時鐘。
- 當日雷達回波疊於行政區圖，與拉桿同步。雷達僅提供當日觀測幀；未來時段以預報與模式圖呈現。
- 降雨機率以氣象署為準。官方無該時段時，改以 Windy GFS 推估（圖上為半透明紅色直柱）。氣溫、濕度、風速若雙方均有值，採算術平均。測站雨量為實測，不與模式混合。

## 資料來源

| 來源 | 用途 |
|------|------|
| `F-C0032-001` | 縣市 36 小時預報 |
| `F-D0047-*`（三日） | 鄉鎮逐時氣溫、濕度、體感、舒適度；逐三小時降雨機率、風、天氣現象 |
| `F-D0047-*`（一週） | 鄉鎮 12 小時降雨機率、高低溫、紫外線、綜合描述 |
| `CV1_TW_1000_*` | 官網雷達時間序列（限當日） |
| `O-A0002-001` | 自動雨量站即時觀測（10 分／1／3／24 小時） |
| Windy Point Forecast（GFS） | 選點模式雨量、氣溫、風、氣壓 |
| Windy 公開 embed | 模式地圖 |
| Windy Webcams | 附近公開攝影機 |

## 架構

| 項目 | 說明 |
|------|------|
| 前端 | HTML、CSS、Canvas、JavaScript |
| 圖資 | [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) TopoJSON（`weather-data/tw-topo.js`） |
| 解碼 | [topojson-client](https://github.com/topojson/topojson-client) v3 |
| 字型 | Noto Sans TC |
| 託管 | GitHub Pages（`main` 根目錄） |
