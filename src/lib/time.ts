/**
 * Time utilities
 */

import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export function getTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

export function getCurrentEdition(schedule: { morning: number; evening: number; timezone: string }): 'morning' | 'evening' {
  const now = getTimeInTimezone(schedule.timezone);
  const hour = now.getHours();
  
  // If closer to morning time, it's morning edition
  const morningDist = Math.abs(hour - schedule.morning);
  const eveningDist = Math.abs(hour - schedule.evening);
  
  return morningDist < eveningDist ? 'morning' : 'evening';
}
