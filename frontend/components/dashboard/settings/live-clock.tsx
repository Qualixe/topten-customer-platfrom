"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

function getSnapshot() {
  return Date.now();
}

// The server has no way to know the visitor's actual clock/timezone at
// render time, so it renders nothing here — the real value takes over
// right after hydration (see the null check below), not just once the
// first interval tick fires.
function getServerSnapshot() {
  return null;
}

export function LiveClock() {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (now === null) return null;

  const date = new Date(now).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const time = new Date(now).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="text-right">
      <p className="text-sm font-medium tabular-nums">{time}</p>
      <p className="text-xs text-muted-foreground">{date}</p>
    </div>
  );
}
