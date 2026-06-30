"use server"

import { db } from "@/lib/db"
import { requireActor } from "@/lib/auth/actor"
import type { AutomationTemplate, ChannelType } from "@/lib/types/automations"

export async function getReservationTemplates(
  // tenantId IGNORED — derived from server session.
  _tenantId: string,
  channel: ChannelType,
): Promise<AutomationTemplate[]> {
  const actor = await requireActor()
  const tenantId = actor.tenantId
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
