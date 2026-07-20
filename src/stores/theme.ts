import { defineStore } from 'pinia'

const THEME_STORAGE_KEY = 'foundation.theme'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ThemeDensity = 'compact' | 'standard'

type ThemeState = {
  mode: ThemeMode
  primaryColor: string
  radius: 0 | 6 | 10
  density: ThemeDensity
}

const defaults: ThemeState = {
  mode: 'light',
  primaryColor: '#0d9496',
  radius: 6,
  density: 'compact',
}

function readTheme(): ThemeState {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{}') }
  } catch {
    return defaults
  }
}

export const useThemeStore = defineStore('theme', {
  state: readTheme,
  actions: {
    persist() {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(this.$state))
    },
    reset() {
      this.$patch(defaults)
    },
  },
})
