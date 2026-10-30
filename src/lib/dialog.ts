import { create } from 'zustand'

export type DialogRequest = {
  id: number
  kind: 'confirm' | 'prompt'
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  defaultValue?: string
  resolve: (value: boolean | string | null) => void
}

export const useDialogStore = create<{ queue: DialogRequest[] }>(() => ({ queue: [] }))

let nextId = 0

function open(req: Omit<DialogRequest, 'resolve' | 'id'>) {
  return new Promise<boolean | string | null>((resolve) => {
    useDialogStore.setState((s) => ({ queue: [...s.queue, { ...req, id: ++nextId, resolve }] }))
  })
}

/** In-app replacements for window.confirm / window.prompt. Both return promises. */
export const dialog = {
  confirm: (opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) =>
    open({ kind: 'confirm', ...opts }) as Promise<boolean>,
  prompt: (opts: { title: string; message?: string; defaultValue?: string; confirmLabel?: string }) =>
    open({ kind: 'prompt', ...opts }) as Promise<string | null>,
}
