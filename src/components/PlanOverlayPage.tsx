import { formatDateTime } from '../utils/affinity'
import type { FriendProfile, PlanView } from '../types'

type Props = {
  isOpen: boolean
  isClosing: boolean
  selectedFriend: FriendProfile
  activePlanView: PlanView
  onClose: () => void
  onPlanViewChange: (view: PlanView) => void
  onPlanChange: (field: 'longTermPlan' | 'attitudeNotes' | 'actionPlan', value: string) => void
}

function PlanOverlayPage({
  isOpen,
  isClosing,
  selectedFriend,
  activePlanView,
  onClose,
  onPlanViewChange,
  onPlanChange,
}: Props) {
  if (!isOpen) {
    return null
  }

  return (
    <div className={`fullscreen-overlay ${isClosing ? 'is-closing' : 'is-open'}`}>
      <div className="fullscreen-overlay__shell">
        <header className="fullscreen-overlay__header">
          <div>
            <p className="eyebrow">长期计划</p>
            <h2>长期判断与执行页面</h2>
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
                <p className="eyebrow">页面导航</p>
                <h3>长期计划子视图</h3>
              </div>
            </div>
            <div className="subpage-tabs">
              <button
                type="button"
                className={`ghost-button ${activePlanView === 'overview' ? 'chip-on' : ''}`}
                onClick={() => onPlanViewChange('overview')}
              >
                总览
              </button>
              <button
                type="button"
                className={`ghost-button ${activePlanView === 'longTerm' ? 'chip-on' : ''}`}
                onClick={() => onPlanViewChange('longTerm')}
              >
                长期判断
              </button>
              <button
                type="button"
                className={`ghost-button ${activePlanView === 'attitude' ? 'chip-on' : ''}`}
                onClick={() => onPlanViewChange('attitude')}
              >
                近期态度
              </button>
              <button
                type="button"
                className={`ghost-button ${activePlanView === 'action' ? 'chip-on' : ''}`}
                onClick={() => onPlanViewChange('action')}
              >
                执行计划
              </button>
            </div>

            {activePlanView === 'overview' && (
              <div className="form-grid">
                <div className="subpanel plan-summary">
                  <strong>长期判断</strong>
                  <p>{selectedFriend.plans.longTermPlan || '还未填写。'}</p>
                </div>
                <div className="subpanel plan-summary">
                  <strong>近期态度记录</strong>
                  <p>{selectedFriend.plans.attitudeNotes || '还未填写。'}</p>
                </div>
                <div className="subpanel plan-summary">
                  <strong>执行计划</strong>
                  <p>{selectedFriend.plans.actionPlan || '还未填写。'}</p>
                </div>
              </div>
            )}

            {activePlanView === 'longTerm' && (
              <label>
                长期关系发展规划
                <textarea
                  rows={12}
                  value={selectedFriend.plans.longTermPlan}
                  onChange={(event) => onPlanChange('longTermPlan', event.target.value)}
                />
              </label>
            )}

            {activePlanView === 'attitude' && (
              <label>
                对方近期态度记录
                <textarea
                  rows={12}
                  value={selectedFriend.plans.attitudeNotes}
                  onChange={(event) => onPlanChange('attitudeNotes', event.target.value)}
                />
              </label>
            )}

            {activePlanView === 'action' && (
              <label>
                自身调整执行计划
                <textarea
                  rows={12}
                  value={selectedFriend.plans.actionPlan}
                  onChange={(event) => onPlanChange('actionPlan', event.target.value)}
                />
              </label>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">状态信息</p>
                <h3>计划维护说明</h3>
              </div>
            </div>
            <div className="form-grid">
              <div className="subpanel plan-summary">
                <strong>最近保存时间</strong>
                <p>{formatDateTime(selectedFriend.plans.updatedAt)}</p>
              </div>
              <div className="subpanel plan-summary">
                <strong>交互一致性</strong>
                <p>当前页面通过全屏遮罩层覆盖主页，并支持返回按钮与浏览器返回键关闭。</p>
              </div>
              <div className="subpanel plan-summary">
                <strong>页面切换</strong>
                <p>可在总览、长期判断、近期态度和执行计划之间自由切换，内容会实时保存到当前档案。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PlanOverlayPage
