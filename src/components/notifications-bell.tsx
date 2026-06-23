import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/api";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";

export function NotificationsBell() {
  const { user } = useMe();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const data = await notificationService.getAll();
      return data ?? [];
    },
  });

  const unread = notifications.filter((n: any) => !n.read).length;

  const markAllRead = async () => {
    if (!user?.id) return;
    await notificationService.markAllRead();
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const markRead = async (id: string | number) => {
    await notificationService.markRead(id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-medium">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n: any) => {
              const body = (
                <div className={`px-3 py-2 border-b last:border-0 text-sm hover:bg-muted/40 cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium leading-tight">{n.title}</div>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />}
                  </div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} to={n.link} onClick={() => markRead(n.id)}>{body}</Link>
              ) : (
                <div key={n.id} onClick={() => markRead(n.id)}>{body}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
