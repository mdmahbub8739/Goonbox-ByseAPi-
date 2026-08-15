export interface DailyStreakData {
  currentStreak: number;
  maxStreak: number;
  lastActiveDate: string;
  totalDaysActive: number;
  streakHistory: string[];
  milestonesUnlocked: number[];
  lastUpdatedTime: number;
}

const STORAGE_KEY_STREAK = 'pv_user_daily_streak';

export const STREAK_MILESTONES = [
  { days: 3, title: 'Flame Starter', badge: '🔥', perk: '3-Day Explorer Badge' },
  { days: 7, title: 'Week Champion', badge: '⚡', perk: '7-Day Streak Master' },
  { days: 14, title: 'Double Flame', badge: '💫', perk: '14-Day VIP Status' },
  { days: 30, title: 'Monthly Legend', badge: '👑', perk: '30-Day Elite Icon' },
  { days: 60, title: 'Grandmaster', badge: '💎', perk: '60-Day Prestige Crown' },
  { days: 100, title: 'Century Master', badge: '🏆', perk: '100-Day Hall of Fame' },
];

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function getDailyStreakData(): DailyStreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STREAK);
    if (raw) {
      const data: DailyStreakData = JSON.parse(raw);
      const today = getLocalDateString();
      
      if (data.lastActiveDate && data.lastActiveDate !== today) {
        const daysDiff = getDaysDifference(data.lastActiveDate, today);
        if (daysDiff > 1) {
          data.currentStreak = 0;
        }
      }
      return data;
    }
  } catch (e) {
    console.error(e);
  }

  return {
    currentStreak: 0,
    maxStreak: 0,
    lastActiveDate: '',
    totalDaysActive: 0,
    streakHistory: [],
    milestonesUnlocked: [],
    lastUpdatedTime: 0,
  };
}

export function recordDailyActivity(): { streak: DailyStreakData; isNewDay: boolean; milestoneReached?: number } {
  try {
    const data = getDailyStreakData();
    const today = getLocalDateString();
    let isNewDay = false;
    let milestoneReached: number | undefined = undefined;

    if (data.lastActiveDate === today) {
      return { streak: data, isNewDay: false };
    }

    isNewDay = true;
    if (!data.lastActiveDate) {
      data.currentStreak = 1;
      data.totalDaysActive = 1;
    } else {
      const daysDiff = getDaysDifference(data.lastActiveDate, today);
      if (daysDiff === 1) {
        data.currentStreak += 1;
      } else {
        data.currentStreak = 1;
      }
      data.totalDaysActive += 1;
    }

    data.lastActiveDate = today;
    data.lastUpdatedTime = Date.now();

    if (!data.streakHistory.includes(today)) {
      data.streakHistory.push(today);
      if (data.streakHistory.length > 90) {
        data.streakHistory = data.streakHistory.slice(-90);
      }
    }

    if (data.currentStreak > data.maxStreak) {
      data.maxStreak = data.currentStreak;
    }

    for (const milestone of STREAK_MILESTONES) {
      if (data.currentStreak >= milestone.days && !data.milestonesUnlocked.includes(milestone.days)) {
        data.milestonesUnlocked.push(milestone.days);
        milestoneReached = milestone.days;
      }
    }

    localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('pv_daily_streak_updated', { detail: data }));

    return { streak: data, isNewDay: true, milestoneReached };
  } catch (e) {
    console.error(e);
    return { streak: getDailyStreakData(), isNewDay: false };
  }
}

export function getWeekDaysStatus(): Array<{ dayLabel: string; dateStr: string; isActive: boolean; isToday: boolean }> {
  const data = getDailyStreakData();
  const historySet = new Set(data.streakHistory || []);
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const currentDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ...
  
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const daysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekList: Array<{ dayLabel: string; dateStr: string; isActive: boolean; isToday: boolean }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(d);
    weekList.push({
      dayLabel: daysShort[i],
      dateStr,
      isActive: historySet.has(dateStr),
      isToday: dateStr === todayStr,
    });
  }

  return weekList;
}
