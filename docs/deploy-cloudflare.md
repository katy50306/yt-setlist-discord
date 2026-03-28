# 部署到 Cloudflare Workers（透過 GitHub Actions）

完全在瀏覽器操作，不需要安裝任何工具。

## 步驟 1：建立 Cloudflare 帳號

1. 前往 [Cloudflare](https://dash.cloudflare.com/sign-up) 註冊（免費）
2. 登入後進入帳戶首頁
3. 點擊右上角的 **⋮ 選單** → **複製帳戶 ID**（之後會用到）

## 步驟 2：建立 API Token

1. 同樣在右上角 **⋮ 選單** → **管理帳戶 API 權杖**
2. 點擊 **建立權杖**
3. 找到 **編輯 Cloudflare Workers** 模板 → 點擊 **使用範本**
4. 確認權限包含：
   - 帳戶: Workers KV 儲存空間 → **編輯**
   - 帳戶: Workers 指令碼 → **編輯**
5. **區域資源**：將「特定區域」改為「**帳戶的所有區域**」
6. 其他設定（客戶端 IP 篩選、TTL）不用改
7. 點擊 **繼續至摘要** → **建立Token**
6. **複製 Token**（只會顯示一次，請先存好）

## 步驟 3：Fork 儲存庫

1. 前往本專案的 GitHub 頁面
2. 點擊右上角 **Fork**
3. 確認建立

## 步驟 4：設定 GitHub Secrets

1. 進入你 Fork 的 repo → **Settings** → **Secrets and variables** → **Actions**
2. 點擊 **New repository secret**，逐一新增以下 Secrets：

| Secret 名稱 | 值 | 說明 |
|-------------|-----|------|
| `CLOUDFLARE_API_TOKEN` | 步驟 2 建立的 Token | Cloudflare 認證 |
| `CLOUDFLARE_ACCOUNT_ID` | 步驟 1 記下的 Account ID | Cloudflare 帳號 |
| `YOUTUBE_API_KEY` | 你的 YouTube API 金鑰 | [申請教學](youtube-api-setup.md) |
| `DISCORD_WEBHOOK_URLS` | `["https://discord.com/api/webhooks/..."]` | [申請教學](discord-webhook-setup.md) |
| `API_TOKEN` | 自行設定的密碼（只用英數字） | HTTP API 認證用 |

## 步驟 5：觸發部署

1. 進入 **Actions** 頁籤
2. 左側選擇 **Deploy to Cloudflare Workers**
3. 點擊 **Run workflow** → **Run workflow**
4. 等待綠色勾勾 ✓ 表示部署成功

## 步驟 6：新增頻道

1. 在瀏覽器打開 `https://yt-setlist-discord.<你的子域>.workers.dev/channels?token=你的密碼`
2. 在輸入框中輸入要監控的頻道（@handle 或 YouTube URL，每行一個或逗號分隔）
3. 點擊新增

## 完成

部署後：
- Workers 會每天自動檢查頻道的新歌單
- `/channels` 頁面可隨時新增或移除頻道
- `/status?token=你的密碼` 查看服務狀態

## 之後更新

每次你 push 到 main 分支，GitHub Actions 會自動重新部署。

## 進階：CLI 部署

如果你偏好用命令列：

```bash
npm install -g wrangler
wrangler login
wrangler kv namespace create STATE_KV
# 把回傳的 id 填入 wrangler.toml
wrangler secret put YOUTUBE_API_KEY
wrangler secret put DISCORD_WEBHOOK_URLS
wrangler secret put API_TOKEN
wrangler deploy
# 然後打開 /channels 頁面新增頻道
```
