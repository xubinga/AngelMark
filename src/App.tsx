import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import ReactECharts from 'echarts-for-react'
import './App.css'
import {
  averageAffinity,
  buildAffinityTimeline,
  buildEventDraft,
  buildSparklinePath,
  clampScore,
  createId,
  createInteractionLabel,
  defaultPlans,
  formatDateTime,
  getLabelById,
  insertEventToFriend,
  updateFriendBaseAffinity,
} from './utils/affinity'
import { buildEventRecords, buildHomeChartSeries } from './utils/charting'
import { parseFriendWorkbook } from './utils/importer'
import { loadState, normalizeState, saveState } from './utils/storage'
import type {
  AppSettings,
  AppState,
  BatchDraft,
  EventDraft,
  FriendProfile,
  HomeChartFilters,
  InteractionLabel,
  NavigationPage,
  SearchResult,
} from './types'

const ANIMATION_MS = 300
type TransitionState = {
  from: NavigationPage
  to: NavigationPage
  reverse: boolean
}

const defaultBatchDraft = (): BatchDraft => ({
  affinityDelta: 0,
  addLabelIds: [],
  removeLabelIds: [],
})

const defaultFriendForm = () => ({
  name: '',
  role: '',
  affinityBase: 0,
})

const createDefaultHomeChartFilters = (state: AppState): HomeChartFilters => {
  const firstFriendId = state.friends[0]?.id ?? ''
  const firstLabelId = state.interactionLabels[0]?.id ?? ''
  const firstEventId = state.friends.flatMap((friend) => friend.events)[0]?.id ?? ''

  return {
    mode: 'all',
    singleFriendId: firstFriendId,
    labelId: firstLabelId,
    eventId: firstEventId,
    multiFriendIds: state.friends.slice(0, 3).map((friend) => friend.id),
    timeFilter: 'all',
    customStart: '',
    customEnd: '',
    valueRange: [-100, 100],
  }
}

const avatarUrl = (friend: FriendProfile) =>
  friend.avatarImage
  || `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(friend.avatarSeed)}`

const cloneState = (state: AppState): AppState => JSON.parse(JSON.stringify(state)) as AppState

