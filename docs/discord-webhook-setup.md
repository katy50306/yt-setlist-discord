# Discord Webhook 申請教學

## 步驟 1：建立或選擇文字頻道

在你的 Discord 伺服器中，選擇要接收歌單通知的文字頻道。
你也可以建立一個新頻道（例如 `#歌單`）。

## 步驟 2：建立 Webhook

1. 點擊頻道名稱旁的 **齒輪圖示**（編輯頻道）
2. 左側選單 → **整合** → **Webhook**
3. 點擊 **新 Webhook**
4. 設定名稱（例如 `セトリBot`），可選擇更換頭像
5. 確認 **頻道** 是你想要的
6. 點擊 **複製 Webhook URL**

## 步驟 3：填入 .env

```env
DISCORD_WEBHOOK_URLS=["https://discord.com/api/webhooks/你的webhook"]
```

### 多個頻道

如果要同時發送到多個頻道，用 JSON 陣列格式：

```env
DISCORD_WEBHOOK_URLS=["https://discord.com/api/webhooks/第一個","https://discord.com/api/webhooks/第二個"]
```

## 注意事項

- Webhook URL 包含密鑰，不要公開分享
- 每個 Webhook 綁定一個頻道，要發到不同頻道就建立多個
- Discord 訊息長度上限 2000 字元，超過會被截斷
