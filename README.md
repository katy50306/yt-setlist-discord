# yt-setlist-discord

自動從 YouTube 影片留言中辨識歌單（セトリ），並轉發到 Discord。

> 本專案程式碼由 Claude (Anthropic) 產生。

## 能辨識的留言範例

```
🌟タイムスタンプ (Time Stamp)🌟
❄ セットリスト(Set List) ❄
0:03:05 開始(Start)
0:20:10 [01]Mysterious Eyes/GARNET CROW
0:37:33 [02]桃源恋歌/GARNIDELIA
0:42:20 [03]No Logic/ジミーサムP
0:51:13 [04]Destin Histoire/yoshiki*lisa
```

```
00:04:26 ~ 00:08:33 001. Emotion | 苺咲べりぃ(Maisaki Berry)
00:15:44 ~ 00:20:31 002. Q&A リサイタル! | 戸松遥(Tomatsu Haruka)
00:20:37 ~ 00:25:07 003. ANIMA | ReoNa
```

```
セットリスト
4:32 こんひな〜お名前呼び
13:17 No.1  Rolling star/YUI
26:41 No.2  エゴロック/すりぃ
39:53 No.3  カタオモイ/Aimer
```

**重點**：留言中需要有 **3 個以上的時間戳**（`0:00`、`1:23:45` 等格式）才能被辨識。

## 無法辨識的情況

- **會員限定影片** — API 無法存取留言區
- **留言已關閉** — 無法抓取
- **只有編號沒有時間戳** — 例如「1. 曲名」沒有 `0:00` 格式
- **只有 1~2 首歌** — 時間戳不足 3 個
- **留言數超過 100 則** — 歌單留言排在後面可能抓不到
- **回覆超過 5 層** — YouTube API 限制

## 功能

- 監控指定 YouTube 頻道的直播存檔
- 自動從留言區辨識歌單留言
- 透過網頁介面動態管理頻道（新增/刪除/匯入/匯出）
- 支援多篇留言合併（不同人接力、同一人拆分、回覆中的歌單）
- 超長歌單自動拆分為多條 Discord 訊息（不切斷歌曲行）
- 支援多 Discord Webhook
- 未找到歌單的影片 24 小時內自動重試

## 流程

```
定時觸發 / 手動觸發 / 日期查詢
    |
    v
從儲存空間讀取頻道清單   -- /channels 頁面管理
    |
    v
方式 A：取得每頻道最新 1 部影片  -- playlistItems（1 unit）
方式 B：搜尋指定日期範圍的影片   -- Search API（100 units）
    |
    v
過濾已處理的影片         -- 讀取狀態儲存（方式 A 時）
    |
    v  對每部新影片：
抓取影片留言+回覆        -- commentThreads API（1 unit）
    |
    v
辨識歌單留言
  優先級 1：指定作者 + 時間戳 ≥3 → 不看讚數
  優先級 2：時間戳 ≥3 + 讚數 ≥ MIN_LIKES → 多篇合併
  優先級 3：關鍵字匹配 → 加權評分取最高分
    |
    v
發送到 Discord           -- 超過 2000 字自動拆分
```

## 前置準備

需要申請兩個東西：

1. **YouTube Data API v3 金鑰** — [申請教學](docs/youtube-api-setup.md)
2. **Discord Webhook URL** — [申請教學](docs/discord-webhook-setup.md)

## 部署方式

### Cloudflare Workers（推薦，免費）

透過 GitHub Actions 自動部署，不需要安裝任何工具：

1. Fork 本 repo
2. 在 Cloudflare 建立 API Token
3. 在 GitHub Settings → Secrets 填入設定值
4. 觸發 Actions，自動完成部署
5. 打開 `/channels` 頁面新增要監控的頻道

**[完整教學 →](docs/deploy-cloudflare.md)**

### AWS Lambda

同樣透過 GitHub Actions：

1. Fork 本 repo
2. 在 AWS 建立 IAM 使用者 + Access Key
3. 在 GitHub Settings → Secrets 填入設定值
4. 觸發 Actions，自動完成（含 DynamoDB table 建立）
5. 打開 `/channels` 頁面新增要監控的頻道

**[完整教學 →](docs/deploy-aws.md)**

### Docker

適合有自己伺服器的使用者：

```bash
cp .env.example .env
# 編輯 .env
docker compose up -d
# 打開 http://localhost:3000/channels?token=你的密碼 新增頻道
```

`data/` 目錄透過 volume 掛載，狀態自動持久化。

### Node.js

