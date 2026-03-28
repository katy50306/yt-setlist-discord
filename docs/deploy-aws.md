# 部署到 AWS Lambda（透過 GitHub Actions）

完全在瀏覽器操作，不需要安裝任何工具。

## 步驟 1：建立 AWS 帳號

1. 前往 [AWS](https://aws.amazon.com/) 註冊（需要信用卡，但 free tier 不收費）
2. 登入 AWS Console

## 步驟 2：建立 IAM 使用者

1. 前往 [IAM Console](https://console.aws.amazon.com/iam/)
2. 左側選擇 **人員** → **建立人員**
3. 輸入名稱（例如 `yt-setlist-deploy`）
4. **許可選項** → **直接連接政策**，搜尋並勾選：
   - `AWSLambda_FullAccess`
   - `AmazonDynamoDBFullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AmazonEventBridgeFullAccess`
   - `AmazonS3FullAccess`
   - `AWSCloudFormationFullAccess`
   - `IAMFullAccess`
5. 建立人員
## 步驟 3：建立 Access Key

1. 點擊剛建立的使用者
2. **安全憑證** 頁籤 → **建立存取金鑰**
3. 選擇 **命令列界面 (CLI)**
4. **複製 存取金鑰 和 私密存取金鑰**（只會顯示一次）

## 步驟 4：Fork 儲存庫

1. 前往本專案的 GitHub 頁面
2. 點擊右上角 **Fork**
3. 確認建立

## 步驟 5：設定 GitHub Secrets

1. 進入你 Fork 的 repo → **Settings** → **Secrets and variables** → **Actions**
2. 點擊 **New repository secret**，逐一新增以下 Secrets：

| Secret 名稱 | 值 | 說明 |
|-------------|-----|------|
| `AWS_ACCESS_KEY_ID` | 步驟 3 的 Access Key ID | AWS 認證 |
| `AWS_SECRET_ACCESS_KEY` | 步驟 3 的 Secret Access Key | AWS 認證 |
| `AWS_REGION` | `ap-northeast-1` | 部署區域（東京），可改其他區域 |
| `YOUTUBE_API_KEY` | 你的 YouTube API 金鑰 | [申請教學](youtube-api-setup.md) |
| `DISCORD_WEBHOOK_URLS` | `["https://discord.com/api/webhooks/..."]` | [申請教學](discord-webhook-setup.md) |
| `API_TOKEN` | 自行設定的密碼（只用英數字） | HTTP API 認證用 |
| `AWS_CRON_SCHEDULE` | `cron(0 0 * * ? *)` | （可選）自訂排程，不設則每天 UTC 00:00 |

## 步驟 6：觸發部署

1. 進入 **Actions** 頁籤
2. 左側選擇 **Deploy to AWS Lambda**
3. 點擊 **Run workflow** → **Run workflow**
4. 等待綠色勾勾 ✓ 表示部署成功

## 步驟 7：新增頻道

1. 部署完成後，Actions 的 log 裡會顯示 HTTP API 端點 URL
2. 在瀏覽器打開 `https://<端點>/channels?token=你的密碼`
3. 在輸入框中輸入要監控的頻道
4. 點擊新增

## 完成

部署後：
- Lambda 會每天自動檢查頻道的新歌單
- `/channels` 頁面可隨時新增或移除頻道
- `/status?token=你的密碼` 查看服務狀態

## 之後更新

每次你 push 到 main 分支，GitHub Actions 會自動重新部署。

## 費用

在 AWS Free Tier 範圍內：
- Lambda：每月 100 萬次免費調用
- DynamoDB：25GB 儲存 + 25 WCU/RCU 免費
- API Gateway：每月 100 萬次免費

本服務每天只觸發一次，遠低於免費上限。

## 進階：CLI 部署

如果你偏好用命令列：

```bash
# 安裝 SAM CLI
# https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

sam build
sam deploy --guided
```
