'use client';

import { useState, useEffect } from 'react';

// =============================================================================
// Internal date helpers (to avoid cross-package dependencies)
// =============================================================================

function toDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  return new Date(date);
}

function getTimeUntil(date: Date | string | number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const target = toDate(date);
  const now = new Date();
  const diff = Math.max(0, target.getTime() - now.getTime());

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds };
}

function isExpired(date: Date | string | number): boolean {
  const target = toDate(date);
  return target.getTime() < Date.now();
}

function formatCountdown(endDate: Date | string | number): string {
  const target = toDate(endDate);
  const now = Date.now();
  const diff = target.getTime() - now;

  if (diff <= 0) {
    return 'Ended';
  }

  const { days, hours, minutes } = getTimeUntil(target);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return '< 1m';
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook that provides a live countdown to a target date
 * Updates every minute by default, or every second if less than 1 hour remaining
 *
 * @param endDate - Target date for countdown
 * @returns Object with timeLeft string and isEnded boolean
 *
 * @example
 * const { timeLeft, isEnded } = useCountdown('2025-12-31');
 * // timeLeft: "2d 5h 30m"
 * // isEnded: false
 */
export function useCountdown(endDate: Date | string | number): {
  timeLeft: string;
  isEnded: boolean;
} {
  const [timeLeft, setTimeLeft] = useState<string>(() => formatCountdown(endDate));
  const [isEnded, setIsEnded] = useState<boolean>(() => isExpired(endDate));

  useEffect(() => {
    const updateCountdown = () => {
      const ended = isExpired(endDate);
      setIsEnded(ended);
      setTimeLeft(formatCountdown(endDate));
    };

    // Initial update
    updateCountdown();

    // Determine update interval based on time remaining
    const getInterval = () => {
      const { days, hours } = getTimeUntil(endDate);
      // Update every second if less than 1 hour remaining
      if (days === 0 && hours === 0) {
        return 1000;
      }
      // Update every minute otherwise
      return 60000;
    };

    let intervalId = setInterval(updateCountdown, getInterval());

    // Re-evaluate interval when time remaining changes significantly
    const checkInterval = setInterval(() => {
      clearInterval(intervalId);
      intervalId = setInterval(updateCountdown, getInterval());
    }, 60000);

    return () => {
      clearInterval(intervalId);
      clearInterval(checkInterval);
    };
  }, [endDate]);

  return { timeLeft, isEnded };
}
