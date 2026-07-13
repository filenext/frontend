import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { useBrandingStore } from './stores/branding'

import '@tabler/core/dist/css/tabler.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './styles/app.css'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)
  app.use(router)

  const branding = useBrandingStore(pinia)
  await branding.load()

  app.mount('#app')
}

bootstrap()
