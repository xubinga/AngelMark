import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('angelmarkDesktop', {
  channel: navigator.userAgent.includes('Electron') ? 'desktop' : 'browser',
})
