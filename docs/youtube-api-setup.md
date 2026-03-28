# YouTube Data API v3 申請教學

## 步驟 1：建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 登入 Google 帳號
3. 點擊頂部的專案選擇器 → **新增專案**
4. 輸入專案名稱（例如 `yt-setlist`）→ **建立**

## 步驟 2：啟用 YouTube Data API v3

1. 在左側選單選擇 **API 和服務** → **程式庫**
2. 搜尋 `YouTube Data API v3`
3. 點擊進入 → **啟用**

## 步驟 3：建立 API 金鑰

1. 左側選單 → **API 和服務** → **憑證**
2. 點擊 **建立憑證** → **API 金鑰**
3. 系統會產生一組金鑰，複製它

## 步驟 4（建議）：限制 API 金鑰

為了安全，建議限制金鑰的使用範圍：

1. 在憑證頁面，點擊剛建立的金鑰
2. **應用程式限制** → 選擇 **無**（或依你的部署方式設定 IP 限制）
3. **API 限制** → 選擇 **限制金鑰** → 只勾選 **YouTube Data API v3**
4. 儲存

## 配額說明

YouTube Data API 每日免費配額為 **10,000 units**。

本服務的 API 消耗：

| API 呼叫 | 消耗 | 用途 |
|----------|------|------|
| `playlistItems` | 1 unit | 取得頻道最新影片 |
| `videos` | 1 unit | 取得影片詳細資訊 |
| `commentThreads` | 1 unit | 取得影片留言 |
| `channels` | 1 unit | 解析 @handle（僅首次，之後快取） |

**計算範例**：3 個頻道，每天檢查一次，每次平均 2 部新影片：
3 × (1 + 2 × 2) = **15 units/天**，遠低於免費上限。

## 將金鑰填入 .env

```env
YOUTUBE_API_KEY=你的金鑰
```
