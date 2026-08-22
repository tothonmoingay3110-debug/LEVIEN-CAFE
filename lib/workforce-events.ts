import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

export type WorkforceNotification = {
  staffId: string;
  type: "schedule" | "swap" | "time_off" | "system";
  title: string;
  message: string;
  link?: string;
};

export type WorkforceActivity = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Json;
};

export async function recordWorkforceEvent({
  notifications = [],
  activity,
}: {
  notifications?: WorkforceNotification[];
  activity?: WorkforceActivity;
}) {
  try {
    const supabase = createAdminClient();
    const uniqueNotifications = [...new Map(
      notifications.map((notification) => [
        `${notification.staffId}:${notification.type}:${notification.title}:${notification.message}`,
        notification,
      ]),
    ).values()];
    const operations: PromiseLike<{ error: unknown }>[] = [];

    if (uniqueNotifications.length) {
      operations.push(supabase.from("staff_notifications").insert(uniqueNotifications.map((notification) => ({
        staff_id: notification.staffId,
        notification_type: notification.type,
        title: notification.title.slice(0, 120),
        message: notification.message.slice(0, 500),
        link: (notification.link || "/admin").slice(0, 200),
      }))));
    }

    if (activity) {
      operations.push(supabase.from("staff_audit_log").insert({
        actor_id: activity.actorId,
        action: activity.action.slice(0, 80),
        entity_type: activity.entityType.slice(0, 80),
        entity_id: activity.entityId || null,
        summary: activity.summary.slice(0, 500),
        metadata: activity.metadata || {},
      }));
    }

    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed?.error) console.error("Unable to record workforce event:", failed.error);
  } catch (error) {
    // A notification must never roll back the schedule action that caused it.
    console.error("Unable to record workforce event:", error);
  }
}

export function shiftNotificationMessage(date: string, startTime: string, endTime: string) {
  return `${date} · ${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
}
