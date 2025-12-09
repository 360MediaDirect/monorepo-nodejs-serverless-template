import { createController } from '@360mediadirect/restler'
import { OrganizationModel } from '../models/OrganizationModel'
import log from '@360mediadirect/log'

export const getOrgById = createController(async (req, res) => {
  const { id } = req.params
  log.debug('Get Org By Id', { id })
  const org = await OrganizationModel.get({ id })
  res.status(200).json([org])
})

/**
 * Lists 25 users at a time, paginating by the lastEvaluatedKey query value.
 * Optionally, an `email` query can be specified to simply retrieve the user
 * with that identifier.
 */
export const getOrganizations = createController(async (req, res) => {
  let orgs: any
  try {
    const { lastEvaluatedKey } = req.query
    orgs = (
      await OrganizationModel.getActiveOrganizations(
        50,
        lastEvaluatedKey as Record<string, any>,
      )
    ).map((org) => {
      if (org.domainScopes) delete org.domainScopes
      return org
    })
  } catch (e) {
    console.log(e.stack)
    throw e
  }
  res.status(200).json(orgs)
})
