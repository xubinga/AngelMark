export type ThemeMode = 'light' | 'dark'

export type TimeFilter = 'all' | 'week' | 'month' | 'year' | 'custom'

export type ChartMode = 'single' | 'multi'

export type HomeChartMode = 'all' | 'single' | 'label' | 'event' | 'multi'

export type SearchResultKind = 'friend' | 'label' | 'event'

export type PlanView = 'overview' | 'longTerm' | 'attitude' | 'action'

export type NavigationPage = 'home' | 'labels' | 'events' | 'affinity' | 'settings'

export interface AppSettings {
  theme: ThemeMode
  accentPrimary: string
  accentSecondary: string
  surfaceTint: string
}

export interface InteractionLabel {
  id: string
  name: string
  defaultDelta: number
  color: string
  createdAt: string
  updatedAt: string
}

export interface AffinityEvent {
  id: string
  title: string
  details: string
  happenedAt: string
  createdAt: string
  labelId: string
  labelName: string
  labelColor: string
  delta: number
  beforeAffinity: number
  afterAffinity: number
}

export interface RelationshipPlans {
  longTermPlan: string
  attitudeNotes: string
  actionPlan: string
  updatedAt: string
}

export interface FriendProfile {
  id: string
  name: string
  role: string
  avatarSeed: string
  avatarImage?: string
  createdAt: string
  updatedAt: string
  affinityBase: number
  affinityScore: number
  enabledLabelIds: string[]
  events: AffinityEvent[]
  plans: RelationshipPlans
}

export interface AppState {
  settings: AppSettings
  interactionLabels: InteractionLabel[]
  friends: FriendProfile[]
}

export interface EventDraft {
  friendId: string
  title: string
  details: string
  happenedAt: string
  labelId: string
  delta: number
}

export interface ChartFilters {
  timeFilter: TimeFilter
  customStart: string
  customEnd: string
  valueRange: [number, number]
  chartMode: ChartMode
  selectedSeriesIds: string[]
}

export interface HomeChartFilters {
  mode: HomeChartMode
  singleFriendId: string
  labelId: string
  eventId: string
  multiFriendIds: string[]
  timeFilter: TimeFilter
  customStart: string
  customEnd: string
  valueRange: [number, number]
}

export interface SearchResult {
  id: string
  kind: SearchResultKind
  title: string
  subtitle: string
  keywords: string[]
  friendId?: string
  labelId?: string
  eventId?: string
}

export interface BatchDraft {
  affinityDelta: number
  addLabelIds: string[]
  removeLabelIds: string[]
}
