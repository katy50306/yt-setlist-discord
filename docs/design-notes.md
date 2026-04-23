# 設計筆記與踩坑記錄

開發過程中遇到的問題和決策理由，避免未來重複踩坑。

## Discord 訊息格式

**決策**：使用純文字 `content`，不用 embed。

**原因**：Discord 對 embed 內容的搜尋索引不穩定。實測發現 embed 裡的 title、description、footer 有時搜得到有時搜不到。純文字的 `content` 搜尋一定有效。

## Cloudflare Workers

### process.exit 會掛住

Workers 環境下 `process.exit(1)` 不會真的退出，而是讓 Worker 掛住直到超時（顯示 Error 1101）。

**解法**：所有 `process.exit(1)` 改成 `throw new Error(...)`。

### dotenv import 會卡住

`await import('dotenv/config')` 在 Workers production 環境下可能卡住。

**解法**：用 `typeof globalThis.process?.versions?.node === 'string'` 偵測是否為 Node.js，只在 Node.js 環境才 import dotenv。

### fs stub 不會 throw

Workers 的 `nodejs_compat` flag 提供 `node:fs` 的 stub，`import('node:fs')` 不會 throw。但呼叫 `mkdirSync` 等方法時才會 throw。

**解法**：`fs-probe.js` 用 `_fs.mkdirSync('.', { recursive: true })` 實際呼叫來偵測，而非只檢查 import 是否成功。

### esbuild 會分析 dynamic import

即使用 `await import('module')` 動態引入，wrangler 的 esbuild bundler 還是會分析模組路徑。`@aws-sdk/client-dynamodb` 在 Workers 不存在會導致 build 失敗。

**解法**：用字串拼接掩蓋路徑 `const MOD = '@aws-sdk/client-' + 'dynamodb'`，esbuild 無法靜態分析。

### config.js import 時機

Workers 的 `env` 物件（包含 secrets）在 `fetch(request, env)` handler 裡才能存取。但 `config.js` 在 module evaluation 時就讀 `process.env`。`worker.js` 用 `populateEnv(env)` 把 env 複製到 `process.env`，但必須在 config.js 被 evaluate 之前。

目前靠 dynamic import (`await import('./config.js')`) 確保順序正確。如果改成 static import 會壞掉。

## AWS Lambda

### 檔案系統是唯讀的

Lambda 部署目錄 `/var/task/` 是唯讀的。`channel-resolver.js` 的 `saveCache` 嘗試寫入 `./data/channel-cache.json` 會 throw `EROFS`。

**解法**：`saveCache` 包 try/catch，寫入失敗時靜默跳過。Lambda 環境下 channel 解析每次冷啟動都重新做（quota 消耗極小）。

### SAM deploy 需要 S3

`sam deploy` 需要一個 S3 bucket 上傳 Lambda 程式碼包。GitHub Actions workflow 裡要加 `--resolve-s3` 讓 SAM 自動建立。

### EventBridge 權限

SAM 建立 EventBridge rule（cron）需要 `AmazonEventBridgeFullAccess` IAM 政策，不在常見的 Lambda/DynamoDB 權限裡，容易遺漏。

### ROLLBACK_COMPLETE stack

CloudFormation stack 建立失敗後狀態變成 `ROLLBACK_COMPLETE`，無法直接重新部署。必須先刪除再建立。GitHub Actions workflow 裡加了自動偵測和刪除。

### GitHub Actions shell 引號

`${{ secrets.DISCORD_WEBHOOK_URLS }}` 展開後，JSON 陣列的內層引號被 shell 吃掉。`["url"]` 變成 `[url]`。

**解法**：用 `env:` 傳入環境變數，再用 `node` 腳本產生參數字串，避免 shell 直接處理 JSON。

## Docker

### 容器時區是 UTC

Alpine 容器預設 UTC，`TZ` 環境變數需要安裝 `tzdata` 套件才生效。node-cron 讀的是容器時區，不是主機時區。

**解法**：`Dockerfile` 加 `apk add tzdata`，`docker-compose.yml` 加 `TZ=${TZ:-UTC}`。

