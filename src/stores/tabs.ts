import { defineStore } from 'pinia'

const TAB_STORAGE_KEY = 'foundation.tabs'

export type PageTab = {
  path: string
  title: string
  routeName: string
  fixed?: boolean
}

function readTabs(): PageTab[] {
  try {
    const tabs = JSON.parse(sessionStorage.getItem(TAB_STORAGE_KEY) || '[]') as PageTab[]
    return Array.isArray(tabs) ? tabs : []
  } catch {
    return []
  }
}

export const useTabsStore = defineStore('tabs', {
  state: () => ({ items: readTabs() }),
  actions: {
    persist() {
      sessionStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(this.items))
    },
    add(tab: PageTab) {
      const current = this.items.find((item) => item.path === tab.path)
      if (current) Object.assign(current, tab)
      else this.items.push(tab)
      this.persist()
    },
    remove(path: string) {
      this.items = this.items.filter((item) => item.path !== path || item.fixed)
      this.persist()
    },
    closeOthers(path: string) {
      this.items = this.items.filter((item) => item.fixed || item.path === path)
      this.persist()
    },
    closeRight(path: string) {
      const index = this.items.findIndex((item) => item.path === path)
      if (index < 0) return
      this.items = this.items.filter((item, itemIndex) => item.fixed || itemIndex <= index)
      this.persist()
    },
    reconcile(paths: string[]) {
      const allowed = new Set(paths)
      this.items = this.items.filter((item) => allowed.has(item.path))
      this.persist()
    },
    clear() {
      this.items = []
      sessionStorage.removeItem(TAB_STORAGE_KEY)
    },
  },
})
