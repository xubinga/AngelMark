import { describe, expect, it } from 'vitest'
import {
  buildAffinityTimeline,
  buildEventDraft,
  buildLabelTimeline,
  clampScore,
  createInteractionLabel,
  insertEventToFriend,
  recalculateFriendAffinity,
} from './affinity'
import type { FriendProfile } from '../types'

const labels = [
  createInteractionLabel('主动陪伴', 12, 0),
  createInteractionLabel('深度交流', 18, 1),
]

const createFriend = (): FriendProfile => ({
  id: 'friend-1',
  name: '测试好友',
  role: '测试关系',
  avatarSeed: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  affinityBase: 20,
  affinityScore: 20,
  enabledLabelIds: labels.map((item) => item.id),
  events: [],
  plans: {
    longTermPlan: '',
    attitudeNotes: '',
    actionPlan: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
})

describe('affinity utils', () => {
  it('限制分值在 -100 到 100 之间', () => {
    expect(clampScore(180)).toBe(100)
    expect(clampScore(-220)).toBe(-100)
    expect(clampScore(25.8)).toBe(26)
  })

  it('插入历史事件后会重算总好感前后值', () => {
    const friend = createFriend()
    const draft = buildEventDraft(friend, labels)
    draft.title = '一次深聊'
    draft.happenedAt = '2026-02-01T18:30'
    draft.labelId = labels[1].id
    draft.delta = 25

    const updated = insertEventToFriend(friend, draft, labels[1])

    expect(updated.affinityScore).toBe(45)
    expect(updated.events).toHaveLength(1)
    expect(updated.events[0]).toMatchObject({
      beforeAffinity: 20,
      afterAffinity: 45,
      delta: 25,
    })
  })

  it('根据互动标签构建累计时间轴', () => {
    const friend = createFriend()
    const updated = recalculateFriendAffinity({
      ...friend,
      events: [
        {
          id: 'e1',
          title: '聊天',
          details: '',
          happenedAt: '2026-01-03T10:00:00.000Z',
          createdAt: '2026-01-03T10:05:00.000Z',
          labelId: labels[0].id,
          labelName: labels[0].name,
          labelColor: labels[0].color,
          delta: 8,
          beforeAffinity: 0,
          afterAffinity: 0,
        },
        {
          id: 'e2',
          title: '约饭',
          details: '',
          happenedAt: '2026-01-04T10:00:00.000Z',
          createdAt: '2026-01-04T10:05:00.000Z',
          labelId: labels[0].id,
          labelName: labels[0].name,
          labelColor: labels[0].color,
          delta: 6,
          beforeAffinity: 0,
          afterAffinity: 0,
        },
      ],
    })

    const timeline = buildLabelTimeline(updated, labels[0].id, labels)
    const totalTimeline = buildAffinityTimeline(updated)

    expect(timeline).toHaveLength(3)
    expect(timeline[0].score).toBe(0)
    expect(timeline[2].score).toBe(14)
    expect(totalTimeline[2].score).toBe(34)
  })
})
