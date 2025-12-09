import { createController, createError } from '@360mediadirect/restler'
import { UserModel } from '../../models/UserModel'
import { UserIdentifierModel } from '../../models/UserIdentifierModel'
import { embassy } from '../../lib/authorizer'
import { createMagicToken } from '@360mediadirect/auth-helper'
import {
  ALLOWED_URL_DOMAINS,
  MAGIC_LINK_TEMPLATES,
  PRODUCTS,
} from '../../../../../common/constants'

const ALLOWED_URL_DOMAINS_EXTENDED: string[] = (
  process.env.ALLOWED_URLS?.split(',') || []
).concat(ALLOWED_URL_DOMAINS)

const MAGIC_LINK_TEMPLATE_MAP = {
  [PRODUCTS.LIBRARY]: process.env.LIBRARY_MAGIC_LINK_TEMPLATE_ALIAS
    ? process.env.LIBRARY_MAGIC_LINK_TEMPLATE_ALIAS
    : MAGIC_LINK_TEMPLATES.DEFAULT,
  [PRODUCTS.PORTAL]: process.env.PORTAL_MAGIC_LINK_TEMPLATE_ALIAS
    ? process.env.PORTAL_MAGIC_LINK_TEMPLATE_ALIAS
    : MAGIC_LINK_TEMPLATES.PORTAL,
}

/**
 * Throws an HTTP 400 error if the URL provided for the magic link does not
 * have a domain name on the allow list. Note that this function ignores
 * subdomains unless a subdomain is explicitly added to the allow list.
 * Otherwise, 'distroslate.com' appearing on the allow list will have the
 * effect of allowing the 'library.distroslate.com' as well as the
 * 'read.clickneadmags.com' URLs.
 * @param url The base URL to be used for the magic link
 * @throws HTTPError with code=400 if the url's domain is not allowlisted.
 */
const assertUrlAllowed = (url: string): void => {
  const parsed = new URL(url)
  const match = ALLOWED_URL_DOMAINS_EXTENDED.some((domain) => {
    return (
      parsed.hostname === domain ||
      (parsed.hostname.length > domain.length &&
        parsed.hostname.lastIndexOf('.' + domain) ===
          parsed.hostname.length - domain.length - 1)
    )
  })
  if (!match) throw createError(400, 'Provided URL is not on the allow list')
}

export const requestMagicLink = createController(async (req, res) => {
  const { email, url = process.env.MAGIC_LINK_URL, product } = req.body
  assertUrlAllowed(url)
  const cleanEmail = email.trim().toLowerCase()
  let user: UserModel
  try {
    user = await UserIdentifierModel.getUser(cleanEmail)
  } catch (e) {
    if (e.name !== 'ItemNotFoundException') throw e
    // User was not found. Let the client know.
    res.status(401)
    res.json({
      message: `Sorry, we couldn't find an account for ${cleanEmail}`,
    })
    return undefined
  }
  // User was found. Create a token with it, sign, and deliver
  const signed = await createMagicToken({
    embassy,
    email: cleanEmail,
    userId: user.id,
  })
  // await postmark.sendEmailWithTemplate({
  //   TemplateAlias:
  //     MAGIC_LINK_TEMPLATE_MAP[product] || MAGIC_LINK_TEMPLATES.DEFAULT,
  //   From: process.env.FROM_EMAIL,
  //   To: cleanEmail,
  //   TemplateModel: {
  //     // Email heading is, "Your magic link is here, {firstName}!"
  //     firstName: user.firstName || 'awaiting your click',
  //     actionUrl: `${url}?token=${signed}`,
  //   },
  // })
  res.status(200)
  res.json({
    message: `A magic link has been emailed to ${cleanEmail}`,
  })
})
