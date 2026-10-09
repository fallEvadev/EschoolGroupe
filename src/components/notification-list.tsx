"use client";

import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { safeInternalLink, type NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notification-actions";

/** Liste des notifications : un clic ouvre le rapport et marque comme lu. */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="flex flex-col gap-4">
      {unread > 0 && (
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead();
                router.refresh();
              })
            }
          >
            <CheckCheck aria-hidden />
            Tout marquer comme lu
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const href = safeInternalLink(item.link);
          const content = (
            <Card
              className={cn(
                "flex flex-col gap-1 p-4",
                !item.read && "border-primary/40 bg-accent/40",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className={cn("font-semibold", item.read && "font-medium")}>
                  {item.title}
                </p>
                {!item.read && <Badge>Nouveau</Badge>}
              </div>
              <p className="text-sm">{item.body}</p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(item.createdAt)}
              </p>
            </Card>
          );
          return (
            <li key={item.id}>
              {href ? (
                <Link
                  href={href}
                  onClick={() => {
                    if (!item.read) void markNotificationRead(item.id);
                  }}
                  className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
