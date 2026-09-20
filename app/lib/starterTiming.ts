import type { StarterEvent } from '../components/SchedulePicker';

/** Use the last planned feed before mixing, including after session restoration. */
export function starterFeedToMixHours(events: StarterEvent[], mixTime: Date | null, fallbackFeed: Date | null): number | undefined {
  if (!mixTime) return undefined;
  const feed = events.filter(event => ['pre_mix', 'refresh', 'intermediate_refresh', 'last_fed'].includes(event.kind) && event.time < mixTime)
    .sort((a, b) => b.time.getTime() - a.time.getTime())[0]?.time ?? fallbackFeed;
  if (!feed) return undefined;
  const hours = (mixTime.getTime() - feed.getTime()) / 3600000;
  return hours > 0 ? hours : undefined;
}
