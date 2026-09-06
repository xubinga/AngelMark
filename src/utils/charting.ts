import dayjs from 'dayjs'
import { buildAffinityTimeline, buildLabelTimeline, filterTimelinePoints } from './affinity'
import type { AffinityEvent, FriendProfile, HomeChartFilters, InteractionLabel } from '../types'

type TimelinePoint = {
  time: string
  score: number
  label: string
}

export type ChartSeriesConfig = {
  id: string
  name: string
  color: string
  data: Array<[string, number]>
  eventMarkerTime?: string
}

export type EventRecord = {
  friend: FriendProfile
  event: AffinityEvent
}

const totalSeriesColor = (index: number, labels: InteractionLabel[]) =>
  labels[index % Math.max(labels.length, 1)]?.color ?? '#6f7bf7'

const applyFilters = (
  points: TimelinePoint[],
  filters: Pick<HomeChartFilters, 'timeFilter' | 'customStart' | 'customEnd' | 'valueRange'>,
) => filterTimelinePoints(points, filters).map((point) => [point.time, point.score] as [string, number])

const buildTotalSeries = (
  friend: FriendProfile,
  index: number,
  labels: InteractionLabel[],
  filters: Pick<HomeChartFilters, 'timeFilter' | 'customStart' | 'customEnd' | 'valueRange'>,
): ChartSeriesConfig => ({
  id: friend.id,
  name: friend.name,
  color: totalSeriesColor(index, labels),
  data: applyFilters(buildAffinityTimeline(friend), filters),
})

const scoreAtTime = (points: TimelinePoint[], targetTime: string) => {
  const target = dayjs(targetTime).valueOf()
  let lastScore = points[0]?.score ?? 0

  for (const point of points) {
    if (dayjs(point.time).valueOf() > target) {
      break
    }
    lastScore = point.score
  }

  return lastScore
}

export const buildEventRecords = (friends: FriendProfile[]): EventRecord[] =>
  friends.flatMap((friend) =>
    friend.events.map((event) => ({
      friend,
      event,
    })))

export const buildLabelAggregateSeries = (
  friends: FriendProfile[],
  labels: InteractionLabel[],
  labelId: string,
  filters: Pick<HomeChartFilters, 'timeFilter' | 'customStart' | 'customEnd' | 'valueRange'>,
): ChartSeriesConfig | null => {
  const label = labels.find((item) => item.id === labelId)
  if (!label) {
    return null
  }

  const relevantFriends = friends.filter((friend) => friend.enabledLabelIds.includes(labelId))
  if (relevantFriends.length === 0) {
    return null
  }

  const timelines = relevantFriends.map((friend) => buildLabelTimeline(friend, labelId, labels))
  const uniqueTimes = Array.from(new Set(timelines.flatMap((points) => points.map((point) => point.time))))
    .sort((left, right) => dayjs(left).valueOf() - dayjs(right).valueOf())

  const aggregatedPoints = uniqueTimes.map((time) => ({
    time,
    score: Math.round(
      timelines.reduce((sum, points) => sum + scoreAtTime(points, time), 0) / timelines.length,
    ),
    label: `${label.name} 聚合`,
  }))

  return {
    id: `label:${label.id}`,
    name: `${label.name} 聚合趋势`,
    color: label.color,
    data: applyFilters(aggregatedPoints, filters),
  }
}

export const buildEventFocusedSeries = (
  eventRecord: EventRecord | null,
  labels: InteractionLabel[],
  valueRange: [number, number],
): ChartSeriesConfig | null => {
  if (!eventRecord) {
    return null
  }

  const { friend, event } = eventRecord
  const filters = {
    timeFilter: 'custom' as const,
    customStart: dayjs(event.happenedAt).subtract(7, 'day').format('YYYY-MM-DD'),
    customEnd: dayjs(event.happenedAt).add(7, 'day').format('YYYY-MM-DD'),
    valueRange,
  }

  const timeline = buildAffinityTimeline(friend)
  const start = dayjs(filters.customStart).startOf('day')
  const precedingPoint = [...timeline]
    .reverse()
    .find((point) => dayjs(point.time).isBefore(start))
  const filtered = applyFilters(timeline, filters)

  if (precedingPoint && !filtered.some(([time]) => time === precedingPoint.time)) {
    filtered.unshift([precedingPoint.time, precedingPoint.score])
  }

  const color = labels.find((label) => label.id === event.labelId)?.color ?? totalSeriesColor(0, labels)

  return {
    id: `event:${event.id}`,
    name: `${friend.name} · ${event.title}`,
    color,
    data: filtered,
    eventMarkerTime: event.happenedAt,
  }
}

export const buildHomeChartSeries = (
  friends: FriendProfile[],
  labels: InteractionLabel[],
  filters: HomeChartFilters,
): ChartSeriesConfig[] => {
  const sharedFilters = {
    timeFilter: filters.timeFilter,
    customStart: filters.customStart,
    customEnd: filters.customEnd,
    valueRange: filters.valueRange,
  }

  if (filters.mode === 'single') {
    const friend = friends.find((item) => item.id === filters.singleFriendId)
    return friend ? [buildTotalSeries(friend, 0, labels, sharedFilters)] : []
  }

  if (filters.mode === 'multi') {
    return friends
      .filter((friend) => filters.multiFriendIds.includes(friend.id))
      .map((friend, index) => buildTotalSeries(friend, index, labels, sharedFilters))
  }

  if (filters.mode === 'label') {
    const aggregate = buildLabelAggregateSeries(friends, labels, filters.labelId, sharedFilters)
    return aggregate ? [aggregate] : []
  }

  if (filters.mode === 'event') {
    const eventRecord = buildEventRecords(friends).find((item) => item.event.id === filters.eventId) ?? null
    const focused = buildEventFocusedSeries(eventRecord, labels, filters.valueRange)
    return focused ? [focused] : []
  }

  return friends.map((friend, index) => buildTotalSeries(friend, index, labels, sharedFilters))
}
