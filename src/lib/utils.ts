import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  startOfWeek,
  endOfWeek,
  format,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  getWeek,
  getYear,
} from "date-fns";
import { pl } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWeekRange(date: Date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getWeekDays(date: Date = new Date()) {
  const { start, end } = getWeekRange(date);
  return eachDayOfInterval({ start, end });
}

export function formatDate(date: Date, formatStr: string = "yyyy-MM-dd") {
  return format(date, formatStr, { locale: pl });
}

export function formatDateDisplay(date: Date) {
  return format(date, "d MMM", { locale: pl });
}

export function formatDayName(date: Date) {
  return format(date, "EEEE", { locale: pl });
}

export function formatDayNameShort(date: Date) {
  return format(date, "EEE", { locale: pl });
}

export function getWeekNumber(date: Date = new Date()) {
  return getWeek(date, { weekStartsOn: 1 });
}

export function getWeekYear(date: Date = new Date()) {
  return getYear(date);
}

export function getWeekLabel(date: Date = new Date()) {
  const { start, end } = getWeekRange(date);
  const weekNum = getWeekNumber(date);
  return `Tydzień ${weekNum} (${formatDateDisplay(start)} - ${formatDateDisplay(end)})`;
}

export function getPreviousWeek(date: Date = new Date()) {
  return subWeeks(date, 1);
}

export function getNextWeek(date: Date = new Date()) {
  return addWeeks(date, 1);
}

export function toISODateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function isToday(date: Date) {
  const today = new Date();
  return toISODateString(date) === toISODateString(today);
}

export function isFutureDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate > today;
}

// CSS `capitalize` uppercases every word ("Pon. 21 Wrz"); this does the first only.
export function capitalizeFirst(text: string) {
  return text.charAt(0).toLocaleUpperCase("pl") + text.slice(1);
}

// Server code runs in UTC on Vercel; "today" for the user means Polish time.
export const APP_TIME_ZONE = "Europe/Warsaw";

export function todayISO(timeZone: string = APP_TIME_ZONE) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
