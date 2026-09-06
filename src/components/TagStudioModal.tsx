import type { InteractionLabel, FriendProfile } from '../types'

type LabelFormState = {
  name: string
  defaultDelta: number
}

type Props = {
  isOpen: boolean
  onClose: () => void
  isLabelFormOpen: boolean
  onToggleLabelForm: () => void
  labelForm: LabelFormState
  onLabelFormChange: (patch: Partial<LabelFormState>) => void
  onCreateLabel: () => void
  selectedFriend: FriendProfile
  interactionLabels: InteractionLabel[]
  onLabelFieldChange: (
    labelId: string,
    patch: Partial<Pick<InteractionLabel, 'name' | 'defaultDelta'>>,
  ) => void
  onDeleteLabel: (labelId: string) => void
  onToggleFriendLabel: (labelId: string) => void
}

function TagStudioModal({
  isOpen,
  onClose,
  isLabelFormOpen,
  onToggleLabelForm,
  labelForm,
  onLabelFormChange,
  onCreateLabel,
  selectedFriend,
  interactionLabels,
  onLabelFieldChange,
  onDeleteLabel,
  onToggleFriendLabel,
}: Props) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card tag-studio-modal">
        <div className="section-heading">
          <div>
            <p className="eyebrow">标签制作子界面</p>
            <h2>标签工作台</h2>
            <p className="muted-text">
              当前档案：{selectedFriend.name}，在这里集中处理标签制作与档案标签启用。
            </p>
          </div>
          <div className="inline-actions compact">
            <button type="button" className="ghost-button" onClick={onToggleLabelForm}>
              {isLabelFormOpen ? '收起标签新建' : '新建互动标签'}
            </button>
            <button type="button" className="ghost-button" onClick={onClose}>
              关闭子界面
            </button>
          </div>
        </div>

        <div className="tag-studio-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">标签制作</p>
                <h3>互动标签库</h3>
              </div>
            </div>
            {isLabelFormOpen && (
              <div className="subpanel">
                <div className="form-grid two-columns">
                  <label>
                    标签名称
                    <input
                      value={labelForm.name}
                      onChange={(event) => onLabelFormChange({ name: event.target.value })}
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
                      onChange={(event) => onLabelFormChange({ defaultDelta: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  <button type="button" className="primary-button" onClick={onCreateLabel}>
                    加入标签库
                  </button>
                  <button type="button" className="ghost-button" onClick={onToggleLabelForm}>
                    收起
                  </button>
                </div>
              </div>
            )}

            <div className="label-library-grid">
              {interactionLabels.map((label) => {
                const enabled = selectedFriend.enabledLabelIds.includes(label.id)
                return (
                  <article className="label-card" key={label.id}>
                    <div className="tag-card-header">
                      <span className="color-dot" style={{ backgroundColor: label.color }} />
                      <input
                        className="tag-name-input"
                        value={label.name}
                        onChange={(event) => onLabelFieldChange(label.id, { name: event.target.value })}
                        aria-label={`${label.name} 标签名称`}
                      />
                      <button type="button" className="text-button danger-text" onClick={() => onDeleteLabel(label.id)}>
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
                          onLabelFieldChange(label.id, { defaultDelta: Number(event.target.value) })}
                      />
                    </label>
                    <button
                      type="button"
                      className={`ghost-button ${enabled ? 'chip-on' : ''}`}
                      onClick={() => onToggleFriendLabel(label.id)}
                    >
                      {enabled ? '已加入当前档案' : '加入当前档案'}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TagStudioModal