### 啟動時不該立即執行

scheduler 啟動時立即執行 `checkChannels()` 會導致每次 restart 重複發送 Discord。

**解法**：移除立即執行，只保留 cron 排程。使用者手動觸發用 `/check` API。

## 歌單辨識

### emoji 關鍵字誤判

`🎶`、`🎵` 等 emoji 太常見，非歌單留言也會用到，導致優先級 2 誤判。

**解法**：從預設關鍵字移除所有 emoji，只保留文字關鍵字（セトリ、setlist 等）。

### 時間戳 regex

`/\d{1,2}:\d{2}/` 會把 `2:36:39`（2 小時 36 分）錯誤匹配成 `2:36`（2 分 36 秒），導致多篇歌單的排序錯誤。

**解法**：改為 `/\d{1,2}:\d{2}(?::\d{2})?/g`，優先匹配 H:MM:SS。

### MIN_LIKES 預設值

預設 0（不過濾）會混入只有幾個時間戳的感想留言（如 115 首耐久歌枠裡只列了 4 首原創曲的留言）。

**決策**：預設改為 10，過濾低讚數的雜訊留言。使用者可自行調整。

### 3 層優先級

原本只有 2 層（時間戳+讚數 → 關鍵字），`PREFERRED_AUTHORS` 只在關鍵字匹配時加分，幾乎沒用。

問題：`MIN_LIKES=10` 會過濾掉剛發布歌枠的低讚數歌單（如讚數 6 的留言），但該留言同時包含關鍵字（セットリスト），會被優先級 3 撈回來。邏輯正確但不直覺。

**決策**：改為 3 層：
1. 指定作者（不看讚數）— 讓可信賴的留言者不被 MIN_LIKES 過濾
2. 時間戳+讚數 — 過濾雜訊
3. 關鍵字 — fallback

Log 加 `[preferred-author]`、`[timestamp+likes]`、`[keyword]` 標示命中層級，方便 debug。

### 關鍵字層級至少需要 2 個時間戳

原本優先級 3 只要有關鍵字 + 字數/行數門檻就匹配。實際遇到誤判：純感想留言「今日の歌枠も楽しかった」含 1 個時間戳和關鍵字「今日の歌」，被當成歌單。

**決策**：優先級 3 加上 `KEYWORD_MIN_TIMESTAMPS = 2` 門檻。純文字長留言沒有時間戳就不是歌單。

### 優先作者冷卻期

有 `PREFERRED_AUTHORS` 時，直播剛結束可能其他人先發了粗略歌單（只有幾個時間戳、無關鍵字），優先作者還沒來得及發，結果被優先級 2 或 3 搶先匹配。

**決策**：加 `PREFERRED_AUTHOR_COOLDOWN_HOURS`（預設 6）。直播結束後 N 小時內只匹配優先作者，N 小時後才 fallback 到其他優先級。

基準選擇 `actualEndTime`：
- 直播中/未開播 → `actualEndTime` 為 null → 視為冷卻中（永遠等優先作者）
- 已結束 → 用 `actualEndTime + N 小時` 判斷
- 不用 `scheduledStartTime`：耐久歌枠可能 10+ 小時，用開播時間會太早解除冷卻

## API Token

### URL 特殊字元

`%`、`#`、`+`、`/`、`=`、`@`、`^` 等字元在 URL 裡有特殊意義。`#` 會截斷 URL（後面被當 fragment）。

**決策**：API_TOKEN 只允許英數字（hex），推薦用線上工具產生。

## 頻道管理

### 環境變數 vs 動態管理

最初用 `YOUTUBE_CHANNELS` 環境變數，但每次加頻道都要重新部署。

**決策**：改為透過 `/channels` 網頁介面動態管理，存在 state storage 裡。新增時自動解析 @handle → channel ID 並儲存 `{ name, id }`，不會重複消耗 quota。

### initStateAdapter 順序

`ensureChannelsResolved` 需要從 state storage 讀取頻道清單，必須在 `initStateAdapter` 之後呼叫。在 scheduler、worker.js scheduled handler、handler.js EventBridge handler 三個地方都要注意這個順序。
