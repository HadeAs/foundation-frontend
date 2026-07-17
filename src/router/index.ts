import type { Pinia } from 'pinia'
import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/layouts/AppLayout.vue'

import { getFirstAccessiblePath } from './dynamic'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    name: 'root-layout',
    component: AppLayout,
    children: [],
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/errors/forbidden.vue'),
    meta: { title: '无权限' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export function createAppRouter(pinia: Pinia) {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  })

  router.beforeEach((to) => {
    const auth = useAuthStore(pinia)
    if (to.meta.public) return auth.isAuthenticated ? getFirstAccessiblePath() || '/403' : true
    if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
    if (to.path === '/') return getFirstAccessiblePath() || '/403'
    return true
  })

  router.afterEach((to) => {
    document.title = to.meta.title
      ? `${String(to.meta.title)} · 工业系统管理平台`
      : '工业系统管理平台'
  })

  return router
}