```bash
# 需要 Node.js >= 22
npm install
cp .env.example .env
# 編輯 .env

# 測試單一影片（偵測歌單但不發送 Discord）
node src/index.js --video <videoId> --dry-run

# 實際測試（偵測 + 發送到 Discord）
node src/index.js --video <videoId>

# 檢查所有頻道（不發送）
node src/index.js --check --dry-run

# 日期範圍查詢（⚠️ 消耗 100 units/頻道）
node src/index.js --from 2026-03-01 --to 2026-03-28 --dry-run

# 啟動服務（定時檢查 + HTTP server）
node src/index.js
```

### npm 套件

也可以作為模組引入自己的專案：

```javascript
import { processVideo, checkChannels } from 'yt-setlist-discord'
import { findSetlistComment } from 'yt-setlist-discord/comment-matcher'
```

## 頻道管理

部署後透過 `/channels` 頁面管理頻道，不需要修改環境變數或重新部署。

打開 `https://你的網址/channels?token=你的密碼`：
- **新增**：輸入 `@handle`、YouTube URL 或頻道 ID（支援多行、逗號分隔）
- **刪除**：點擊頻道旁的 ✕
- **匯出**：複製 JSON 備份
- **匯入**：貼上 JSON 或每行一個頻道

支援的頻道格式：
- `@handle`（如 `@QuonTama`）
- `https://www.youtube.com/@handle`
- `UCxxx`（頻道 ID）
- `PLxxx`（播放清單 ID）

新增時自動解析為頻道 ID 並儲存，不會重複消耗 API quota。

## 環境變數

### 必要

