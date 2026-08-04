import { Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from './database.service.js';

@Injectable()
export class NotificationService {
  constructor(private readonly database: DatabaseService) {}

  async notifyProject(
    actor: AuthenticatedActor,
    projectId: string,
    eventType: string,
    title: string,
    body: string,
  ) {
    const members = await this.database.query<QueryResultRow & { user_id: string }>(
      'SELECT user_id FROM project_members WHERE project_id = $1',
      [projectId],
    );
    const recipients = new Set([actor.userId, ...members.rows.map((member) => member.user_id)]);
    await Promise.all(
      [...recipients].map((userId) =>
        this.deliver(actor.organizationId, userId, projectId, eventType, title, body),
      ),
    );
  }
  async notifyUser(
    organizationId: string,
    userId: string | undefined,
    projectId: string,
    eventType: string,
    title: string,
    body: string,
  ) {
    if (!userId) return;
    await this.deliver(organizationId, userId, projectId, eventType, title, body);
  }
  private async deliver(
    organizationId: string,
    userId: string,
    projectId: string,
    eventType: string,
    title: string,
    body: string,
  ) {
    const preference = await this.database.query<{
      in_app_enabled: boolean;
      quiet_hours_start: string | null;
      quiet_hours_end: string | null;
    }>(
      "SELECT in_app_enabled, quiet_hours_start::text, quiet_hours_end::text FROM notification_preferences WHERE organization_id = $1 AND user_id = $2 AND event_type IN ($3, '*') ORDER BY CASE WHEN event_type = $3 THEN 0 ELSE 1 END LIMIT 1",
      [organizationId, userId, eventType],
    );
    const selected = preference.rows[0];
    if (selected?.in_app_enabled === false) return;
    const availableAt = quietHoursEnd(selected?.quiet_hours_start, selected?.quiet_hours_end);
    await this.database.query(
      'INSERT INTO notifications (organization_id, user_id, project_id, event_type, title, body, available_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [organizationId, userId, projectId, eventType, title, body, availableAt],
    );
  }
}

const quietHoursEnd = (start: string | null | undefined, end: string | null | undefined) => {
  if (!start || !end) return new Date();
  const [startHours, startMinutes] = start.slice(0, 5).split(':').map(Number);
  const [endHours, endMinutes] = end.slice(0, 5).split(':').map(Number);
  if (
    startHours === undefined ||
    startMinutes === undefined ||
    endHours === undefined ||
    endMinutes === undefined
  )
    return new Date();
  const current = indiaWallClock(new Date());
  const currentMinutes = current.hours * 60 + current.minutes;
  const startMinutesOfDay = startHours * 60 + startMinutes;
  const endMinutesOfDay = endHours * 60 + endMinutes;
  const withinQuietHours =
    startMinutesOfDay < endMinutesOfDay
      ? currentMinutes >= startMinutesOfDay && currentMinutes < endMinutesOfDay
      : currentMinutes >= startMinutesOfDay || currentMinutes < endMinutesOfDay;
  if (!withinQuietHours) return new Date();
  const endDate = new Date(
    Date.UTC(current.year, current.month - 1, current.day, endHours, endMinutes),
  );
  if (startMinutesOfDay >= endMinutesOfDay && currentMinutes >= startMinutesOfDay)
    endDate.setUTCDate(endDate.getUTCDate() + 1);
  return new Date(endDate.getTime() - 5.5 * 60 * 60 * 1000);
};

const indiaWallClock = (date: Date) => {
  const values = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(values.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hours: value('hour'),
    minutes: value('minute'),
  };
};
