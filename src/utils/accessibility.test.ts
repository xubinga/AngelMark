import { describe, expect, it } from 'vitest'
import { contrastRatio } from './accessibility'

describe('WCAG contrast checks', () => {
  it('保证浅色主题控件与选项区域达到 AA 对比度', () => {
    expect(contrastRatio('#142033', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#142033', '#f4f7fb')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#1f4fd1')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#2647c7')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#5a2bb7')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#a62b4f', '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('保证深色主题控件与选项区域达到 AA 对比度', () => {
    expect(contrastRatio('#f4f7fb', '#162131')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#f4f7fb', '#182232')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#3155d4')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#3155d4')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#5b2fb6')).toBeGreaterThanOrEqual(4.5)
  })
})
