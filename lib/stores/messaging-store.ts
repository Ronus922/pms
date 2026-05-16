import { create } from "zustand"
import type { AutomationTemplate } from "@/lib/types/automations"

export type MessagingChannel = "email" | "whatsapp"

export interface MessagingState {
  isOpen: boolean
  channel: MessagingChannel
  reservationId: string
  tenantId: string

  templates: AutomationTemplate[]
  templatesLoading: boolean
  selectedTemplateId: string

  /** Rendered (interpolated) fields, editable after render. */
  subject: string
  body: string
  recipient: string

  isEditable: boolean
  isRendering: boolean
  isSending: boolean
  error: string

  /* Actions */
  open: (args: {
    channel: MessagingChannel
    reservationId: string
    tenantId: string
    defaultRecipient: string
  }) => void
  close: () => void
  setTemplates: (templates: AutomationTemplate[]) => void
  setTemplatesLoading: (v: boolean) => void
  selectTemplate: (id: string) => void
  setRendered: (subject: string, body: string) => void
  setSubject: (v: string) => void
  setBody: (v: string) => void
  setRecipient: (v: string) => void
  toggleEditable: () => void
  setRendering: (v: boolean) => void
  setSending: (v: boolean) => void
  setError: (v: string) => void
}

export const useMessagingStore = create<MessagingState>((set) => ({
  isOpen: false,
  channel: "email",
  reservationId: "",
  tenantId: "",

  templates: [],
  templatesLoading: false,
  selectedTemplateId: "",

  subject: "",
  body: "",
  recipient: "",

  isEditable: false,
  isRendering: false,
  isSending: false,
  error: "",

  open: ({ channel, reservationId, tenantId, defaultRecipient }) =>
    set({
      isOpen: true,
      channel,
      reservationId,
      tenantId,
      templates: [],
      templatesLoading: true,
      selectedTemplateId: "",
      subject: "",
      body: "",
      recipient: defaultRecipient || "",
      isEditable: false,
      isRendering: false,
      isSending: false,
      error: "",
    }),
  close: () => set({ isOpen: false, error: "" }),
  setTemplates: (templates) => set({ templates }),
  setTemplatesLoading: (v) => set({ templatesLoading: v }),
  selectTemplate: (id) => set({ selectedTemplateId: id }),
  setRendered: (subject, body) => set({ subject, body }),
  setSubject: (v) => set({ subject: v }),
  setBody: (v) => set({ body: v }),
  setRecipient: (v) => set({ recipient: v }),
  toggleEditable: () => set((s) => ({ isEditable: !s.isEditable })),
  setRendering: (v) => set({ isRendering: v }),
  setSending: (v) => set({ isSending: v }),
  setError: (v) => set({ error: v }),
}))
