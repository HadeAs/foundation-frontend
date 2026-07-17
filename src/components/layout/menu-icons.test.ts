import { describe, expect, it } from 'vitest'

import { menuIconNames, resolveMenuIcon } from './menu-icons'

describe('menu icons', () => {
  it('exposes all outlined Ant Design Vue icons', () => {
    expect(menuIconNames.length).toBeGreaterThan(400)
    expect(menuIconNames.every((name) => name.endsWith('Outlined'))).toBe(true)
    expect(menuIconNames).toContain('AccountBookOutlined')
    expect(menuIconNames).toContain('AppstoreOutlined')
    expect(menuIconNames).not.toContain('AccountBookFilled')
    expect(menuIconNames).not.toContain('SmileTwoTone')
  })

  it('falls back to the app icon for an unknown name', () => {
    expect(resolveMenuIcon('MissingIcon')).toBe(resolveMenuIcon('AppstoreOutlined'))
  })
})
