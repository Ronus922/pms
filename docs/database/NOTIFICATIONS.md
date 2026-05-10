# Notifications

> Multi-channel notification system with in-app, email, SMS, push, and webhook delivery.
> Supports real-time updates, user preferences, rate limiting, and bulk sending.

---

## Table Structure

### notifications

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | NO | -- | FK to users -- recipient |
| `type` | `notification_type` | NO | -- | Notification category |
| `channel` | `notification_channel` | NO | `'in_app'` | Delivery channel |
| `title` | `varchar(255)` | NO | -- | Short title / headline |
| `body` | `text` | YES | `NULL` | Full message body |
| `icon` | `varchar(50)` | YES | `NULL` | Icon identifier (Material Symbols name) |
| `link` | `text` | YES | `NULL` | Click-through URL (relative path) |
| `entity_type` | `varchar(50)` | YES | `NULL` | Related entity table name |
| `entity_id` | `uuid` | YES | `NULL` | Related entity record ID |
| `read_at` | `timestamptz` | YES | `NULL` | When the user read/dismissed it |
| `sent_at` | `timestamptz` | YES | `NULL` | When external delivery succeeded |
| `failed_at` | `timestamptz` | YES | `NULL` | When external delivery failed |
| `failure_reason` | `text` | YES | `NULL` | Error message from delivery attempt |
| `created_by` | `uuid` | YES | `NULL` | FK to users -- who triggered it (NULL for system) |
| `created_at` | `timestamptz` | NO | `now()` | When the notification was created |

**Indexes:**
- `idx_notifications_user_id` on `user_id`
- `idx_notifications_user_unread` on `(user_id, read_at)` WHERE `read_at IS NULL`
- `idx_notifications_entity` on `(entity_type, entity_id)`
- `idx_notifications_created_at` on `created_at DESC`
- `idx_notifications_channel_pending` on `(channel, sent_at)` WHERE `sent_at IS NULL AND failed_at IS NULL`

**Relationships:**
- `user_id` -> `users(id)` ON DELETE CASCADE
- `created_by` -> `users(id)` ON DELETE SET NULL

**RLS Policies:**
- SELECT: Users can only read their own notifications
- INSERT: Authenticated users (via server-side helpers)
- UPDATE: Users can update their own (mark as read)
- DELETE: Users can delete their own

---

## notification_type Enum

```sql
CREATE TYPE notification_type AS ENUM (
  'info', 'success', 'warning', 'error', 'reminder', 'mention'
);
```

| Value | Hebrew | Icon | Example |
|-------|--------|------|---------|
| `info` | מידע | `info` | "הזמנה חדשה #1042 נוצרה" |
| `success` | הצלחה | `check_circle` | "התשלום התקבל בהצלחה" |
| `warning` | אזהרה | `warning` | "חדר 204 דורש תחזוקה" |
| `error` | שגיאה | `error` | "שליחת מייל לאורח נכשלה" |
| `reminder` | תזכורת | `alarm` | "צ'ק-אין מחר: 3 הזמנות" |
| `mention` | אזכור | `alternate_email` | "שרה הזכירה אותך בהערה" |

> **Note:** Extend per project. Common additions: `assignment`, `status_change`, `comment`, `system`.

---

## notification_channel Enum

```sql
CREATE TYPE notification_channel AS ENUM (
  'in_app', 'email', 'sms', 'push'
);
```

| Channel | Description | Delivery Method |
|---------|-------------|-----------------|
| `in_app` | In-application notification | Supabase Realtime subscription |
| `email` | Email delivery | SMTP / Resend / SendGrid |
| `sms` | SMS message | Twilio / provider API |
| `push` | Browser/mobile push | Web Push API / FCM |

> Extend with `webhook` for external integrations (n8n, Slack, etc.).

---

## TypeScript Helpers

### createNotification()

```typescript
import { createClient } from "@/lib/supabase/server"

interface NotificationInput {
  userId: string
  type: "info" | "success" | "warning" | "error" | "reminder" | "mention"
  channel?: "in_app" | "email" | "sms" | "push"
  title: string
  body?: string
  icon?: string
  link?: string
  entityType?: string
  entityId?: string
  createdBy?: string
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    channel: input.channel ?? "in_app",
    title: input.title,
    body: input.body ?? null,
    icon: input.icon ?? null,
    link: input.link ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    created_by: input.createdBy ?? null,
  })

  if (error) {
    // Log to monitoring -- do not throw for non-critical notifications
  }
}
```

### notifyUsers() -- Bulk Notifications

Send the same notification to multiple users.

```typescript
export async function notifyUsers(
  userIds: string[],
  notification: Omit<NotificationInput, "userId">
): Promise<void> {
  const supabase = await createClient()

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: notification.type,
    channel: notification.channel ?? "in_app",
    title: notification.title,
    body: notification.body ?? null,
    icon: notification.icon ?? null,
    link: notification.link ?? null,
    entity_type: notification.entityType ?? null,
    entity_id: notification.entityId ?? null,
    created_by: notification.createdBy ?? null,
  }))

  const { error } = await supabase.from("notifications").insert(rows)

  if (error) {
    // Log to monitoring
  }
}
```

### markAsRead() / markAllAsRead()

```typescript
export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
}
```

### getUnreadCount()

