import SwaggerUI from 'swagger-ui'
import 'swagger-ui/dist/swagger-ui.css'

SwaggerUI({
  domNode: document.body,
  url: 'openapi-full.json'
})
