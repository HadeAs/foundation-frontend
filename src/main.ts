import 'ant-design-vue/dist/reset.css'
import './styles/base.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { createAppRouter } from './router'
import { syncDynamicRoutes } from './router/dynamic'
import { useAuthStore } from './stores/auth'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  const router = createAppRouter(pinia)

  app.use(pinia)
  const auth = useAuthStore(pinia)
  await auth.restore()
  if (auth.isAuthenticated) syncDynamicRoutes(router, auth.user?.menus || [])
  app.use(router)
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
