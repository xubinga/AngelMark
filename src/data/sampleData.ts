import dayjs from 'dayjs'
import {
  createInteractionLabel,
  defaultPlans,
  insertEventToFriend,
  recalculateFriendAffinity,
} from '../utils/affinity'
import type { AppState, FriendProfile } from '../types'

const createFriend = (
  name: string,
  role: string,
  avatarSeed: string,
  affinityBase: number,
  enabledLabelIds: string[],
  plans: FriendProfile['plans'],
): FriendProfile => {
  const createdAt = dayjs().subtract(90, 'day').toISOString()

  return {
    id: crypto.randomUUID(),
    name,
    role,
    avatarSeed,
    createdAt,
    updatedAt: dayjs().toISOString(),
    affinityBase,
    affinityScore: affinityBase,
    enabledLabelIds,
    events: [],
    plans,
  }
}

export const createSampleState = (): AppState => {
  const baseDate = dayjs()
  const interactionLabels = [
    createInteractionLabel('主动陪伴', 12, 0),
    createInteractionLabel('深度交流', 18, 1),
    createInteractionLabel('合作顺畅', 10, 2),
    createInteractionLabel('失约冷淡', -16, 3),
    createInteractionLabel('临时关心', 8, 4),
  ]

  let friendA = createFriend(
    '林夏',
    '老朋友 / 游戏搭子',
    'linxia',
    44,
    interactionLabels.slice(0, 4).map((item) => item.id),
    {
      longTermPlan: '继续维持稳定联系，争取把共同项目推进成长期合作。',
      attitudeNotes: '近两周回复积极，愿意主动分享近况。',
      actionPlan: '下周约一次语音复盘近况，并整理一个共同游戏清单。',
      updatedAt: baseDate.toISOString(),
    },
  )

  let friendB = createFriend(
    '顾晨',
    '新认识 / 线下社群',
    'guchen',
    22,
    interactionLabels.slice(0, 3).map((item) => item.id),
    {
      longTermPlan: '先维持轻量联系，观察是否适合发展为深度朋友。',
      attitudeNotes: '对活动邀约比较开放，但主动性一般。',
      actionPlan: '月底前主动发起一次咖啡局，看看线下节奏。',
      updatedAt: baseDate.toISOString(),
    },
  )

  let friendC = createFriend(
    '周宁',
    '合作伙伴 / 内容共创',
    'zhouning',
    38,
    interactionLabels.filter((item) => item.defaultDelta >= 0).map((item) => item.id),
    defaultPlans(),
  )

  friendA = insertEventToFriend(
    friendA,
    {
      friendId: friendA.id,
      title: '一起打本并复盘近况',
      details: '沟通顺畅，对后续一起做内容的兴趣明显提高。',
      happenedAt: baseDate.subtract(45, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[0].id,
      delta: 12,
    },
    interactionLabels[0],
  )
  friendA = insertEventToFriend(
    friendA,
    {
      friendId: friendA.id,
      title: '深聊个人规划',
      details: '互相交换了对未来半年安排的想法，信任感提升明显。',
      happenedAt: baseDate.subtract(22, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[1].id,
      delta: 18,
    },
    interactionLabels[1],
  )
  friendA = insertEventToFriend(
    friendA,
    {
      friendId: friendA.id,
      title: '共同完成一次直播测试',
      details: '任务分工顺畅，双方对后续合作预期提高。',
      happenedAt: baseDate.subtract(9, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[2].id,
      delta: 10,
    },
    interactionLabels[2],
  )

  friendB = insertEventToFriend(
    friendB,
    {
      friendId: friendB.id,
      title: '线下活动初次合作',
      details: '整体配合不错，但还在磨合节奏。',
      happenedAt: baseDate.subtract(18, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[2].id,
      delta: 9,
    },
    interactionLabels[2],
  )
  friendB = insertEventToFriend(
    friendB,
    {
      friendId: friendB.id,
      title: '几天未回应邀约',
      details: '连续几次话题中断，互动热度下降。',
      happenedAt: baseDate.subtract(8, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[3].id,
      delta: -12,
    },
    interactionLabels[3],
  )

  friendC = insertEventToFriend(
    friendC,
    {
      friendId: friendC.id,
      title: '共创脚本分工确认',
      details: '需求拆解完整，沟通效率很高。',
      happenedAt: baseDate.subtract(14, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[2].id,
      delta: 14,
    },
    interactionLabels[2],
  )
  friendC = insertEventToFriend(
    friendC,
    {
      friendId: friendC.id,
      title: '突然主动分享阶段成果',
      details: '对项目投入感更强，也更愿意同步细节。',
      happenedAt: baseDate.subtract(5, 'day').format('YYYY-MM-DDTHH:mm'),
      labelId: interactionLabels[4].id,
      delta: 8,
    },
    interactionLabels[4],
  )

  return {
    settings: {
      theme: 'light',
      accentPrimary: '#6f7bf7',
      accentSecondary: '#9b7dff',
      surfaceTint: '#eef2f8',
    },
    interactionLabels,
    friends: [friendA, friendB, recalculateFriendAffinity(friendC)],
  }
}
