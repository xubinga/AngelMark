import { createSampleState } from '../data/sampleData'
import {
  averageAffinity,
  createId,
  createInteractionLabel,
  defaultPlans,
  recalculateFriendAffinity,
  sortEventsDesc,
} from './affinity'
import type { AppSettings, AppState, FriendProfile, InteractionLabel } from '../types'

const STORAGE_KEY = 'angelmark.app-state.v3'
const LEGACY_STORAGE_KEY = 'angelmark.app-state.v2'
const LEGACY_STORAGE_KEY_V1 = 'angelmark.app-state.v1'

const defaultSettings = (): AppSettings => ({
  theme: 'light',
  accentPrimary: '#6f7bf7',
  accentSecondary: '#9b7dff',
  surfaceTint: '#eef2f8',
})

const normalizeSettings = (settings: Partial<AppSettings> | undefined, legacyTheme?: unknown): AppSettings => {
  const defaults = defaultSettings()

  return {
    theme:
      settings?.theme === 'dark'
        ? 'dark'
        : legacyTheme === 'dark'
          ? 'dark'
          : defaults.theme,
    accentPrimary: settings?.accentPrimary || defaults.accentPrimary,
    accentSecondary: settings?.accentSecondary || defaults.accentSecondary,
    surfaceTint: settings?.surfaceTint || defaults.surfaceTint,
  }
}

const normalizeLabel = (label: Partial<InteractionLabel>, index: number): InteractionLabel => ({
  id: label.id ?? createId(),
  name: label.name?.trim() || `互动标签 ${index + 1}`,
  defaultDelta: Number(label.defaultDelta ?? 0),
  color: label.color ?? createInteractionLabel('fallback', 0, index).color,
  createdAt: label.createdAt ?? new Date().toISOString(),
  updatedAt: label.updatedAt ?? new Date().toISOString(),
})

const normalizeFriend = (friend: Partial<FriendProfile>, labels: InteractionLabel[]): FriendProfile =>
  recalculateFriendAffinity({
    id: friend.id ?? createId(),
    name: friend.name?.trim() || '未命名好友',
    role: friend.role?.trim() || '待补充关系定位',
    avatarSeed: friend.avatarSeed || friend.name || 'angelmark',
    avatarImage: friend.avatarImage,
    createdAt: friend.createdAt ?? new Date().toISOString(),
    updatedAt: friend.updatedAt ?? new Date().toISOString(),
    affinityBase: Number(friend.affinityBase ?? friend.affinityScore ?? 0),
    affinityScore: Number(friend.affinityScore ?? friend.affinityBase ?? 0),
    enabledLabelIds: (friend.enabledLabelIds ?? []).filter((id): id is string =>
      labels.some((label) => label.id === id)),
    events: sortEventsDesc(friend.events ?? []),
    plans: friend.plans ?? defaultPlans(),
  })

const migrateLegacyState = (legacy: any): AppState => {
  const legacyTagNames = Array.from(
    new Set(
      (legacy?.friends ?? [])
        .flatMap((friend: any) => friend.tags ?? [])
        .map((tag: any) => tag.name)
        .filter(Boolean),
    ),
  )

  const interactionLabels = (
    legacyTagNames.length > 0
      ? legacyTagNames.map((name, index) => createInteractionLabel(String(name), 8, index))
      : [
        createInteractionLabel('主动互动', 10, 0),
        createInteractionLabel('深度交流', 16, 1),
        createInteractionLabel('历史迁移事件', 6, 2),
      ]
  )

  const migratedFriends = (legacy?.friends ?? []).map((friend: any) => {
    const currentAffinity = averageAffinity([
      {
        affinityScore:
          typeof friend?.affinityScore === 'number'
            ? friend.affinityScore
            : Math.round(
              ((friend?.tags ?? []).reduce((sum: number, tag: any) => sum + Number(tag.score ?? 0), 0)
                / Math.max((friend?.tags ?? []).length, 1)),
            ),
      } as FriendProfile,
    ])
    const legacyEvents = (friend?.events ?? []).map((event: any) => {
      const adjustments = event?.adjustments ?? []
      const averageDelta = adjustments.length > 0
        ? Math.round(
          adjustments.reduce((sum: number, item: any) => sum + Number(item.delta ?? 0), 0) / adjustments.length,
        )
        : 0
      const firstTagName = adjustments[0]?.tagName
      const label = interactionLabels.find((item) => item.name === firstTagName) ?? interactionLabels[0]

      return {
        id: event.id ?? createId(),
        title: event.title ?? label.name,
        details: event.details ?? '',
        happenedAt: event.happenedAt ?? new Date().toISOString(),
        createdAt: event.createdAt ?? new Date().toISOString(),
        labelId: label.id,
        labelName: label.name,
        labelColor: label.color,
        delta: averageDelta,
        beforeAffinity: 0,
        afterAffinity: 0,
      }
    })

    const totalDelta = legacyEvents.reduce((sum: number, event: any) => sum + Number(event.delta ?? 0), 0)

    return recalculateFriendAffinity({
      id: friend.id ?? createId(),
      name: friend.name ?? '迁移好友',
      role: friend.role ?? '迁移档案',
      avatarSeed: friend.avatarSeed ?? friend.name ?? 'angelmark',
      createdAt: friend.createdAt ?? new Date().toISOString(),
      updatedAt: friend.updatedAt ?? new Date().toISOString(),
      affinityBase: currentAffinity - totalDelta,
      affinityScore: currentAffinity,
      enabledLabelIds: interactionLabels.map((item) => item.id),
      avatarImage: undefined,
      events: legacyEvents,
      plans: friend.plans ?? defaultPlans(),
    })
  })

  return {
    settings: normalizeSettings(undefined, legacy?.theme),
    interactionLabels,
    friends: migratedFriends.length > 0 ? migratedFriends : createSampleState().friends,
  }
}

export const normalizeState = (input: any): AppState => {
  if (input?.interactionLabels && Array.isArray(input.interactionLabels)) {
    const interactionLabels = input.interactionLabels.map(normalizeLabel)
    return {
      settings: normalizeSettings(input.settings, input.theme),
      interactionLabels,
      friends: (input.friends ?? []).map((friend: Partial<FriendProfile>) =>
        normalizeFriend(friend, interactionLabels)),
    }
  }

  return migrateLegacyState(input)
}

export const loadState = (): AppState => {
  if (typeof window === 'undefined') {
    return createSampleState()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return normalizeState(JSON.parse(raw))
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw) {
      return normalizeState(JSON.parse(legacyRaw))
    }

    const legacyRawV1 = window.localStorage.getItem(LEGACY_STORAGE_KEY_V1)
    if (legacyRawV1) {
      return normalizeState(JSON.parse(legacyRawV1))
    }

    return createSampleState()
  } catch {
    return createSampleState()
  }
}

export const saveState = (state: AppState) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
