import type { EventDraft, FriendProfile, InteractionLabel } from '../types'

type Props = {
  isOpen: boolean
  isClosing: boolean
  selectedFriend: FriendProfile
  eventDraft: EventDraft
  interactionLabels: InteractionLabel[]
  onClose: () => void
  onDraftChange: (patch: Partial<EventDraft>) => void
  onSubmit: () => void
  onReset: () => void
}

function EventOverlayPage({
  isOpen,
  isClosing,
  selectedFriend,
  eventDraft,
  interactionLabels,
  onClose,
  onDraftChange,
  onSubmit,
  onReset,
}: Props) {
  if (!isOpen) {
    return null
  }

  return (
    <div className={`fullscreen-overlay ${isClosing ? 'is-closing' : 'is-open'}`}>
      <div className="fullscreen-overlay__shell">
        <header className="fullscreen-overlay__header">
          <div>
            <p className="eyebrow">互动时间窗口</p>
            <h2>互动事件完整页面</h2>
            <p className="muted-text">当前档案：{selectedFriend.name}</p>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            返回主页
          </button>
        </header>

        <div className="fullscreen-overlay__grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">事件录入</p>
                <h3>完整互动记录表单</h3>
              </div>
            </div>
            <div className="form-grid">
              <label>
                事件标题
                <input
                  value={eventDraft.title}
                  onChange={(event) => onDraftChange({ title: event.target.value })}
                  placeholder="例如：一起完成一次联机测试"
                />
              </label>
              <label>
                发生时间
                <input
                  type="datetime-local"
                  value={eventDraft.happenedAt}
                  onChange={(event) => onDraftChange({ happenedAt: event.target.value })}
                />
              </label>
              <label>
                互动标签
                <select
                  value={eventDraft.labelId}
                  onChange={(event) => {
                    const label = interactionLabels.find((item) => item.id === event.target.value)
                    onDraftChange({
                      labelId: event.target.value,
                      delta: label?.defaultDelta ?? eventDraft.delta,
                    })
                  }}
                >
                  {selectedFriend.enabledLabelIds.map((labelId) => {
                    const label = interactionLabels.find((item) => item.id === labelId)
                    if (!label) {
                      return null
                    }

                    return (
                      <option key={label.id} value={label.id}>
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
                  onChange={(event) => onDraftChange({ delta: Number(event.target.value) })}
                />
              </label>
              <label className="full-width">
                事件详情
                <textarea
                  rows={8}
                  value={eventDraft.details}
                  onChange={(event) => onDraftChange({ details: event.target.value })}
                  placeholder="记录这次互动的关键细节、情绪依据与判断理由"
                />
              </label>
            </div>
            <div className="inline-actions">
              <button type="button" className="primary-button" onClick={onSubmit}>
                提交事件
              </button>
              <button type="button" className="ghost-button" onClick={onReset}>
                重置草稿
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">模块说明</p>
                <h3>页面内说明与可用标签</h3>
              </div>
            </div>
            <div className="form-grid">
              <div className="subpanel plan-summary">
                <strong>当前可用互动标签</strong>
                <p>{selectedFriend.enabledLabelIds.length} 个，可在标签制作子界面中继续维护。</p>
              </div>
              <div className="tag-chip-group">
                {selectedFriend.enabledLabelIds.map((labelId) => {
                  const label = interactionLabels.find((item) => item.id === labelId)
                  if (!label) {
                    return null
                  }

                  return (
                    <span key={label.id} className="tag-chip active">
                      <span className="color-dot" style={{ backgroundColor: label.color }} />
                      {label.name}
                    </span>
                  )
                })}
              </div>
              <div className="subpanel plan-summary">
                <strong>返回主页</strong>
                <p>点击右上角“返回主页”或直接使用浏览器返回键，都可以关闭当前遮罩层回到主页。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default EventOverlayPage
