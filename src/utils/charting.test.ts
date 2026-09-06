import { describe, expect, it } from 'vitest'
import { createInteractionLabel, recalculateFriendAffinity } from './affinity'
import { buildEventRecords, buildHomeChartSeries, buildLabelAggregateSeries } from './charting'
import type { FriendProfile, HomeChartFilters } from '../types'

const labels = [
  createInteractionLabel('主动陪伴', 12, 0),
  createInteractionLabel('深度交流', 18, 1),
]

const createFriend = (
  id: string,
  name: string,
  affinityBase: number,
  createdAt: string,
  eventDelta: number,
  eventTime: string,
): FriendProfile =>
  recalculateFriendAffinity({
    id,
    name,
    role: '测试关系',
    avatarSeed: name,
    createdAt,
    updatedAt: createdAt,
    affinityBase,
    affinityScore: affinityBase,
    enabledLabelIds: labels.map((label) => label.id),
    events: [
      {
        id: `${id}-event`,
        title: '共同复盘',
        details: '',
        happenedAt: eventTime,
        createdAt: eventTime,
        labelId: labels[0].id,
        labelName: labels[0].name,
        labelColor: labels[0].color,
        delta: eventDelta,
        beforeAffinity: 0,
        afterAffinity: 0,
      },
    ],
    plans: {
      longTermPlan: '',
      attitudeNotes: '',
      actionPlan: '',
      updatedAt: createdAt,
    },
  })

const friends = [
  createFriend('f1', '林夏', 20, '2026-01-01T00:00:00.000Z', 10, '2026-01-05T00:00:00.000Z'),
  createFriend('f2', '顾晨', 30, '2026-01-02T00:00:00.000Z', 6, '2026-01-08T00:00:00.000Z'),
]

const baseFilters: HomeChartFilters = {
  mode: 'all',
  singleFriendId: friends[0].id,
  labelId: labels[0].id,
  eventId: '',
  multiFriendIds: friends.map((friend) => friend.id),
  timeFilter: 'all',
  customStart: '',
  customEnd: '',
  valueRange: [-100, 100],
}

describe('charting utils', () => {
  it('支持单用户与多用户折线序列构建', () => {
    const single = buildHomeChartSeries(friends, labels, {
      ...baseFilters,
      mode: 'single',
    })
    const multi = buildHomeChartSeries(friends, labels, {
      ...baseFilters,
      mode: 'multi',
      multiFriendIds: [friends[0].id, friends[1].id],
    })

    expect(single).toHaveLength(1)
    expect(single[0].name).toBe('林夏')
    expect(multi).toHaveLength(2)
  })

  it('支持按标签聚合所有关联用户趋势', () => {
    const aggregate = buildLabelAggregateSeries(friends, labels, labels[0].id, {
      timeFilter: 'all',
      customStart: '',
      customEnd: '',
      valueRange: [-100, 100],
    })

    expect(aggregate).not.toBeNull()
    expect(aggregate?.name).toContain('主动陪伴')
    expect(aggregate?.data.length).toBeGreaterThan(1)
  })

  it('支持按指定事件聚焦对应时间范围', () => {
    const eventId = buildEventRecords(friends)[0].event.id
    const series = buildHomeChartSeries(friends, labels, {
      ...baseFilters,
      mode: 'event',
      eventId,
    })

    expect(series).toHaveLength(1)
    expect(series[0].eventMarkerTime).toBeTruthy()
    expect(series[0].data.length).toBeGreaterThan(1)
  })
})
