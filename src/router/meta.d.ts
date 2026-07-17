import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    title?: string
    icon?: string
    menuId?: number
    fixedTab?: boolean
    keepAlive?: boolean
  }
}
