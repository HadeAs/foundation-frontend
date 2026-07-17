import { defineAsyncComponent, type Component } from 'vue'

type IconModule = { default: Component }

const iconLoaders = Object.fromEntries(
  Object.entries(import.meta.glob<IconModule>(
    '../../../node_modules/@ant-design/icons-vue/*Outlined.js',
    { exhaustive: true },
  )).map(([path, loader]) => [path.slice(path.lastIndexOf('/') + 1, -3), loader]),
)
const iconCache = new Map<string, Component>()
const defaultIconName = 'AppstoreOutlined'

export const menuIconNames = Object.keys(iconLoaders).sort()

export function resolveMenuIcon(name?: string) {
  const iconName = name && iconLoaders[name] ? name : defaultIconName
  const cachedIcon = iconCache.get(iconName)
  if (cachedIcon) return cachedIcon

  const loader = iconLoaders[iconName]
  const icon = defineAsyncComponent(async () => (await loader()).default)
  iconCache.set(iconName, icon)
  return icon
}
