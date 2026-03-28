const STATE_PK = 'yt-setlist-state'
const DYNAMODB_MODULE = '@aws-sdk/client-' + 'dynamodb'

let client = null
let GetItemCommand = null
let PutItemCommand = null

async function ensureImported() {
  if (client) return
  const mod = await import(DYNAMODB_MODULE)
  client = new mod.DynamoDBClient({})
  GetItemCommand = mod.GetItemCommand
  PutItemCommand = mod.PutItemCommand
}

export function createDynamoDBAdapter(tableName) {
  return {
    name: 'dynamodb',

    async load() {
      await ensureImported()
      const res = await client.send(new GetItemCommand({
        TableName: tableName,
        Key: { pk: { S: STATE_PK } },
      }))
      const raw = res.Item?.data?.S
      if (!raw) return { processedVideos: {} }
      return JSON.parse(raw)
    },

    async save(state) {
      await ensureImported()
      await client.send(new PutItemCommand({
        TableName: tableName,
        Item: {
          pk: { S: STATE_PK },
          data: { S: JSON.stringify(state) },
        },
      }))
    },
  }
}
