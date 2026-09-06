import * as XLSX from 'xlsx'
import { createId, defaultPlans } from './affinity'
import type { FriendProfile, InteractionLabel } from '../types'

type RawSheetRow = Record<string, unknown>

const HEADER_MAP = {
  name: ['name', '好友名称', '姓名', 'friendname'],
  role: ['role', '关系定位', '角色', 'friendrole'],
  affinityBase: ['affinitybase', '基础好感', '好感度', 'baseaffinity'],
  enabledLabels: ['enabledlabels', '关联标签', '标签', 'labels'],
  longTermPlan: ['longtermplan', '长期关系发展规划', '长期判断'],
  attitudeNotes: ['attitudenotes', '对方近期态度记录', '近期态度'],
  actionPlan: ['actionplan', '自身调整执行计划', '执行计划'],
} as const

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

const readField = (row: RawSheetRow, aliases: readonly string[]) => {
  const entries = Object.entries(row)
  const match = entries.find(([key]) => aliases.includes(normalizeHeader(key)))
  return match?.[1]
}

const parseLabelNames = (value: unknown) =>
  String(value ?? '')
    .split(/[;,，、|]/)
    .map((item) => item.trim())
    .filter(Boolean)

export const parseFriendWorkbook = (
  buffer: ArrayBuffer,
  labels: InteractionLabel[],
): { friends: FriendProfile[]; errors: string[] } => {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return {
      friends: [],
      errors: ['未找到可解析的工作表，请确认 XLSX 文件至少包含一个 sheet。'],
    }
  }

  const rows = XLSX.utils.sheet_to_json<RawSheetRow>(workbook.Sheets[sheetName], {
    defval: '',
  })

  if (rows.length === 0) {
    return {
      friends: [],
      errors: ['表格内容为空，无法导入角色档案。'],
    }
  }

  const errors: string[] = []
  const friends: FriendProfile[] = []

  rows.forEach((row, index) => {
    const line = index + 2
    const name = String(readField(row, HEADER_MAP.name) ?? '').trim()
    const role = String(readField(row, HEADER_MAP.role) ?? '').trim() || '批量导入档案'
    const affinityRaw = readField(row, HEADER_MAP.affinityBase)
    const labelNames = parseLabelNames(readField(row, HEADER_MAP.enabledLabels))

    if (!name) {
      errors.push(`第 ${line} 行缺少“好友名称 / name”字段。`)
      return
    }

    const affinityBase = Number(affinityRaw || 0)
    if (!Number.isFinite(affinityBase) || affinityBase < -100 || affinityBase > 100) {
      errors.push(`第 ${line} 行的基础好感必须是 -100 到 100 的数字。`)
      return
    }

    const enabledLabelIds = labelNames
      .map((labelName) => labels.find((label) => label.name === labelName)?.id ?? null)
      .filter((value): value is string => Boolean(value))

    if (labelNames.length > 0 && enabledLabelIds.length !== labelNames.length) {
      const missing = labelNames.filter((labelName) => !labels.some((label) => label.name === labelName))
      errors.push(`第 ${line} 行引用了不存在的标签：${missing.join('、')}。`)
      return
    }

    const now = new Date().toISOString()
    friends.push({
      id: createId(),
      name,
      role,
      avatarSeed: name,
      createdAt: now,
      updatedAt: now,
      affinityBase: Math.round(affinityBase),
      affinityScore: Math.round(affinityBase),
      enabledLabelIds,
      events: [],
      plans: {
        ...defaultPlans(),
        longTermPlan: String(readField(row, HEADER_MAP.longTermPlan) ?? '').trim(),
        attitudeNotes: String(readField(row, HEADER_MAP.attitudeNotes) ?? '').trim(),
        actionPlan: String(readField(row, HEADER_MAP.actionPlan) ?? '').trim(),
        updatedAt: now,
      },
    })
  })

  return { friends, errors }
}
