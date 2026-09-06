import dayjs from 'dayjs'
import type {
  AffinityEvent,
  ChartFilters,
  EventDraft,
  FriendProfile,
  InteractionLabel,
  RelationshipPlans,
  TimeFilter,
} from '../types'

export const TAG_COLORS = [
  '#6f7bf7',
  '#f08f6e',
  '#58b4a7',
  '#c28df5',
  '#f5c15a',
  '#6bc1ff',
  '#ef6ea8',
  '#7cc576',
]

export const clampScore = (value: number) => Math.max(-100, Math.min(100, Math.round(value)))

export const createId = () => crypto.randomUUID()

export const createInteractionLabel = (
  name: string,
  defaultDelta: number,
  index: number,
): InteractionLabel => {
  const now = new Date().toISOString()

  return {
    id: createId(),
    name,
    defaultDelta: clampScore(defaultDelta),
    color: TAG_COLORS[index % TAG_COLORS.length],
    createdAt: now,
    updatedAt: now,
  }
}

export const defaultPlans = (): RelationshipPlans => ({
  longTermPlan: '',
  attitudeNotes: '',
  actionPlan: '',
  updatedAt: new Date().toISOString(),
})

export const sortEventsDesc = (events: AffinityEvent[]) =>
  [...events].sort((a, b) => dayjs(b.happenedAt).valueOf() - dayjs(a.happenedAt).valueOf())

export const sortEventsAsc = (events: AffinityEvent[]) =>
  [...events].sort((a, b) => dayjs(a.happenedAt).valueOf() - dayjs(b.happenedAt).valueOf())

export const averageAffinity = (friends: FriendProfile[]) => {
  if (friends.length === 0) {
    return 0
  }

  const total = friends.reduce((sum, friend) => sum + friend.affinityScore, 0)
  return Math.round((total / friends.length) * 10) / 10
}

export const buildEventDraft = (
  friend: FriendProfile | null,
  labels: InteractionLabel[],
): EventDraft => {
  const selectedLabel = labels.find((label) => friend?.enabledLabelIds.includes(label.id)) ?? labels[0]

  return {
    friendId: friend?.id ?? '',
    title: '',
    details: '',
    happenedAt: dayjs().format('YYYY-MM-DDTHH:mm'),
    labelId: selectedLabel?.id ?? '',
    delta: selectedLabel?.defaultDelta ?? 0,
  }
}

export const getLabelById = (labels: InteractionLabel[], labelId: string) =>
  labels.find((label) => label.id === labelId) ?? null

export const recalculateFriendAffinity = (friend: FriendProfile): FriendProfile => {
  const ordered = sortEventsAsc(friend.events).map((event) => ({ ...event }))
  let currentAffinity = clampScore(friend.affinityBase)

  const recalculated = ordered.map((event) => {
    const beforeAffinity = currentAffinity
    const afterAffinity = clampScore(beforeAffinity + clampScore(event.delta))
    currentAffinity = afterAffinity

    return {
      ...event,
      delta: clampScore(event.delta),
      beforeAffinity,
      afterAffinity,
    }
  })

  return {
    ...friend,
    affinityBase: clampScore(friend.affinityBase),
    affinityScore: currentAffinity,
    events: sortEventsDesc(recalculated),
  }
}

export const insertEventToFriend = (
  friend: FriendProfile,
  draft: EventDraft,
  label: InteractionLabel,
): FriendProfile => {
  const nextEvent: AffinityEvent = {
    id: createId(),
    title: draft.title.trim(),
    details: draft.details.trim(),
    happenedAt: new Date(draft.happenedAt).toISOString(),
    createdAt: new Date().toISOString(),
    labelId: label.id,
    labelName: label.name,
    labelColor: label.color,
    delta: clampScore(draft.delta),
    beforeAffinity: 0,
    afterAffinity: 0,
  }

  return recalculateFriendAffinity({
    ...friend,
    events: [...friend.events, nextEvent],
    updatedAt: new Date().toISOString(),
  })
}

export const updateFriendBaseAffinity = (friend: FriendProfile, nextBase: number): FriendProfile =>
  recalculateFriendAffinity({
    ...friend,
    affinityBase: clampScore(nextBase),
    updatedAt: new Date().toISOString(),
  })

export const buildAffinityTimeline = (friend: FriendProfile) => {
  const ordered = sortEventsAsc(friend.events)
  const points = [
    {
      time: friend.createdAt,
      score: clampScore(friend.affinityBase),
      label: '基础好感',
    },
  ]

  ordered.forEach((event) => {
    points.push({
      time: event.happenedAt,
      score: event.afterAffinity,
      label: event.title,
    })
  })

  return points
}

export const buildLabelTimeline = (
  friend: FriendProfile,
  labelId: string,
  labels: InteractionLabel[],
) => {
  const label = getLabelById(labels, labelId)
  if (!label) {
    return []
  }

  const ordered = sortEventsAsc(friend.events).filter((event) => event.labelId === labelId)
  let cumulative = 0
  const points = [
    {
      time: friend.createdAt,
      score: 0,
      label: `${label.name} 初始值`,
    },
  ]

  ordered.forEach((event) => {
    cumulative = clampScore(cumulative + event.delta)
    points.push({
      time: event.happenedAt,
      score: cumulative,
      label: event.title,
    })
  })

  return points
}

export const filterTimelinePoints = <
  T extends {
    time: string
    score: number
  },
>(
  points: T[],
  filters: Pick<ChartFilters, 'timeFilter' | 'customStart' | 'customEnd' | 'valueRange'>,
) => {
  const [minValue, maxValue] = filters.valueRange
  const start = resolveRangeStart(filters.timeFilter, filters.customStart)
  const end = filters.timeFilter === 'custom' && filters.customEnd
    ? dayjs(filters.customEnd).endOf('day')
    : undefined

  return points.filter((point) => {
    const time = dayjs(point.time)
    const inTimeRange = (!start || time.isAfter(start) || time.isSame(start))
      && (!end || time.isBefore(end) || time.isSame(end))
    const inValueRange = point.score >= minValue && point.score <= maxValue
    return inTimeRange && inValueRange
  })
}

export const resolveRangeStart = (filter: TimeFilter, customStart: string) => {
  if (filter === 'custom') {
    return customStart ? dayjs(customStart).startOf('day') : undefined
  }

  if (filter === 'week') {
    return dayjs().subtract(7, 'day')
  }

  if (filter === 'month') {
    return dayjs().subtract(1, 'month')
  }

  if (filter === 'year') {
    return dayjs().subtract(1, 'year')
  }

  return undefined
}

export const formatDateTime = (value?: string) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '暂无记录'

export const buildSparklinePath = (values: number[], width: number, height: number) => {
  if (values.length === 0) {
    return ''
  }

  if (values.length === 1) {
    const y = height - ((values[0] + 100) / 200) * height
    return `M 0 ${y} L ${width} ${y}`
  }

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value + 100) / 200) * height
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}
