import { forwardRef, useImperativeHandle } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('echarts-for-react', () => ({
  default: forwardRef((_props, ref) => {
    useImperativeHandle(ref, () => ({
      getEchartsInstance: () => ({
        getDataURL: () => 'data:image/png;base64,mock',
      }),
    }))

    return <div data-testid="mock-chart" />
  }),
}))

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('渲染固定标题栏、左侧导航和首页总览', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '人社交好感度管理软件' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /首页/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /标签制作/i })).toBeInTheDocument()
    expect(screen.getByLabelText('全局搜索')).toBeInTheDocument()
    expect(screen.getByText('好友概览与全景趋势')).toBeInTheDocument()
    expect(screen.getAllByText('林夏').length).toBeGreaterThan(0)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('可以通过全局搜索联想跳转到对应事件详情', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('全局搜索'), '深聊个人规划')
    await user.click(screen.getByRole('button', { name: /深聊个人规划/ }))

    await waitFor(() => {
      expect(screen.getByText('互动事件创建与回放')).toBeInTheDocument()
    })
    expect(screen.getByText('已跳转到事件详情：深聊个人规划')).toBeInTheDocument()
  })

  it('首页图表支持切换不同筛选模式', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('筛选模式'), 'label')
    expect(screen.getByLabelText('指定标签')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('筛选模式'), 'multi')
    expect(screen.getByText('多人同屏对比：3 人')).toBeInTheDocument()
    expect(screen.getByLabelText('林夏')).toBeInTheDocument()
  })

  it('可以在好感度调整页创建新好友档案', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /好感度调整/i }))
    await user.click(screen.getByRole('button', { name: '新建好友' }))

    const roleInputs = screen.getAllByLabelText('关系定位')
    const newFriendForm = roleInputs[0].closest('.subpanel')

    expect(newFriendForm).not.toBeNull()

    await user.type(within(newFriendForm as HTMLElement).getByLabelText('好友名称'), '阿澈')
    await user.type(within(newFriendForm as HTMLElement).getByLabelText('关系定位'), '社群朋友')
    const affinityInput = within(newFriendForm as HTMLElement).getByRole('spinbutton')
    await user.click(affinityInput)
    await user.keyboard('{Control>}a{/Control}{Backspace}36')
    await user.click(screen.getByRole('button', { name: '创建档案' }))

    expect(screen.getByText('好友档案已创建')).toBeInTheDocument()
    expect(screen.getAllByText('阿澈').length).toBeGreaterThan(0)
  })

  it('可以在标签制作页新增全局标签并返回人物详情', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /标签制作/i }))
    await waitFor(() => {
      expect(screen.queryByText('好友概览与全景趋势')).not.toBeInTheDocument()
    })
    expect(screen.getByText('全局互动标签工作台')).toBeInTheDocument()

    await user.type(screen.getByLabelText('标签名称'), '一起散步')
    const deltaInput = screen.getAllByLabelText('默认好感增减')[0]
    await user.clear(deltaInput)
    await user.type(deltaInput, '12')
    await user.click(screen.getByRole('button', { name: '保存标签' }))

    expect(screen.getByText('互动标签已创建并加入全局标签库')).toBeInTheDocument()
    expect(screen.getByDisplayValue('一起散步')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回人物详情' }))
    await waitFor(() => {
      expect(screen.getByText('好友资料与好感度调整')).toBeInTheDocument()
    })
  })

  it('可以在事件制作页创建互动事件并写入时间线', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /事件制作/i }))
    expect(screen.getByText('互动事件创建与回放')).toBeInTheDocument()

    await user.type(screen.getByLabelText('事件标题'), '一起夜聊复盘')
    await user.type(screen.getByLabelText('事件详情'), '这次聊天让彼此的合作预期更清晰。')
    await user.clear(screen.getByLabelText('本次好感增减'))
    await user.type(screen.getByLabelText('本次好感增减'), '15')
    await user.click(screen.getByRole('button', { name: '创建事件' }))

    expect(screen.getByText('互动事件已创建')).toBeInTheDocument()
    const timeline = screen.getByText('当前好友事件时间线').closest('section')
    expect(timeline).not.toBeNull()
    expect(within(timeline as HTMLElement).getByText('一起夜聊复盘')).toBeInTheDocument()
  })

  it('可以在系统设置页修改主题并执行撤销重做', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /系统设置/i }))
    expect(screen.getByText('全局配色、备份恢复与操作管理')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('主题模式'), 'dark')
    expect(screen.getByText('系统设置已更新')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /撤销/i }))
    expect(screen.getByText('已撤销上一步操作')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /重做/i }))
    expect(screen.getByText('已重做上一步操作')).toBeInTheDocument()
  })
})