const mixWithAlpha = (hex: string, alpha: number) => {
  const value = hex.replace('#', '')
  const normalized = value.length === 3
    ? value.split('').map((char) => `${char}${char}`).join('')
    : value

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function App() {
  const [initialState] = useState(() => loadState())
  const [appState, setAppState] = useState<AppState>(initialState)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    initialState.friends[0]?.id ?? null,
  )
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home')
  const [transition, setTransition] = useState<TransitionState | null>(null)
  const [notice, setNotice] = useState('')
  const [friendForm, setFriendForm] = useState(defaultFriendForm())
  const [isFriendFormOpen, setIsFriendFormOpen] = useState(false)
  const [labelForm, setLabelForm] = useState({ name: '', defaultDelta: 10 })
  const [eventDraft, setEventDraft] = useState<EventDraft>(() =>
    buildEventDraft(initialState.friends[0] ?? null, initialState.interactionLabels))
  const [homeChartFilters, setHomeChartFilters] = useState<HomeChartFilters>(() =>
    createDefaultHomeChartFilters(initialState))
  const [batchDraft, setBatchDraft] = useState<BatchDraft>(defaultBatchDraft())
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])
  const [confirmDeleteFriendId, setConfirmDeleteFriendId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [highlightLabelId, setHighlightLabelId] = useState<string | null>(null)
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null)
  const [avatarEditor, setAvatarEditor] = useState<{
    isOpen: boolean
    friendId: string | null
    src: string
    zoom: number
    offsetX: number
    offsetY: number
  }>({
    isOpen: false,
    friendId: null,
    src: '',
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importSummary, setImportSummary] = useState('')
  const backupInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const searchCloseTimerRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const undoStackRef = useRef<AppState[]>([])
  const redoStackRef = useRef<AppState[]>([])

  const selectedFriend = useMemo(
    () => appState.friends.find((friend) => friend.id === selectedFriendId) ?? appState.friends[0] ?? null,
    [appState.friends, selectedFriendId],
  )

  const allEventRecords = useMemo(() => buildEventRecords(appState.friends), [appState.friends])
  const selectedEventRecord = useMemo(
    () => allEventRecords.find((item) => item.event.id === homeChartFilters.eventId) ?? null,
    [allEventRecords, homeChartFilters.eventId],
  )

  useEffect(() => {
    if (!selectedFriend && appState.friends[0]) {
      setSelectedFriendId(appState.friends[0].id)
    }
  }, [appState.friends, selectedFriend])

  useEffect(() => {
    setHomeChartFilters((current) => {
      const nextSingleFriendId = appState.friends.some((friend) => friend.id === current.singleFriendId)
        ? current.singleFriendId
        : appState.friends[0]?.id ?? ''
      const nextLabelId = appState.interactionLabels.some((label) => label.id === current.labelId)
        ? current.labelId
        : appState.interactionLabels[0]?.id ?? ''
      const nextEventId = allEventRecords.some((item) => item.event.id === current.eventId)
        ? current.eventId
        : allEventRecords[0]?.event.id ?? ''
      const nextMultiFriendIds = current.multiFriendIds.filter((friendId) =>
        appState.friends.some((friend) => friend.id === friendId))

      return {
        ...current,
        singleFriendId: nextSingleFriendId,
        labelId: nextLabelId,
        eventId: nextEventId,
        multiFriendIds: nextMultiFriendIds.length > 0 ? nextMultiFriendIds : appState.friends.slice(0, 3).map((friend) => friend.id),
      }
    })
  }, [allEventRecords, appState.friends, appState.interactionLabels])

  useEffect(() => {
    saveState(appState)
  }, [appState])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const handleUndoShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z'
      const isRedo = (event.ctrlKey || event.metaKey) && (key === 'y' || (event.shiftKey && key === 'z'))

      if (!isUndo && !isRedo) {
        return
      }

      event.preventDefault()
      if (isUndo) {
        triggerUndo()
      } else {
        triggerRedo()
      }
    }

    window.addEventListener('keydown', handleUndoShortcuts)
    return () => window.removeEventListener('keydown', handleUndoShortcuts)
  })

  useEffect(() => {
    return () => {
      if (searchCloseTimerRef.current) {
        window.clearTimeout(searchCloseTimerRef.current)
      }
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current)
      }
    }
  }, [])

  const showNotice = (message: string) => {
    setNotice(message)
  }

  const shellStyle = useMemo(() => buildShellStyle(appState.settings), [appState.settings])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return [] as SearchResult[]
    }

    const items: SearchResult[] = [
      ...appState.friends.map((friend) => ({
        id: `friend:${friend.id}`,
        kind: 'friend' as const,
        title: friend.name,
        subtitle: friend.role,
        keywords: [friend.name, friend.role],
        friendId: friend.id,
      })),
      ...appState.interactionLabels.map((label) => ({
        id: `label:${label.id}`,
        kind: 'label' as const,
        title: label.name,
        subtitle: `互动标签 · 默认增减 ${label.defaultDelta}`,
        keywords: [label.name, String(label.defaultDelta)],
        labelId: label.id,
      })),
      ...allEventRecords.map(({ friend, event }) => ({
        id: `event:${event.id}`,
        kind: 'event' as const,
        title: event.title,
        subtitle: `${friend.name} · ${formatDateTime(event.happenedAt)}`,
        keywords: [event.title, event.details, event.labelName, friend.name],
        friendId: friend.id,
        eventId: event.id,
      })),
    ]

    return items
      .filter((item) => item.keywords.join(' ').toLowerCase().includes(query))
      .sort((left, right) => {
        const leftStarts = left.title.toLowerCase().startsWith(query) ? 0 : 1
        const rightStarts = right.title.toLowerCase().startsWith(query) ? 0 : 1
        return leftStarts - rightStarts
      })
      .slice(0, 8)
  }, [allEventRecords, appState.friends, appState.interactionLabels, searchQuery])

  const homeChartSeries = useMemo(
    () => buildHomeChartSeries(appState.friends, appState.interactionLabels, homeChartFilters),
    [appState.friends, appState.interactionLabels, homeChartFilters],
  )

  const homeChartSummary = useMemo(() => {
    switch (homeChartFilters.mode) {
      case 'single': {
        const friend = appState.friends.find((item) => item.id === homeChartFilters.singleFriendId)
        return friend ? `单人专属趋势：${friend.name}` : '单人专属趋势'
      }
      case 'label': {
        const label = appState.interactionLabels.find((item) => item.id === homeChartFilters.labelId)
        return label ? `标签聚合：${label.name}` : '标签聚合'
      }
      case 'event':
        return selectedEventRecord
          ? `事件窗口：${selectedEventRecord.friend.name} · ${selectedEventRecord.event.title}`
          : '事件窗口'
      case 'multi':
        return `多人同屏对比：${homeChartFilters.multiFriendIds.length} 人`
      default:
        return `全量总览：${appState.friends.length} 位好友`
    }
  }, [appState.friends, appState.interactionLabels, homeChartFilters, selectedEventRecord])

  const homeChartOption = useMemo(() => ({
    animationDuration: 220,
    animationDurationUpdate: 180,
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      top: 8,
      textStyle: {
        color: appState.settings.theme === 'dark' ? '#f4f7fb' : '#142033',
      },
    },
    toolbox: {
      right: 8,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {},
      },
      iconStyle: {
        borderColor: appState.settings.theme === 'dark' ? '#f4f7fb' : '#142033',
      },
    },
    dataZoom: [
      { type: 'inside', throttle: 50 },
      { type: 'slider', height: 20, bottom: 4 },
    ],
    grid: {
      left: 48,
      right: 24,
      top: 72,
      bottom: 56,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => dayjs(value).format('MM-DD'),
      },
    },
    yAxis: {
      type: 'value',
      min: -100,
      max: 100,
      splitNumber: 5,
    },
    series: homeChartSeries.map((series) => ({
      id: series.id,
      name: series.name,
      type: 'line',
      smooth: 0.25,
      showSymbol: false,
      lineStyle: {
        width: 3,
        color: series.color,
      },
      itemStyle: {
        color: series.color,
      },
      markLine: series.eventMarkerTime
        ? {
          symbol: 'none',
          lineStyle: {
            type: 'dashed',
            color: series.color,
            opacity: 0.72,
          },
          label: {
            formatter: '事件点',
          },
          data: [{ xAxis: series.eventMarkerTime }],
        }
        : undefined,
      data: series.data,
    })),
  }), [appState.settings.theme, homeChartSeries])

  const commitState = (
    nextState: AppState,
    options?: {
      notice?: string
      selectedFriendId?: string | null
      skipHistory?: boolean
    },
  ) => {
    if (!options?.skipHistory) {
      undoStackRef.current = [...undoStackRef.current.slice(-49), cloneState(appState)]
      redoStackRef.current = []
    }

    setAppState(nextState)
    const requestedId = options?.selectedFriendId ?? selectedFriendId
    const nextSelected = nextState.friends.find((friend) => friend.id === requestedId)
      ?? nextState.friends[0]
      ?? null
    setSelectedFriendId(nextSelected?.id ?? null)
    setSelectedBatchIds((current) =>
      current.filter((friendId) => nextState.friends.some((friend) => friend.id === friendId)))
    setEventDraft(buildEventDraft(nextSelected, nextState.interactionLabels))
    if (options?.notice) {
      showNotice(options.notice)
    }
  }

  const triggerUndo = () => {
    const previous = undoStackRef.current.pop()
    if (!previous) {
      showNotice('当前没有可撤销的操作')
      return
    }

    redoStackRef.current = [...redoStackRef.current.slice(-49), cloneState(appState)]
    setAppState(previous)
    const nextSelected = previous.friends.find((friend) => friend.id === selectedFriendId) ?? previous.friends[0] ?? null
    setSelectedFriendId(nextSelected?.id ?? null)
    setEventDraft(buildEventDraft(nextSelected, previous.interactionLabels))
    showNotice('已撤销上一步操作')
  }

  const triggerRedo = () => {
    const next = redoStackRef.current.pop()
    if (!next) {
      showNotice('当前没有可重做的操作')
      return
    }

    undoStackRef.current = [...undoStackRef.current.slice(-49), cloneState(appState)]
    setAppState(next)
    const nextSelected = next.friends.find((friend) => friend.id === selectedFriendId) ?? next.friends[0] ?? null
    setSelectedFriendId(nextSelected?.id ?? null)
    setEventDraft(buildEventDraft(nextSelected, next.interactionLabels))
    showNotice('已重做上一步操作')
  }

  const navigateTo = (nextPage: NavigationPage, options?: { reverse?: boolean }) => {
    const activePage = transition?.to ?? currentPage
    if (nextPage === activePage) {
      return
    }

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current)
    }

    setTransition({
      from: currentPage,
      to: nextPage,
      reverse: options?.reverse ?? false,
    })
    transitionTimerRef.current = window.setTimeout(() => {
      setCurrentPage(nextPage)
      setTransition(null)
      transitionTimerRef.current = null
    }, ANIMATION_MS)
  }

  const handleSelectFriend = (friendId: string) => {
    const friend = appState.friends.find((item) => item.id === friendId) ?? null
    setSelectedFriendId(friendId)
    setEventDraft(buildEventDraft(friend, appState.interactionLabels))
  }

  const handleCreateFriend = () => {
    if (!friendForm.name.trim()) {
      showNotice('请先填写好友名称')
      return
    }

    const now = new Date().toISOString()
    const newFriend: FriendProfile = {
      id: createId(),
      name: friendForm.name.trim(),
      role: friendForm.role.trim() || '待补充关系定位',
      avatarSeed: friendForm.name.trim(),
      createdAt: now,
      updatedAt: now,
      affinityBase: clampScore(friendForm.affinityBase),
      affinityScore: clampScore(friendForm.affinityBase),
      enabledLabelIds: appState.interactionLabels.slice(0, 3).map((label) => label.id),
      events: [],
      plans: defaultPlans(),
    }

    commitState(
      {
        ...appState,
        friends: [newFriend, ...appState.friends],
      },
      {
        notice: '好友档案已创建',
        selectedFriendId: newFriend.id,
      },
    )
    setFriendForm(defaultFriendForm())
    setIsFriendFormOpen(false)
  }

  const handleDeleteFriend = () => {
    const targetId = confirmDeleteFriendId
    if (!targetId) {
      return
    }

    const remaining = appState.friends.filter((friend) => friend.id !== targetId)
    commitState(
      {
        ...appState,
        friends: remaining,
      },
      {
        notice: '好友档案已删除',
        selectedFriendId: remaining[0]?.id ?? null,
      },
    )
    setConfirmDeleteFriendId(null)
  }

  const handleCreateLabel = () => {
    if (!labelForm.name.trim()) {
      showNotice('请填写互动标签名称')
      return
    }

    const nextLabel = createInteractionLabel(
      labelForm.name.trim(),
      labelForm.defaultDelta,
      appState.interactionLabels.length,
    )

    commitState(
      {
        ...appState,
        interactionLabels: [...appState.interactionLabels, nextLabel],
      },
      {
        notice: '互动标签已创建并加入全局标签库',
        selectedFriendId,
      },
    )
    setLabelForm({ name: '', defaultDelta: 10 })
  }

  const handleLabelFieldChange = (
    labelId: string,
    patch: Partial<Pick<InteractionLabel, 'name' | 'defaultDelta'>>,
  ) => {
    commitState(
      {
        ...appState,
        interactionLabels: appState.interactionLabels.map((label) =>
          label.id === labelId
            ? {
              ...label,
              name: patch.name ?? label.name,
              defaultDelta: clampScore(patch.defaultDelta ?? label.defaultDelta),
              updatedAt: new Date().toISOString(),
            }
            : label),
      },
      {
        notice: '互动标签已更新',
        selectedFriendId,
      },
    )
  }

  const handleDeleteLabel = (labelId: string) => {
    commitState(
      {
        ...appState,
        interactionLabels: appState.interactionLabels.filter((label) => label.id !== labelId),
        friends: appState.friends.map((friend) => ({
          ...friend,
          enabledLabelIds: friend.enabledLabelIds.filter((id) => id !== labelId),
          updatedAt: new Date().toISOString(),
        })),
      },
      {
        notice: '互动标签已删除',
        selectedFriendId,
      },
    )
  }

  const handleToggleFriendLabel = (labelId: string) => {
    if (!selectedFriend) {
      return
    }

    const nextFriends = appState.friends.map((friend) => {
      if (friend.id !== selectedFriend.id) {
        return friend
      }

      return {
        ...friend,
        enabledLabelIds: friend.enabledLabelIds.includes(labelId)
          ? friend.enabledLabelIds.filter((id) => id !== labelId)
          : [...friend.enabledLabelIds, labelId],
        updatedAt: new Date().toISOString(),
      }
    })

    commitState(
      {
        ...appState,
        friends: nextFriends,
      },
      {
        notice: '当前好友的关联标签已更新',
        selectedFriendId: selectedFriend.id,
      },
    )
  }

  const handlePlanChange = (
    field: 'longTermPlan' | 'attitudeNotes' | 'actionPlan',
    value: string,
  ) => {
    if (!selectedFriend) {
      return
    }

    commitState(
      {
        ...appState,
        friends: appState.friends.map((friend) =>
          friend.id === selectedFriend.id
            ? {
              ...friend,
              plans: {
                ...friend.plans,
                [field]: value,
                updatedAt: new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            }
            : friend),
      },
      {
        selectedFriendId: selectedFriend.id,
      },
    )
  }

  const handleSubmitEvent = () => {
    const targetFriend = appState.friends.find((friend) => friend.id === eventDraft.friendId) ?? null
    if (!targetFriend) {
      showNotice('请先选择要关联事件的好友')
      return
    }

    const selectedLabel = getLabelById(appState.interactionLabels, eventDraft.labelId)
    if (!selectedLabel) {
      showNotice('请先选择一个有效的互动标签')
      return
    }

    if (!targetFriend.enabledLabelIds.includes(selectedLabel.id)) {
      showNotice('当前好友尚未关联该互动标签')
      return
    }

    if (!eventDraft.title.trim()) {
      showNotice('请填写事件标题')
      return
    }

    const nextFriend = insertEventToFriend(targetFriend, eventDraft, selectedLabel)
    commitState(
      {
        ...appState,
        friends: appState.friends.map((friend) => (friend.id === targetFriend.id ? nextFriend : friend)),
      },
      {
        notice: '互动事件已创建',
        selectedFriendId: targetFriend.id,
      },
    )
  }

  const handleBatchApply = () => {
    if (selectedBatchIds.length === 0) {
      showNotice('请先选择至少一个好友档案')
      return
    }

    commitState(
      {
        ...appState,
        friends: appState.friends.map((friend) => {
          if (!selectedBatchIds.includes(friend.id)) {
            return friend
          }

          const nextLabelIds = friend.enabledLabelIds
            .filter((id) => !batchDraft.removeLabelIds.includes(id))
            .concat(batchDraft.addLabelIds.filter((id) => !friend.enabledLabelIds.includes(id)))

          return updateFriendBaseAffinity(
            {
              ...friend,
              enabledLabelIds: Array.from(new Set(nextLabelIds)),
              updatedAt: new Date().toISOString(),
            },
            friend.affinityBase + batchDraft.affinityDelta,
          )
        }),
      },
      {
        notice: '批量好感度调整已完成',
        selectedFriendId,
      },
    )
    setBatchDraft(defaultBatchDraft())
  }

  const handleExportBackup = () => {
    const payload = {
      schema: 'angelmark-backup.v3',
      exportedAt: new Date().toISOString(),
      data: appState,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `angelmark-backup-${dayjs().format('YYYYMMDD-HHmmss')}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    showNotice('备份文件已导出')
  }

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    try {
      const parsed = JSON.parse(text)
      const nextState = normalizeState(parsed.data ?? parsed)
      commitState(nextState, {
        notice: '备份数据已恢复',
        selectedFriendId: nextState.friends[0]?.id ?? null,
      })
    } catch {
      showNotice('备份文件解析失败，请检查 JSON 内容')
    } finally {
      event.target.value = ''
    }
  }

  const handleOpenAvatarEditor = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedFriend) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAvatarEditor({
        isOpen: true,
        friendId: selectedFriend.id,
        src: String(reader.result ?? ''),
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleSaveAvatar = async () => {
    if (!avatarEditor.friendId || !avatarEditor.src) {
      return
    }

    const image = new Image()
    image.src = avatarEditor.src
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('图片加载失败'))
    })

    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 240
    const context = canvas.getContext('2d')
    if (!context) {
      showNotice('头像裁剪失败')
      return
    }

    const drawWidth = image.width * avatarEditor.zoom
    const drawHeight = image.height * avatarEditor.zoom
    const x = (canvas.width - drawWidth) / 2 + avatarEditor.offsetX
    const y = (canvas.height - drawHeight) / 2 + avatarEditor.offsetY

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, x, y, drawWidth, drawHeight)
    const nextAvatar = canvas.toDataURL('image/png')

    commitState(
      {
        ...appState,
        friends: appState.friends.map((friend) =>
          friend.id === avatarEditor.friendId
            ? {
              ...friend,
              avatarImage: nextAvatar,
              updatedAt: new Date().toISOString(),
            }
            : friend),
      },
      {
        notice: '头像已更新',
        selectedFriendId: avatarEditor.friendId,
      },
    )
    setAvatarEditor((current) => ({ ...current, isOpen: false }))
  }

  const handleImportWorkbook = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const result = parseFriendWorkbook(buffer, appState.interactionLabels)
      setImportErrors(result.errors)

      if (result.friends.length === 0) {
        setImportSummary('')
        showNotice('没有可导入的有效档案，请检查表格字段')
        return
      }

      commitState(
        {
          ...appState,
          friends: [...result.friends, ...appState.friends],
        },
        {
          notice: `已导入 ${result.friends.length} 份角色档案`,
          selectedFriendId: result.friends[0].id,
        },
      )
      setImportSummary(`成功导入 ${result.friends.length} 份档案`)
    } catch {
      setImportErrors(['XLSX 文件解析失败，请确认文件格式和 sheet 内容。'])
      setImportSummary('')
      showNotice('XLSX 解析失败')
    } finally {
      event.target.value = ''
    }
  }

  const updateSettings = (patch: Partial<AppSettings>) => {
    commitState(
      {
        ...appState,
        settings: {
          ...appState.settings,
          ...patch,
        },
      },
      {
        notice: '系统设置已更新',
        selectedFriendId,
      },
    )
  }

  const updateHomeFilter = <K extends keyof HomeChartFilters>(key: K, value: HomeChartFilters[K]) => {
    setHomeChartFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleSearchSelect = (result: SearchResult) => {
    setSearchQuery('')
    setIsSearchOpen(false)

    if (result.kind === 'friend' && result.friendId) {
      setHighlightLabelId(null)
      setHighlightEventId(null)
      handleSelectFriend(result.friendId)
      navigateTo('affinity')
      showNotice(`已定位到好友档案：${result.title}`)
      return
    }

    if (result.kind === 'label' && result.labelId) {
      setHighlightLabelId(result.labelId)
      setHighlightEventId(null)
      navigateTo('labels')
      showNotice(`已跳转到标签详情：${result.title}`)
      return
    }

    if (result.kind === 'event' && result.eventId && result.friendId) {
      const friendId = result.friendId
      const friend = appState.friends.find((item) => item.id === result.friendId) ?? null
      const targetEvent = friend?.events.find((item) => item.id === result.eventId) ?? null
      const nextDraft = buildEventDraft(friend, appState.interactionLabels)
      setHighlightLabelId(null)
      setHighlightEventId(result.eventId)
      setSelectedFriendId(friendId)
      setEventDraft(targetEvent ? { ...nextDraft, friendId, labelId: targetEvent.labelId } : nextDraft)
      navigateTo('events')
      showNotice(`已跳转到事件详情：${result.title}`)
    }
  }

  const handleSearchSubmit = () => {
    if (searchResults.length === 0) {
      showNotice('未找到匹配的好友、标签或事件')
      return
    }

    handleSearchSelect(searchResults[0])
  }

  const renderPage = (page: NavigationPage): ReactNode => {
    switch (page) {
      case 'home':
        return (
          <section className="page-panel">
            <div className="page-header">
              <div>
                <p className="eyebrow">首页</p>
                <h2>好友概览与全景趋势</h2>
                <p className="muted-text">这里只保留概览信息与全局趋势，不再承载任何编辑类操作。</p>
              </div>
            </div>

            <div className="overview-cards">
              {appState.friends.map((friend) => (
                <article key={friend.id} className="friend-summary-card">
                  <div className="friend-summary-head">
                    <img className="avatar" src={avatarUrl(friend)} alt="" />
                    <div>
                      <strong>{friend.name}</strong>
                      <p>{friend.role}</p>
                    </div>
                  </div>
                  <div className="friend-summary-meta">
                    <span>当前好感 {friend.affinityScore}</span>
                    <span>最近互动 {formatDateTime(friend.events[0]?.happenedAt)}</span>
                  </div>
                  <Sparkline friend={friend} />
                </article>
              ))}
            </div>

            <div className="panel panorama-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">全景折线图</p>
                  <h3>所有好友好感度变化趋势</h3>
                </div>
                <span className="muted-text">{homeChartSummary}</span>
              </div>
              <div className="chart-filter-panel">
                <div className="chart-filter-grid">
                  <label>
                    筛选模式
                    <select
                      value={homeChartFilters.mode}
                      onChange={(event) =>
                        updateHomeFilter('mode', event.target.value as HomeChartFilters['mode'])}
                    >
                      <option value="all">全部好友</option>
                      <option value="single">单用户专属</option>
                      <option value="label">按标签聚合</option>
                      <option value="event">按事件时间窗口</option>
                      <option value="multi">多用户对比</option>
                    </select>
                  </label>

                  {homeChartFilters.mode === 'single' && (
                    <label>
                      选择好友
                      <select
                        value={homeChartFilters.singleFriendId}
                        onChange={(event) => updateHomeFilter('singleFriendId', event.target.value)}
                      >
                        {appState.friends.map((friend) => (
                          <option key={friend.id} value={friend.id}>
                            {friend.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {homeChartFilters.mode === 'label' && (
                    <label>
                      指定标签
                      <select
                        value={homeChartFilters.labelId}
                        onChange={(event) => updateHomeFilter('labelId', event.target.value)}
                      >
                        {appState.interactionLabels.map((label) => (
                          <option key={label.id} value={label.id}>
                            {label.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {homeChartFilters.mode === 'event' && (
                    <label>
                      指定事件
                      <select
                        value={homeChartFilters.eventId}
                        onChange={(event) => updateHomeFilter('eventId', event.target.value)}
                      >
                        {allEventRecords.map(({ friend, event }) => (
                          <option key={event.id} value={event.id}>
                            {friend.name} · {event.title} · {formatDateTime(event.happenedAt)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label>
                    时间范围
                    <select
                      value={homeChartFilters.mode === 'event' ? 'custom' : homeChartFilters.timeFilter}
                      disabled={homeChartFilters.mode === 'event'}
                      onChange={(event) =>
                        updateHomeFilter('timeFilter', event.target.value as HomeChartFilters['timeFilter'])}
                    >
                      <option value="all">全部时间</option>
                      <option value="week">最近 7 天</option>
                      <option value="month">最近 30 天</option>
                      <option value="year">最近 1 年</option>
                      <option value="custom">自定义</option>
                    </select>
                  </label>

                  <label>
                    最低好感
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={homeChartFilters.valueRange[0]}
                      onChange={(event) =>
                        updateHomeFilter('valueRange', [
                          clampScore(Number(event.target.value)),
                          homeChartFilters.valueRange[1],
                        ])}
                    />
                  </label>

                  <label>
                    最高好感
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={homeChartFilters.valueRange[1]}
                      onChange={(event) =>
                        updateHomeFilter('valueRange', [
                          homeChartFilters.valueRange[0],
                          clampScore(Number(event.target.value)),
                        ])}
                    />
                  </label>
                </div>

                {(homeChartFilters.timeFilter === 'custom' || homeChartFilters.mode === 'event') && (
                  <div className="chart-filter-grid compact">
                    <label>
                      开始日期
                      <input
                        type="date"
                        value={
                          homeChartFilters.mode === 'event' && selectedEventRecord
                            ? dayjs(selectedEventRecord.event.happenedAt).subtract(7, 'day').format('YYYY-MM-DD')
                            : homeChartFilters.customStart
                        }
                        disabled={homeChartFilters.mode === 'event'}
                        onChange={(event) => updateHomeFilter('customStart', event.target.value)}
                      />
                    </label>
                    <label>
                      结束日期
                      <input
                        type="date"
                        value={
                          homeChartFilters.mode === 'event' && selectedEventRecord
                            ? dayjs(selectedEventRecord.event.happenedAt).add(7, 'day').format('YYYY-MM-DD')
                            : homeChartFilters.customEnd
                        }
                        disabled={homeChartFilters.mode === 'event'}
                        onChange={(event) => updateHomeFilter('customEnd', event.target.value)}
                      />
                    </label>
                  </div>
                )}

                {homeChartFilters.mode === 'multi' && (
                  <div className="chart-selection-grid">
                    {appState.friends.map((friend) => (
                      <label className="checkbox-card" key={friend.id}>
                        <input
                          type="checkbox"
                          checked={homeChartFilters.multiFriendIds.includes(friend.id)}
                          onChange={(event) =>
                            updateHomeFilter(
                              'multiFriendIds',
                              event.target.checked
                                ? [...homeChartFilters.multiFriendIds, friend.id]
                                : homeChartFilters.multiFriendIds.filter((id) => id !== friend.id),
                            )}
                        />
                        {friend.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {homeChartSeries.length > 0 ? (
                <ReactECharts option={homeChartOption} style={{ height: 420, width: '100%' }} notMerge />
              ) : (
                <div className="empty-state">
                  当前筛选条件下暂无可展示的数据，请调整好友、标签、事件或时间范围。
                </div>
              )}
            </div>
          </section>
        )

      case 'labels':
        return (
          <section className="page-panel">
            <div className="page-header">
              <div>
                <p className="eyebrow">标签制作子页面</p>
                <h2>全局互动标签工作台</h2>
                <p className="muted-text">制作完成的标签会存储为全局变量，并可自由关联到任意好友资料卡。</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => navigateTo('affinity', { reverse: true })}>
                返回人物详情
              </button>
            </div>

            <div className="page-grid two-col">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">新建标签</p>
                    <h3>创建全局标签</h3>
                  </div>
                </div>
                <div className="form-grid two-columns">
                  <label>
                    标签名称
                    <input
                      value={labelForm.name}
                      onChange={(event) => setLabelForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="例如：主动陪伴"
                    />
                  </label>
                  <label>
                    默认好感增减
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={labelForm.defaultDelta}
                      onChange={(event) =>
                        setLabelForm((current) => ({
                          ...current,
                          defaultDelta: clampScore(Number(event.target.value)),
                        }))}
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  <button type="button" className="primary-button" onClick={handleCreateLabel}>
                    保存标签
                  </button>
                </div>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">好友关联</p>
                    <h3>当前好友标签映射</h3>
                  </div>
                </div>
                <label>
                  当前好友
                  <select
                    value={selectedFriend?.id ?? ''}
                    onChange={(event) => handleSelectFriend(event.target.value)}
                  >
                    {appState.friends.map((friend) => (
                      <option value={friend.id} key={friend.id}>
                        {friend.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="tag-mapping-list">
                  {appState.interactionLabels.map((label) => {
                    const enabled = selectedFriend?.enabledLabelIds.includes(label.id) ?? false
                    return (
                      <button
                        type="button"
                        key={label.id}
                        className={`tag-chip ${enabled ? 'active' : ''}`}
                        onClick={() => handleToggleFriendLabel(label.id)}
                      >
                        <span className="color-dot" style={{ backgroundColor: label.color }} />
                        {enabled ? `已关联 ${label.name}` : `关联 ${label.name}`}
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="label-library-grid">
              {appState.interactionLabels.map((label) => (
                <article
                  key={label.id}
                  className={`label-card ${highlightLabelId === label.id ? 'search-highlight-card' : ''}`}
                >
                  <div className="tag-card-header">
                    <span className="color-dot" style={{ backgroundColor: label.color }} />
                    <input
                      className="tag-name-input"
                      value={label.name}
                      onChange={(event) => handleLabelFieldChange(label.id, { name: event.target.value })}
                    />
                    <button type="button" className="text-button danger-text" onClick={() => handleDeleteLabel(label.id)}>
                      删除
                    </button>
                  </div>
                  <label>
                    默认好感增减
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={label.defaultDelta}
                      onChange={(event) =>
                        handleLabelFieldChange(label.id, { defaultDelta: Number(event.target.value) })}
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>
        )

      case 'events':
        return (
          <section className="page-panel">
            <div className="page-header">
              <div>
                <p className="eyebrow">事件制作子页面</p>
                <h2>互动事件创建与回放</h2>
                <p className="muted-text">可单独设置事件发生时间、目标好友与本次好感度调整值。</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => navigateTo('affinity', { reverse: true })}>
                返回人物详情
              </button>
            </div>

            <div className="page-grid two-col">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">事件表单</p>
                    <h3>创建互动事件</h3>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    目标好友
                    <select
                      value={eventDraft.friendId}
                      onChange={(event) => {
                        const friend = appState.friends.find((item) => item.id === event.target.value) ?? null
                        setEventDraft(buildEventDraft(friend, appState.interactionLabels))
                        setSelectedFriendId(friend?.id ?? null)
                      }}
                    >
                      {appState.friends.map((friend) => (
                        <option value={friend.id} key={friend.id}>
                          {friend.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    事件标题
                    <input
                      value={eventDraft.title}
                      onChange={(event) => setEventDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="例如：一起完成一次联机测试"
                    />
                  </label>
                  <label>
                    发生时间
                    <input
                      type="datetime-local"
                      value={eventDraft.happenedAt}
                      onChange={(event) => setEventDraft((current) => ({ ...current, happenedAt: event.target.value }))}
                    />
                  </label>
                  <label>
                    互动标签
                    <select
                      value={eventDraft.labelId}
                      onChange={(event) => {
                        const label = getLabelById(appState.interactionLabels, event.target.value)
                        setEventDraft((current) => ({
                          ...current,
                          labelId: event.target.value,
                          delta: label?.defaultDelta ?? current.delta,
                        }))
                      }}
                    >
                      {(appState.friends.find((friend) => friend.id === eventDraft.friendId)?.enabledLabelIds ?? []).map((labelId) => {
                        const label = getLabelById(appState.interactionLabels, labelId)
                        if (!label) {
                          return null
                        }
                        return (
                          <option value={label.id} key={label.id}>
                            {label.name}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <label>
                    本次好感增减
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={eventDraft.delta}
                      onChange={(event) =>
                        setEventDraft((current) => ({
                          ...current,
                          delta: clampScore(Number(event.target.value)),
                        }))}
                    />
                  </label>
                  <label>
                    事件详情
                    <textarea
                      rows={8}
                      value={eventDraft.details}
                      onChange={(event) => setEventDraft((current) => ({ ...current, details: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  <button type="button" className="primary-button" onClick={handleSubmitEvent}>
                    创建事件
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setEventDraft(buildEventDraft(selectedFriend, appState.interactionLabels))}
                  >
                    重置表单
                  </button>
                </div>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">互动记录</p>
                    <h3>当前好友事件时间线</h3>
                  </div>
                </div>
                <div className="timeline">
                  {(appState.friends.find((friend) => friend.id === eventDraft.friendId)?.events ?? []).map((item) => (
                    <article
                      className={`timeline-card ${highlightEventId === item.id ? 'search-highlight-card' : ''}`}
                      key={item.id}
                    >
                      <div className="timeline-meta">
                        <strong>{item.title}</strong>
                        <span>{formatDateTime(item.happenedAt)}</span>
                      </div>
                      <p>{item.details}</p>
                      <div className="adjustment-pills">
                        <span className="adjustment-pill">
                          {item.labelName} {item.beforeAffinity} → {item.afterAffinity} ({item.delta > 0 ? '+' : ''}
                          {item.delta})
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )

      case 'affinity':
        return (
          <section className="page-panel">
            <div className="page-header">
              <div>
                <p className="eyebrow">人物好感度调整子页面</p>
                <h2>好友资料与好感度调整</h2>
                <p className="muted-text">所有原先分散在首页的编辑逻辑都收拢到这里处理。</p>
              </div>
              <div className="inline-actions compact">
                <button type="button" className="ghost-button" onClick={() => navigateTo('labels')}>
                  前往标签制作
                </button>
                <button type="button" className="ghost-button" onClick={() => navigateTo('events')}>
                  前往事件制作
                </button>
              </div>
            </div>

            <div className="page-grid affinity-layout">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">好友切换</p>
                    <h3>当前档案列表</h3>
                  </div>
                  <button type="button" className="primary-button" onClick={() => setIsFriendFormOpen((value) => !value)}>
                    {isFriendFormOpen ? '收起新建表单' : '新建好友'}
                  </button>
                </div>

                {isFriendFormOpen && (
                  <div className="subpanel">
                    <div className="form-grid three-columns">
                      <label>
                        好友名称
                        <input
                          value={friendForm.name}
                          onChange={(event) => setFriendForm((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label>
                        关系定位
                        <input
                          value={friendForm.role}
                          onChange={(event) => setFriendForm((current) => ({ ...current, role: event.target.value }))}
                        />
                      </label>
                      <label>
                        初始总好感
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          value={friendForm.affinityBase}
                          onChange={(event) =>
                            setFriendForm((current) => ({
                              ...current,
                              affinityBase: clampScore(Number(event.target.value)),
                            }))}
                        />
                      </label>
                    </div>
                    <div className="inline-actions">
                      <button type="button" className="primary-button" onClick={handleCreateFriend}>
                        创建档案
                      </button>
                    </div>
                  </div>
                )}

                <div className="friend-selector-list">
                  {appState.friends.map((friend) => (
                    <button
                      type="button"
                      key={friend.id}
                      className={`friend-selector-item ${selectedFriend?.id === friend.id ? 'active' : ''}`}
                      onClick={() => handleSelectFriend(friend.id)}
                    >
                      <img className="avatar" src={avatarUrl(friend)} alt="" />
                      <div>
                        <strong>{friend.name}</strong>
                        <p>{friend.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                {selectedFriend ? (
                  <>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">档案编辑</p>
                        <h3>{selectedFriend.name}</h3>
                      </div>
                      <div className="inline-actions compact">
                        <button type="button" className="ghost-button" onClick={() => avatarInputRef.current?.click()}>
                          上传头像
                        </button>
                        <button
                          type="button"
                          className="ghost-button danger-outline"
                          onClick={() => setConfirmDeleteFriendId(selectedFriend.id)}
                        >
                          删除档案
                        </button>
                      </div>
                    </div>
                    <div className="form-grid three-columns">
                      <label>
                        好友名称
                        <input
                          value={selectedFriend.name}
                          onChange={(event) =>
                            commitState(
                              {
                                ...appState,
                                friends: appState.friends.map((friend) =>
                                  friend.id === selectedFriend.id
                                    ? {
                                      ...friend,
                                      name: event.target.value,
                                      avatarSeed: event.target.value || friend.avatarSeed,
                                      updatedAt: new Date().toISOString(),
                                    }
                                    : friend),
                              },
                              { selectedFriendId: selectedFriend.id },
                            )}
                        />
                      </label>
                      <label>
                        关系定位
                        <input
                          value={selectedFriend.role}
                          onChange={(event) =>
                            commitState(
                              {
                                ...appState,
                                friends: appState.friends.map((friend) =>
                                  friend.id === selectedFriend.id
                                    ? {
                                      ...friend,
                                      role: event.target.value,
                                      updatedAt: new Date().toISOString(),
                                    }
                                    : friend),
                              },
                              { selectedFriendId: selectedFriend.id },
                            )}
                        />
                      </label>
                      <label>
                        基础好感
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          value={selectedFriend.affinityBase}
                          onChange={(event) =>
                            commitState(
                              {
                                ...appState,
                                friends: appState.friends.map((friend) =>
                                  friend.id === selectedFriend.id
                                    ? updateFriendBaseAffinity(friend, Number(event.target.value))
                                    : friend),
                              },
                              { selectedFriendId: selectedFriend.id },
                            )}
                        />
                      </label>
                    </div>

                    <div className="info-grid">
                      <MetricCard label="当前总好感" value={selectedFriend.affinityScore} />
                      <MetricCard label="关联标签数" value={selectedFriend.enabledLabelIds.length} />
                      <MetricCard label="历史事件数" value={selectedFriend.events.length} />
                    </div>

                    <div className="page-grid two-col">
                      <section className="subpanel">
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">批量调整</p>
                            <h3>多人统一修改</h3>
                          </div>
                        </div>
                        <div className="friend-check-grid">
                          {appState.friends.map((friend) => (
                            <label className="checkbox-card" key={friend.id}>
                              <input
                                type="checkbox"
                                checked={selectedBatchIds.includes(friend.id)}
                                onChange={(event) =>
                                  setSelectedBatchIds((current) =>
                                    event.target.checked
                                      ? [...current, friend.id]
                                      : current.filter((id) => id !== friend.id))}
                              />
                              {friend.name}
                            </label>
                          ))}
                        </div>
                        <div className="form-grid three-columns">
                          <label>
                            统一增减
                            <input
                              type="number"
                              min={-100}
                              max={100}
                              value={batchDraft.affinityDelta}
                              onChange={(event) =>
                                setBatchDraft((current) => ({
                                  ...current,
                                  affinityDelta: clampScore(Number(event.target.value)),
                                }))}
                            />
                          </label>
                          <label>
                            追加标签
                            <select
                              value=""
                              onChange={(event) => {
                                const nextId = event.target.value
                                if (!nextId) {
                                  return
                                }
                                setBatchDraft((current) => ({
                                  ...current,
                                  addLabelIds: current.addLabelIds.includes(nextId)
                                    ? current.addLabelIds
                                    : [...current.addLabelIds, nextId],
                                }))
                              }}
                            >
                              <option value="">选择标签</option>
                              {appState.interactionLabels.map((label) => (
                                <option value={label.id} key={label.id}>
                                  {label.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            移除标签
                            <select
                              value=""
                              onChange={(event) => {
                                const nextId = event.target.value
                                if (!nextId) {
                                  return
                                }
                                setBatchDraft((current) => ({
                                  ...current,
                                  removeLabelIds: current.removeLabelIds.includes(nextId)
                                    ? current.removeLabelIds
                                    : [...current.removeLabelIds, nextId],
                                }))
                              }}
                            >
                              <option value="">选择标签</option>
                              {appState.interactionLabels.map((label) => (
                                <option value={label.id} key={label.id}>
                                  {label.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="inline-actions">
                          <button type="button" className="primary-button" onClick={handleBatchApply}>
                            应用批量修改
                          </button>
                        </div>
                      </section>

                      <section className="subpanel">
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">角色导入</p>
                            <h3>XLSX 批量创建好友档案</h3>
                          </div>
                        </div>
                        <p className="muted-text">
                          支持字段：`name / 好友名称`、`role / 关系定位`、`affinityBase / 基础好感`、
                          `enabledLabels / 关联标签`、长期计划字段。
                        </p>
                        <div className="inline-actions">
                          <button type="button" className="primary-button" onClick={() => importInputRef.current?.click()}>
                            导入 XLSX
                          </button>
                        </div>
                        {importSummary && <p className="success-text">{importSummary}</p>}
                        {importErrors.length > 0 && (
                          <ul className="error-list">
                            {importErrors.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>

                    <section className="subpanel">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">关系计划</p>
                          <h3>长期判断与执行记录</h3>
                        </div>
                      </div>
                      <div className="form-grid">
                        <label>
                          长期关系发展规划
                          <textarea
                            rows={4}
                            value={selectedFriend.plans.longTermPlan}
                            onChange={(event) => handlePlanChange('longTermPlan', event.target.value)}
                          />
                        </label>
                        <label>
                          对方近期态度记录
                          <textarea
                            rows={4}
                            value={selectedFriend.plans.attitudeNotes}
                            onChange={(event) => handlePlanChange('attitudeNotes', event.target.value)}
                          />
                        </label>
                        <label>
                          自身调整执行计划
                          <textarea
                            rows={4}
                            value={selectedFriend.plans.actionPlan}
                            onChange={(event) => handlePlanChange('actionPlan', event.target.value)}
                          />
                        </label>
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="empty-state">当前没有可编辑的好友档案。</div>
                )}
              </section>
            </div>
          </section>
        )

      case 'settings':
        return (
          <section className="page-panel">
            <div className="page-header">
              <div>
                <p className="eyebrow">系统设置子页面</p>
                <h2>全局配色、备份恢复与操作管理</h2>
                <p className="muted-text">这里负责软件配色、自定义备份流程，以及全局撤销/重做控制。</p>
              </div>
            </div>

            <div className="page-grid two-col">
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">配色方案</p>
                    <h3>全局视觉设置</h3>
                  </div>
                </div>
                <div className="form-grid three-columns">
                  <label>
                    主题模式
                    <select
                      value={appState.settings.theme}
                      onChange={(event) =>
                        updateSettings({
                          theme: event.target.value as AppSettings['theme'],
                        })}
                    >
                      <option value="light">浅色</option>
                      <option value="dark">深色</option>
                    </select>
                  </label>
                  <label>
                    主强调色
                    <input
                      type="color"
                      value={appState.settings.accentPrimary}
                      onChange={(event) => updateSettings({ accentPrimary: event.target.value })}
                    />
                  </label>
                  <label>
                    次强调色
                    <input
                      type="color"
                      value={appState.settings.accentSecondary}
                      onChange={(event) => updateSettings({ accentSecondary: event.target.value })}
                    />
                  </label>
                </div>
                <label>
                  面板底色
                  <input
                    type="color"
                    value={appState.settings.surfaceTint}
                    onChange={(event) => updateSettings({ surfaceTint: event.target.value })}
                  />
                </label>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">数据管理</p>
                    <h3>备份与恢复</h3>
                  </div>
                </div>
                <div className="inline-actions">
                  <button type="button" className="primary-button" onClick={handleExportBackup}>
                    导出备份
                  </button>
                  <button type="button" className="ghost-button" onClick={() => backupInputRef.current?.click()}>
                    恢复备份
                  </button>
                </div>
              </section>
            </div>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">操作管理</p>
                  <h3>全局撤销与重做</h3>
                </div>
              </div>
              <div className="inline-actions">
                <button type="button" className="primary-button" onClick={triggerUndo}>
                  撤销（{undoStackRef.current.length}）
                </button>
                <button type="button" className="ghost-button" onClick={triggerRedo}>
                  重做（{redoStackRef.current.length}）
                </button>
              </div>
              <p className="muted-text">快捷键支持：`Ctrl + Z` 撤销，`Ctrl + Y` 或 `Ctrl + Shift + Z` 重做。</p>
            </section>
          </section>
        )

      default:
        return null
    }
  }

  const navItems: Array<{ key: NavigationPage; label: string; description: string }> = [
    { key: 'home', label: '首页', description: '好友概览' },
    { key: 'labels', label: '标签制作', description: '全局标签管理' },
    { key: 'events', label: '事件制作', description: '互动事件录入' },
    { key: 'affinity', label: '好感度调整', description: '人物资料编辑' },
    { key: 'settings', label: '系统设置', description: '配色与数据' },
  ]

  const activeNavKey = transition?.to ?? currentPage

  return (
    <div className={`app-shell ${appState.settings.theme}`} style={shellStyle}>
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleRestoreBackup}
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleOpenAvatarEditor}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={handleImportWorkbook}
      />

      <header className="frame-header">
        <div className="header-bar">
          <h1>人社交好感度管理软件</h1>
          <div
            className="global-search"
            onBlur={() => {
              searchCloseTimerRef.current = window.setTimeout(() => setIsSearchOpen(false), 120)
            }}
          >
            <label className="search-box">
              <span className="sr-only">全局搜索</span>
              <input
                value={searchQuery}
                onFocus={() => {
                  if (searchCloseTimerRef.current) {
                    window.clearTimeout(searchCloseTimerRef.current)
                    searchCloseTimerRef.current = null
                  }
                  setIsSearchOpen(true)
                }}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setIsSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSearchSubmit()
                  }
                }}
                placeholder="搜索好友、标签、事件"
                aria-label="全局搜索"
              />
              <button type="button" className="primary-button search-submit" onMouseDown={() => handleSearchSubmit()}>
                搜索
              </button>
            </label>

            {isSearchOpen && searchQuery.trim() && (
              <div className="search-dropdown">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      className="search-result-item"
                      onMouseDown={() => handleSearchSelect(result)}
                    >
                      <strong>{result.title}</strong>
                      <span>{result.kind === 'friend' ? '好友' : result.kind === 'label' ? '标签' : '事件'}</span>
                      <p>{result.subtitle}</p>
                    </button>
                  ))
                ) : (
                  <div className="search-empty">没有匹配结果，按 Enter 可触发提示。</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="frame-body">
        <aside className="sidebar">
          <nav className="nav-list">
            {navItems.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`nav-item ${activeNavKey === item.key ? 'active' : ''}`}
                onClick={() =>
                  navigateTo(item.key, {
                    reverse: item.key === 'affinity' && ['labels', 'events'].includes(currentPage),
                  })}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </nav>

          <section className="sidebar-summary panel">
            <p className="eyebrow">当前概况</p>
            <div className="summary-metric">
              <span>好友档案</span>
              <strong>{appState.friends.length}</strong>
            </div>
            <div className="summary-metric">
              <span>互动标签</span>
              <strong>{appState.interactionLabels.length}</strong>
            </div>
            <div className="summary-metric">
              <span>平均好感</span>
              <strong>{averageAffinity(appState.friends)}</strong>
            </div>
          </section>
        </aside>

        <main className="content-shell">
          {notice && <div className="notice-banner">{notice}</div>}

          <div className="page-stage">
            {transition ? (
              <>
                <div className="page-layer outgoing">
                  {renderPage(transition.from)}
                </div>
                <div className={`page-layer incoming ${transition.reverse ? 'reverse' : 'forward'}`}>
                  {renderPage(transition.to)}
                </div>
              </>
            ) : (
              <div className="page-layer static">{renderPage(currentPage)}</div>
            )}
          </div>
        </main>
      </div>

      {confirmDeleteFriendId && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>确认删除当前档案？</h3>
            <p>删除后仍可通过系统设置中的撤销功能恢复，但这里建议先再确认一次。</p>
            <div className="inline-actions">
              <button type="button" className="primary-button" onClick={handleDeleteFriend}>
                确认删除
              </button>
              <button type="button" className="ghost-button" onClick={() => setConfirmDeleteFriendId(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {avatarEditor.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-card avatar-modal">
            <div className="section-heading">
              <div>
                <p className="eyebrow">头像自定义</p>
                <h2>上传、裁剪与缩放</h2>
              </div>
            </div>
            <div className="avatar-editor-layout">
              <div
                className="avatar-crop-preview"
                style={{
                  backgroundImage: `url(${avatarEditor.src})`,
                  backgroundSize: `${avatarEditor.zoom * 100}%`,
                  backgroundPosition: `${50 + avatarEditor.offsetX / 2}% ${50 + avatarEditor.offsetY / 2}%`,
                }}
              />
              <div className="form-grid">
                <label>
                  缩放
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={avatarEditor.zoom}
                    onChange={(event) =>
                      setAvatarEditor((current) => ({
                        ...current,
                        zoom: Number(event.target.value),
                      }))}
                  />
                </label>
                <label>
                  水平裁剪
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={avatarEditor.offsetX}
                    onChange={(event) =>
                      setAvatarEditor((current) => ({
                        ...current,
                        offsetX: Number(event.target.value),
                      }))}
                  />
                </label>
                <label>
                  垂直裁剪
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={avatarEditor.offsetY}
                    onChange={(event) =>
                      setAvatarEditor((current) => ({
                        ...current,
                        offsetY: Number(event.target.value),
                      }))}
                  />
                </label>
              </div>
            </div>
            <div className="inline-actions">
              <button type="button" className="primary-button" onClick={handleSaveAvatar}>
                保存头像
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAvatarEditor((current) => ({ ...current, isOpen: false }))}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildShellStyle(settings: AppSettings): CSSProperties {
  const isDark = settings.theme === 'dark'
  const controlSurface = isDark ? '#162131' : '#ffffff'
  const controlSurfaceAlt = isDark ? '#1d2a3d' : '#f4f7fb'
  const controlBorder = isDark ? 'rgba(151, 166, 194, 0.34)' : 'rgba(109, 124, 151, 0.34)'
  const controlText = isDark ? '#f4f7fb' : '#142033'
  const optionBackground = isDark ? '#182232' : '#ffffff'
  const optionText = isDark ? '#f4f7fb' : '#142033'
  const optionSelectedBackground = isDark ? '#3155d4' : '#1f4fd1'
  const optionSelectedText = '#ffffff'
  const primaryActionFrom = isDark ? '#3155d4' : '#2647c7'
  const primaryActionTo = isDark ? '#5b2fb6' : '#5a2bb7'
  const primaryActionText = '#ffffff'
  const focusRing = isDark ? '#9bb4ff' : '#3155d4'

  return {
    '--bg': isDark ? '#0f141d' : '#f5f7fb',
    '--surface': isDark ? 'rgba(20, 25, 34, 0.94)' : 'rgba(255, 255, 255, 0.94)',
    '--surface-muted': isDark ? mixWithAlpha(settings.surfaceTint, 0.18) : settings.surfaceTint,
    '--border': isDark ? 'rgba(137, 148, 176, 0.18)' : 'rgba(145, 154, 178, 0.2)',
    '--text-primary': isDark ? '#f4f7fb' : '#142033',
    '--text-secondary': isDark ? '#98a6bd' : '#67738a',
    '--accent': settings.accentPrimary,
    '--accent-2': settings.accentSecondary,
    '--control-surface': controlSurface,
    '--control-surface-alt': controlSurfaceAlt,
    '--control-border': controlBorder,
    '--control-text': controlText,
    '--select-option-bg': optionBackground,
    '--select-option-text': optionText,
    '--select-option-selected-bg': optionSelectedBackground,
    '--select-option-selected-text': optionSelectedText,
    '--primary-action-from': primaryActionFrom,
    '--primary-action-to': primaryActionTo,
    '--primary-action-text': primaryActionText,
    '--focus-ring': focusRing,
    '--shadow': isDark
      ? `0 18px 40px ${mixWithAlpha(settings.accentPrimary, 0.16)}`
      : `0 18px 40px ${mixWithAlpha(settings.accentPrimary, 0.12)}`,
  } as CSSProperties
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function Sparkline({ friend }: { friend: FriendProfile }) {
  const values = buildAffinityTimeline(friend).map((point) => point.score)
  const path = buildSparklinePath(values, 180, 42)

  return (
    <div className="sparkline-card">
      <span>趋势概览</span>
      <svg viewBox="0 0 180 42" className="sparkline" aria-hidden="true">
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default App