```typescript
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)

  return count ?? 0
}
```

---

## Real-Time (Supabase Realtime)

Subscribe to new in_app notifications for the current user.

```typescript
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function useNotifications(userId: string) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", "in_app")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifications(data)
          setUnreadCount(data.length)
        }
      })

    // Real-time subscription
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification
          if (newNotification.channel === "in_app") {
            setNotifications((prev) => [newNotification, ...prev])
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { notifications, unreadCount }
}
```

---

## Notification Preferences

Users can control which notification types they receive on which channels. Store preferences in the `settings` table or a dedicated `notification_preferences` table.

### Schema Option: settings table

```json
{
  "key": "notification_preferences",
  "user_id": "...",
  "value": {
    "info":     { "in_app": true,  "email": false, "sms": false, "push": false },
    "success":  { "in_app": true,  "email": false, "sms": false, "push": false },
    "warning":  { "in_app": true,  "email": true,  "sms": false, "push": true  },
    "error":    { "in_app": true,  "email": true,  "sms": true,  "push": true  },
    "reminder": { "in_app": true,  "email": true,  "sms": false, "push": true  },
    "mention":  { "in_app": true,  "email": true,  "sms": false, "push": false }
  }
}
```

### Preference-Aware Sending

```typescript
export async function sendNotification(input: NotificationInput): Promise<void> {
  const prefs = await getUserNotificationPreferences(input.userId)

  const channels = getEnabledChannels(prefs, input.type)

  for (const channel of channels) {
    await createNotification({ ...input, channel })
  }
}
```

---

## Multi-Channel Delivery

### Email Delivery

When `channel = 'email'`, a background job picks up pending notifications and sends emails:

```typescript
export async function processEmailNotifications(): Promise<void> {
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from("notifications")
    .select("*, user:users(email, full_name)")
    .eq("channel", "email")
    .is("sent_at", null)
    .is("failed_at", null)
    .limit(50)

  if (!pending) return

  for (const notification of pending) {
    try {
      await sendEmail({
        to: notification.user.email,
        subject: notification.title,
        body: notification.body ?? notification.title,
      })

      await supabase
        .from("notifications")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", notification.id)
    } catch (err) {
      await supabase
        .from("notifications")
        .update({
          failed_at: new Date().toISOString(),
          failure_reason: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", notification.id)
    }
  }
}
```

---

## UI Integration

### Bell Icon with Unread Badge

```
+----------------------------------+
|  [Bell Icon]  (3)                |
+----------------------------------+
```

The bell icon in the top navigation shows the unread count. Clicking it opens the notification dropdown.

### Notification Dropdown / Panel

```
+-------------------------------------------+
| התראות                   סמן הכל כנקראו   |
+-------------------------------------------+
| [!] אזהרה — חדר 204 דורש תחזוקה         |
|     לפני 5 דקות                           |
|                                           |
| [i] הזמנה חדשה #1042 נוצרה               |
|     לפני 15 דקות                          |
|                                           |
| [v] התשלום התקבל בהצלחה                   |
|     לפני שעה                              |
+-------------------------------------------+
| הצג את כל ההתראות                         |
+-------------------------------------------+
```

### Full Notification Page

Paginated list with filters:
- **Type filter**: מידע, הצלחה, אזהרה, שגיאה, תזכורת, אזכור
- **Status filter**: לא נקראו, נקראו, הכל
- **Date range**: מ-תאריך עד תאריך

---

## Rate Limiting

Prevent notification spam by limiting notifications per user per hour.

```typescript
const MAX_NOTIFICATIONS_PER_HOUR = 30

export async function canSendNotification(userId: string): Promise<boolean> {
  const supabase = await createClient()

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo)

  return (count ?? 0) < MAX_NOTIFICATIONS_PER_HOUR
}
```

---

## Cleanup / Archival

Old notifications should be cleaned up to keep the table performant.

### Archive Notifications Older Than 90 Days

```sql
-- Option A: Delete old read notifications
DELETE FROM notifications
WHERE read_at IS NOT NULL
  AND created_at < now() - interval '90 days';

-- Option B: Move to archive table first
INSERT INTO notifications_archive
SELECT * FROM notifications
WHERE created_at < now() - interval '90 days';

DELETE FROM notifications
WHERE created_at < now() - interval '90 days';
```

### Scheduled Cleanup (cron or n8n)

Run weekly or monthly depending on volume:

```typescript
export async function cleanupOldNotifications(retentionDays = 90): Promise<number> {
  const supabase = await createClient()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from("notifications")
    .delete()
    .lt("created_at", cutoff)
    .not("read_at", "is", null)

  return count ?? 0
}
```

---

## Hebrew Labels

| Field / Value | Hebrew |
|---------------|--------|
| Notifications | התראות |
| Mark as read | סמן כנקרא |
| Mark all as read | סמן הכל כנקראו |
| Show all notifications | הצג את כל ההתראות |
| Unread | לא נקראו |
| Read | נקראו |
| info | מידע |
| success | הצלחה |
| warning | אזהרה |
| error | שגיאה |
| reminder | תזכורת |
| mention | אזכור |
| N minutes ago | לפני N דקות |
| N hours ago | לפני N שעות |
| Yesterday | אתמול |
| Notification preferences | העדפות התראות |
