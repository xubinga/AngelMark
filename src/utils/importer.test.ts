import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { createInteractionLabel } from './affinity'
import { parseFriendWorkbook } from './importer'

const toBuffer = (rows: Array<Record<string, string | number>>) => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Friends')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

describe('parseFriendWorkbook', () => {
  it('可以解析标准 XLSX 档案并映射全局标签', () => {
    const labels = [
      createInteractionLabel('主动陪伴', 12, 0),
      createInteractionLabel('深度交流', 18, 1),
    ]

    const buffer = toBuffer([
      {
        好友名称: '阿澈',
        关系定位: '社群朋友',
        基础好感: 32,
        关联标签: '主动陪伴,深度交流',
        长期关系发展规划: '先保持稳定沟通',
      },
    ])

    const result = parseFriendWorkbook(buffer, labels)

    expect(result.errors).toEqual([])
    expect(result.friends).toHaveLength(1)
    expect(result.friends[0].name).toBe('阿澈')
    expect(result.friends[0].enabledLabelIds).toEqual(labels.map((label) => label.id))
    expect(result.friends[0].plans.longTermPlan).toBe('先保持稳定沟通')
  })

  it('会拦截缺少名称、越界好感和不存在标签的数据', () => {
    const labels = [createInteractionLabel('主动陪伴', 12, 0)]
    const buffer = toBuffer([
      {
        好友名称: '',
        基础好感: 30,
      },
      {
        好友名称: '顾晨',
        基础好感: 180,
      },
      {
        好友名称: '周宁',
        基础好感: 24,
        关联标签: '不存在的标签',
      },
    ])

    const result = parseFriendWorkbook(buffer, labels)

    expect(result.friends).toHaveLength(0)
    expect(result.errors).toEqual([
      '第 2 行缺少“好友名称 / name”字段。',
      '第 3 行的基础好感必须是 -100 到 100 的数字。',
      '第 4 行引用了不存在的标签：不存在的标签。',
    ])
  })
})
