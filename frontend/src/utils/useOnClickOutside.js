import { useEffect } from "react";

export function useOnClickOutside(ref, handler, events = ["mousedown", "touchstart"]) {
  useEffect(() => {
    const listener = (event) => {
      const el = ref?.current;
      if (!el || el.contains(event.target)) return;
      handler(event);
    };
    events.forEach((evt) => document.addEventListener(evt, listener));
    return () => {
      events.forEach((evt) => document.removeEventListener(evt, listener));
    };
  }, [ref, handler, events]);
}
