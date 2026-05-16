"use server"

import { db } from "@/lib/db"
import type { AutomationTemplate, ChannelType } from "@/lib/types/automations"

export async function getReservationTemplates(
  tenantId: string,
  channel: ChannelType,
): Promise<AutomationTemplate[]> {
  const rows = await db`
    SELECT * FROM automation_templates
    WHERE tenant_id = ${tenantId}
      AND channel_type = ${channel}
      AND category = 'reservations'
      AND is_active = TRUE
    ORDER BY name
  `
  return rows as unknown as AutomationTemplate[]
}
