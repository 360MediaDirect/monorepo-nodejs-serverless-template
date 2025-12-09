import log from '@360mediadirect/log'
import { unmarshallItem } from '@aws/dynamodb-data-marshaller'
import { Handler, DynamoDBRecord } from 'aws-lambda'
import AWS from 'aws-sdk'

import { asyncForEach } from '../../../common/util/misc'
import { ddbSchemaOrg } from './models/OrganizationModel'

export const sns = new AWS.SNS()

export const fire: Handler = async (event, _context, _callback) => {
  log.debug('Function call: ', event)

  const { Records } = event

  await asyncForEach(Records, async (record: DynamoDBRecord) => {
    log.debug('For each DDB record', record)
    if (!record.dynamodb?.NewImage?.id?.S) {
      log.warn(
        'Unexpected DDB streams message in auth.ddbOrgWarehouseHandler',
        {
          record,
        },
      )
      return undefined
    }

    // publish to SNS fifo topic
    const msg = {
      TopicArn: process.env.AUTH_WAREHOUSE_TOPIC_ARN,
      Message: JSON.stringify({
        tableName: process.env.ORG_WAREHOUSE_TABLE_NAME,
        entityRecord: unmarshallItem(ddbSchemaOrg, record.dynamodb?.NewImage),
        cKeys: ['id'],
      }),
      MessageDeduplicationId: `${record.dynamodb?.NewImage?.id?.S}_${record.dynamodb?.NewImage?.updatedAt.N}`,
      MessageGroupId: `${process.env.ORG_WAREHOUSE_TABLE_NAME}_${record.dynamodb?.NewImage?.id?.S}`,
    }
    await sns.publish(msg).promise()
  })
}
