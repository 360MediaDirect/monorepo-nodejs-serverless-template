import { UserModel } from '../models/UserModel'

const user = new UserModel()
user.id = '3a310a50-0498-40e7-9004-bab00e175cc8'
user.email = 'api@this.com'
user.firstName = 'This'
user.lastName = 'API'
user.source = 'internal'
user.domainScopes = {
  auth: ['getUsers', 'createUser', 'getAnyUser'],
}
;(async () => {
  console.log(await user.createRefreshToken())
})()
