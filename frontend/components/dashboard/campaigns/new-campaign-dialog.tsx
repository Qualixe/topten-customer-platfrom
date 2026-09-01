"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AUDIENCE_SEGMENTS = [
  { value: "all-customers", label: "All Customers" },
  { value: "vip-customers", label: "VIP Customers" },
  { value: "regular-customers", label: "Regular Customers" },
  { value: "birthdays-this-month", label: "Birthdays This Month" },
  { value: "inactive-customers", label: "Inactive Customers" },
];

const SCHEDULE_OPTIONS = [
  { value: "now", label: "Send immediately" },
  { value: "schedule", label: "Schedule for later" },
  { value: "draft", label: "Save as draft" },
];

export function NewCampaignDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            New Campaign
          </Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New SMS Campaign</DialogTitle>
          <DialogDescription>
            Configure your campaign and choose when to send it.
          </DialogDescription>
        </DialogHeader>

        <NewCampaignForm onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewCampaignForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("");
  const [schedule, setSchedule] = useState("draft");
  const [scheduledAt, setScheduledAt] = useState("");

  const charCount = message.length;
  const segments = charCount === 0 ? 0 : Math.ceil(charCount / 160);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Mock submission — no real API yet
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Campaign name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-name">Campaign name</Label>
        <Input
          id="campaign-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Eid Collection Launch"
          required
        />
      </div>

      {/* Audience */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-audience">Audience</Label>
        <Select value={audience} onValueChange={(v) => setAudience(v ?? "")} required>
          <SelectTrigger id="campaign-audience" className="w-full">
            <SelectValue placeholder="Select a segment…" />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_SEGMENTS.map((seg) => (
              <SelectItem key={seg.value} value={seg.value}>
                {seg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="campaign-message">Message</Label>
          <span className="text-xs text-muted-foreground">
            {charCount} chars · {segments} SMS segment{segments !== 1 ? "s" : ""}
          </span>
        </div>
        <Textarea
          id="campaign-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your SMS message here…"
          className="min-h-24 resize-none"
          required
        />
      </div>

      {/* Schedule */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-schedule">When to send</Label>
        <Select value={schedule} onValueChange={(v) => setSchedule(v ?? "draft")}>
          <SelectTrigger id="campaign-schedule" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEDULE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {schedule === "schedule" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaign-datetime">Scheduled date &amp; time</Label>
          <DateTimePicker
            id="campaign-datetime"
            value={scheduledAt}
            onChange={setScheduledAt}
            required={schedule === "schedule"}
          />
        </div>
      )}

      <DialogFooter showCloseButton>
        <Button type="submit" disabled={!name || !message || !audience}>
          {schedule === "draft"
            ? "Save draft"
            : schedule === "schedule"
              ? "Schedule campaign"
              : "Send now"}
        </Button>
      </DialogFooter>
    </form>
  );
}
