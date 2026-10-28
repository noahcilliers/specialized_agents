"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

export function DisconnectButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!confirm("Disconnect Google Calendar? Agents that use it won't be able to read your schedule.")) return;
          await fetch("/api/plugins/google-calendar/disconnect", { method: "POST" });
          router.refresh();
        })
      }
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
