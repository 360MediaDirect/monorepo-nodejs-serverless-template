import { createController } from '@360mediadirect/restler'
import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

const sns = new AWS.SNS()

export const clientLog = createController(async (req, res) => {
  const { level, message, data } = req.body || {}

  req.log[level]?.(message, data)

  const id = uuidv4()
  const now = Date.now()

  if (data.toWarehouse) {
    delete data.toWarehouse
    const msg = {
      TopicArn: process.env.LOG_WAREHOUSE_TOPIC_ARN,
      Message: JSON.stringify({
        tableName: process.env.LOG_WAREHOUSE_TABLE_NAME,
        entityRecord: {
          id,
          level,
          message,
          data,
          timestamp: now,
        },
      }),
      MessageDeduplicationId: `${id}_${now}`,
      MessageGroupId: `${process.env.LOG_WAREHOUSE_TABLE_NAME}_${id}`,
    }
    await sns.publish(msg).promise()
  }

  res.status(204)
})