| 變數 | 說明 |
|------|------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 金鑰（[申請教學](docs/youtube-api-setup.md)） |
| `DISCORD_WEBHOOK_URLS` | Discord Webhook URL（JSON 陣列）（[申請教學](docs/discord-webhook-setup.md)） |
| `API_TOKEN` | HTTP server 認證密碼。只能用英文字母和數字（URL 特殊字元會出問題）。可用 [線上工具](https://www.browserling.com/tools/random-hex) 產生隨機 hex 字串 |

### 可選

| 變數 | 預設值 | Docker | Workers | Lambda | 說明 |
|------|--------|--------|---------|--------|------|
| `PREFERRED_AUTHORS` | `[]` | ✓ | ✓ | ✓ | 優先作者的 YouTube 顯示名稱（JSON 陣列） |
| `EXTRA_KEYWORDS` | `[]` | ✓ | ✓ | ✓ | 附加關鍵字（JSON 陣列，加在預設之後，不覆蓋） |
| `MIN_LIKES` | `10` | ✓ | ✓ | ✓ | 最低讚數門檻，過濾讚數不足的時間戳留言 |
| `SEARCH_MAX_RESULTS` | `50` | ✓ | ✓ | ✓ | 日期查詢時每頻道最多回傳的影片數（1-50） |
| `PLAYLIST_PREFIX` | `UULV` | ✓ | ✓ | ✓ | 播放清單前綴（見下方說明） |
| `TIMEZONE` | `Asia/Tokyo` | ✓ | ✓ | ✓ | Discord 訊息的時間顯示時區（[時區列表](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)） |
| `TZ` | `UTC` | ✓ | — | — | Docker 容器時區（如 `Asia/Taipei`）（[時區列表](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)） |
| `CRON_SCHEDULE` | `0 0 * * *` | ✓ | wrangler.toml | EventBridge | 定時排程（Docker 依 TZ 設定，Workers/Lambda 用 UTC） |
| `PORT` | `3000` | ✓ | — | — | HTTP server 埠號 |
| `STATE_FILE_PATH` | `./data/state.json` | ✓ | Cloudflare KV | DynamoDB | 狀態儲存。Workers/Lambda 用各自 KV 系統（自動建立） |

### Workers / Lambda 的定時排程

兩者都使用 **UTC** 時區（例如 JST 00:00 = UTC 15:00）。

**Workers**：修改 `wrangler.toml`，重新部署生效
```toml
[triggers]
crons = ["0 15 * * *"]   # UTC 15:00 = JST 00:00
```

**Lambda**：在 GitHub Secrets 設定 `AWS_CRON_SCHEDULE`（不需要改程式碼），重新部署生效
```
AWS_CRON_SCHEDULE = cron(0 15 * * ? *)     # 每天 UTC 15:00 = JST 00:00
AWS_CRON_SCHEDULE = cron(*/10 14-19 * * ? *)  # 台灣 22:00~03:59 每 10 分鐘
```
不設則用預設值 `cron(0 0 * * ? *)`（每天 UTC 00:00）。

### 播放清單前綴

`PLAYLIST_PREFIX` 控制要監控頻道的哪類影片：

| 前綴 | 內容 | 說明 |
|------|------|------|
| `UULV` | 直播 | **預設**，歌枠通常在這 |
| `UU` | 全部上傳 | 包含直播、影片、Shorts |
| `UULF` | 完整影片 | 不含 Shorts 的非直播影片（歌 Cover 等） |
| `UUSH` | Shorts | 僅 Shorts |

## HTTP API

啟動服務模式後，可透過瀏覽器或 curl 操作：

| 路由 | 說明 |
|------|------|
| `GET /channels?token=<token>` | 頻道管理頁面（HTML） |
| `GET /api/channels?token=<token>` | 頻道列表（JSON） |
| `GET /api/channels?add=@a,@b&token=<token>` | 新增頻道 |
| `GET /api/channels?remove=<id>&token=<token>` | 移除頻道 |
| `POST /api/channels?token=<token>` | 匯入頻道（body 為 JSON 或每行一個） |
| `GET /check?video=<id>&token=<token>` | 處理單一影片（不受頻道清單限制，任何公開影片都能查） |
| `GET /check?token=<token>` | 檢查所有頻道（最新 1 部，1 unit/頻道） |
| `GET /check?from=2026-03-01&to=2026-03-28&token=<token>` | 日期範圍查詢（to 不填預設今天，⚠️ 100 units/頻道） |
| `GET /check?token=<token>&dry-run=true` | 檢查但不發送 Discord |
| `GET /status?token=<token>` | 服務狀態 |

所有請求需帶 `token` 參數或 `Authorization: Bearer <token>` header。

## 歌單辨識邏輯

辨識採用三層優先級，**先試優先級 1，沒找到才試下一層**：

### 優先級 1：指定作者

留言者在 `PREFERRED_AUTHORS` 裡，且含 ≥3 個時間戳。**不看讚數**。
多篇按時間戳排序合併。

### 優先級 2：時間戳 + 讚數

留言（含回覆）中包含 3 個以上時間戳（`M:SS` 或 `H:MM:SS`），且讚數 ≥ `MIN_LIKES`。
多篇按時間戳排序合併。支援：同一人拆分多篇、不同人接力、回覆中的歌單。

### 優先級 3：關鍵字匹配

當沒有任何留言符合前兩層時，才會使用關鍵字匹配：
包含歌單相關關鍵字且滿足最低字數/行數門檻的留言，按讚數和文字長度加權評分，取最高分一篇。

Log 會顯示 `[preferred-author]`、`[timestamp+likes]`、`[keyword]` 標示命中的優先級。

預設關鍵字：
`セットリスト` `セトリ` `歌単` `歌リスト` `今日の歌` `本日の歌` `歌った曲` `setlist` `set list` `song list`

可透過 `EXTRA_KEYWORDS` 環境變數附加自訂關鍵字（不會覆蓋預設）。

## YouTube API 配額

每日免費上限 10,000 units。

### 一般檢查（`--check`，每日定時）

每個頻道取最新 1 部影片，透過狀態記錄跳過已處理的。

| 項目 | 消耗 |
|------|------|
| 取得最新影片（playlistItems） | 1 unit/頻道 |
| 新影片：取得詳細資訊 | 1 unit |
| 新影片：取得留言 | 1 unit |

**範例**：3 個頻道，每天一次 → 3 × (1 + 1 × 2) = **9 units/天**（有新影片時）

### 日期範圍查詢（`--from`）

| 項目 | 消耗 |
|------|------|
| 搜尋影片（Search API） | **100 units/頻道** |
| 每部影片：取得留言 | 1 unit |

**範例**：3 個頻道，搜尋一個月 → 3 × 100 + 影片數 × 1 = **300+ units/次**

⚠️ 日期查詢消耗較高，建議手動使用而非定時排程。

## 狀態持久化

程式自動偵測環境，選擇對應的儲存方式（不需要手動指定）：

| 平台 | 儲存方式 | 設定 |
|------|---------|------|
| Docker / Node.js | `data/state.json` 檔案 | 自動，透過 volume 掛載持久化 |
| Cloudflare Workers | Cloudflare KV | GitHub Actions 自動建立 |
| AWS Lambda | DynamoDB | GitHub Actions 自動建立 |

狀態儲存包含：已處理的影片記錄 + 頻道清單。

## 已知限制

- **多篇合併的雜訊**：當多篇留言都符合時間戳條件時，可能混入非歌單的留言（例如只列了幾首原創曲時間戳的感想留言）。可透過 `MIN_LIKES` 環境變數設定讚數門檻過濾。
