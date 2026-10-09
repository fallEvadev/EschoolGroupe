"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getUnreadCount } from "@/lib/notification-actions";
import {
  badgeLabel,
  bellLabel,
  hasNewNotification,
  NOTIFICATION_POLL_MS,
} from "@/lib/notifications";

/**
 * Cloche de l'en-tête formateur avec le nombre de notifications non lues.
 * Le compteur initial vient du serveur (pas de clignotement), puis il est
 * rafraîchi chaque minute et quand l'onglet redevient visible. Le polling
 * s'arrête quand l'onglet est caché, pour économiser la batterie et les données.
 */
export function NotificationBell({
  initialCount,
  href,
}: {
  initialCount: number;
  /** Page des notifications de l'espace (formateur ou admin). */
  href: string;
}) {
  const [count, setCount] = useState(initialCount);
  const previous = useRef(initialCount);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await getUnreadCount();
        if (cancelled) return;
        if (hasNewNotification(previous.current, next)) {
          toast.info("Vous avez une nouvelle notification.");
        }
        previous.current = next;
        setCount(next);
      } catch {
        // Réseau coupé : on garde le dernier compteur et on réessaie plus tard.
      }
    }

    const timer = window.setInterval(
      () => void refresh(),
      NOTIFICATION_POLL_MS,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const label = badgeLabel(count);

  return (
    <Link
      href={href}
      aria-label={bellLabel(count)}
      className="text-navy focus-visible:ring-ring relative flex size-10 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
    >
      <Bell className="size-5" aria-hidden />
      {label && (
        <span
          aria-hidden
          className="bg-destructive text-primary-foreground absolute top-0.5 right-0.5 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-5 font-bold"
        >
          {label}
        </span>
      )}
    </Link>
  );
}
