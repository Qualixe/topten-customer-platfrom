"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  History,
  ShieldQuestion,
  Tag,
  UserPlus,
  UserX,
  X,
} from "lucide-react";

import { CustomerPickerDialog } from "@/components/dashboard/campaigns/new/customer-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listCustomerTypes, type CustomerTypeOption } from "@/lib/api/customer-types";
import type { Customer } from "@/lib/api/customers";
import {
  CAMPAIGN_TYPE_LABELS,
  getAudiencePreviewCount,
  type AudienceCounts,
  type AudienceRule,
  type AudienceRuleType,
  type CampaignType,
} from "@/lib/api/campaigns";

type StaticRuleType =
  | "MISSING_DOB"
  | "MISSING_ADDRESS"
  | "MISSING_DOB_AND_ADDRESS"
  | "NEVER_VERIFIED"
  | "TARGETED_NOT_VERIFIED";

const STATIC_OPTIONS: {
  ruleType: StaticRuleType;
  label: string;
  description: string;
  countKey: keyof AudienceCounts;
  icon: React.ElementType;
}[] = [
  {
    ruleType: "MISSING_DOB",
    label: "Missing date of birth",
    description: "Customers with no date of birth on file",
    countKey: "missingDob",
    icon: UserX,
  },
  {
    ruleType: "MISSING_ADDRESS",
    label: "Missing address",
    description: "Customers with no address on file",
    countKey: "missingAddress",
    icon: UserX,
  },
  {
    ruleType: "MISSING_DOB_AND_ADDRESS",
    label: "Missing DOB & address",
    description: "Customers missing both date of birth and address",
    countKey: "missingDobAndAddress",
    icon: UserX,
  },
  {
    ruleType: "NEVER_VERIFIED",
    label: "Never verified",
    description: "Customers who have never completed a campaign profile form",
    countKey: "neverVerified",
    icon: ShieldQuestion,
  }
];

type AdvancedRuleType =
  | "NEW_SINCE_DATE"
  | "NEVER_RECEIVED_TYPE"
  | "RECEIVED_TYPE_BEFORE_DATE"
  | "SPECIFIC_CUSTOMERS";

const ADVANCED_OPTIONS: {
  ruleType: AdvancedRuleType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    ruleType: "NEW_SINCE_DATE",
    label: "New customers since a date",
    description: "Customers first seen on or after a chosen date",
    icon: CalendarClock,
  },
  {
    ruleType: "NEVER_RECEIVED_TYPE",
    label: "Never received a campaign type",
    description: "Customers who have never been sent a given type of campaign",
    icon: History,
  },
  {
    ruleType: "RECEIVED_TYPE_BEFORE_DATE",
    label: "Received a campaign type before a date",
    description: "Customers already sent a given type of campaign before a chosen date",
    icon: History,
  },
  {
    ruleType: "SPECIFIC_CUSTOMERS",
    label: "Specific customers",
    description: "Hand-pick individual customers to receive this campaign",
    icon: UserPlus,
  },
];

const CAMPAIGN_TYPE_OPTIONS = Object.entries(CAMPAIGN_TYPE_LABELS) as [CampaignType, string][];

function isRuleComplete(
  ruleType: AudienceRuleType,
  customerTypeId: string,
  sinceDate: string,
  campaignType: string,
  beforeDate: string,
  customerIds: string[]
): boolean {
  if (ruleType === "CUSTOMER_TYPE") return customerTypeId.length > 0;
  if (ruleType === "NEW_SINCE_DATE") return sinceDate.length > 0;
  if (ruleType === "NEVER_RECEIVED_TYPE") return campaignType.length > 0;
  if (ruleType === "RECEIVED_TYPE_BEFORE_DATE") return campaignType.length > 0 && beforeDate.length > 0;
  if (ruleType === "SPECIFIC_CUSTOMERS") return customerIds.length > 0;
  return true;
}

function buildRule(
  ruleType: AudienceRuleType,
  customerTypeId: string,
  customerTypeName: string,
  sinceDate: string,
  campaignType: string,
  beforeDate: string,
  customerIds: string[]
): AudienceRule | null {
  if (!isRuleComplete(ruleType, customerTypeId, sinceDate, campaignType, beforeDate, customerIds)) {
    return null;
  }
  if (ruleType === "CUSTOMER_TYPE") return { ruleType, customerTypeId, customerTypeName };
  if (ruleType === "NEW_SINCE_DATE") return { ruleType, sinceDate };
  if (ruleType === "NEVER_RECEIVED_TYPE") return { ruleType, campaignType: campaignType as CampaignType };
  if (ruleType === "RECEIVED_TYPE_BEFORE_DATE") {
    return { ruleType, campaignType: campaignType as CampaignType, beforeDate };
  }
  if (ruleType === "SPECIFIC_CUSTOMERS") return { ruleType, customerIds };
  return { ruleType: ruleType as Exclude<AudienceRuleType, AdvancedRuleType | "CUSTOMER_TYPE"> };
}

interface QuickSendAudienceSectionProps {
  counts: AudienceCounts;
  rule: AudienceRule | null;
  onRuleChange: (rule: AudienceRule | null) => void;
  pickedCustomers: Customer[];
  onPickedCustomersChange: (customers: Customer[]) => void;
  /** Lifted up so the send section doesn't have to re-fetch the same
   * advanced-rule preview count a second time. */
  onRecipientCountChange: (count: number | null) => void;
}

/** Audience section of the single-page Quick Send composer — identical
 * targeting logic to the wizard's StepAudience, minus the Back/Continue
 * navigation, plus one change: General/VIP/VVIP's three fixed cards are
 * replaced with one dynamic "by customer type" section covering every
 * admin-manageable type (built-in or custom) — see CUSTOMER_TYPE in
 * lib/api/campaigns.ts. */
export function QuickSendAudienceSection({
  counts,
  rule,
  onRuleChange,
  pickedCustomers,
  onPickedCustomersChange,
  onRecipientCountChange,
}: QuickSendAudienceSectionProps) {
  const [selectedType, setSelectedType] = useState<AudienceRuleType | "">(rule?.ruleType ?? "");
  const [selectedCustomerTypeId, setSelectedCustomerTypeId] = useState(
    rule?.ruleType === "CUSTOMER_TYPE" ? rule.customerTypeId : ""
  );
  const [sinceDate, setSinceDate] = useState(rule?.ruleType === "NEW_SINCE_DATE" ? rule.sinceDate : "");
  const [historyCampaignType, setHistoryCampaignType] = useState(
    rule?.ruleType === "NEVER_RECEIVED_TYPE" || rule?.ruleType === "RECEIVED_TYPE_BEFORE_DATE"
      ? rule.campaignType
      : ""
  );
  const [beforeDate, setBeforeDate] = useState(
    rule?.ruleType === "RECEIVED_TYPE_BEFORE_DATE" ? rule.beforeDate : ""
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [customerTypes, setCustomerTypes] = useState<CustomerTypeOption[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [typeCountsLoading, setTypeCountsLoading] = useState(true);

  const isAdvanced = ADVANCED_OPTIONS.some((o) => o.ruleType === selectedType);
  const customerIds = pickedCustomers.map((c) => c.id);

  const [show,setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCustomerTypes()
      .then(async (types) => {
        if (cancelled) return;
        const activeTypes = types.filter((t) => t.isActive);
        setCustomerTypes(activeTypes);
        const counts = await Promise.all(
          activeTypes.map((type) =>
            getAudiencePreviewCount({ ruleType: "CUSTOMER_TYPE", customerTypeId: type.id })
          )
        );
        if (!cancelled) {
          setTypeCounts(Object.fromEntries(activeTypes.map((type, i) => [type.id, counts[i]])));
        }
      })
      .catch(() => {
        if (!cancelled) setCustomerTypes([]);
      })
      .finally(() => {
        if (!cancelled) setTypeCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Push a complete rule up to the composer whenever the selection changes.
  useEffect(() => {
    if (!selectedType) {
      onRuleChange(null);
      return;
    }
    const selectedTypeName = customerTypes.find((t) => t.id === selectedCustomerTypeId)?.name ?? "";
    const built = buildRule(
      selectedType,
      selectedCustomerTypeId,
      selectedTypeName,
      sinceDate,
      historyCampaignType,
      beforeDate,
      customerIds
    );
    onRuleChange(built);
    // onRuleChange identity isn't stable across renders in the composer;
    // only the rule's own inputs should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, selectedCustomerTypeId, sinceDate, historyCampaignType, beforeDate, pickedCustomers, customerTypes]);

  // Live count for advanced rules — the five static ones already have
  // counts fetched up front (see `counts`), customer types have their own
  // prefetched `typeCounts`, so only fetch here for the "advanced" rules
  // once their required inputs are filled in. SPECIFIC_CUSTOMERS is the one
  // exception: its count is exactly the number of picks already made in the
  // UI, so it never needs a round trip to the server.
  useEffect(() => {
    let cancelled = false;

    Promise.resolve()
      .then(async () => {
        if (selectedType === "SPECIFIC_CUSTOMERS") {
          setPreviewCount(customerIds.length);
          return;
        }
        if (!isAdvanced) {
          setPreviewCount(null);
          return;
        }
        const built = buildRule(
          selectedType as AudienceRuleType,
          selectedCustomerTypeId,
          "",
          sinceDate,
          historyCampaignType,
          beforeDate,
          customerIds
        );
        if (!built) {
          setPreviewCount(null);
          return;
        }

        setPreviewLoading(true);
        try {
          const count = await getAudiencePreviewCount(built);
          if (!cancelled) setPreviewCount(count);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdvanced, selectedType, selectedCustomerTypeId, sinceDate, historyCampaignType, beforeDate, customerIds]);

  const staticSelected = STATIC_OPTIONS.find((o) => o.ruleType === selectedType);
  const advancedSelected = ADVANCED_OPTIONS.find((o) => o.ruleType === selectedType);
  const customerTypeSelected = selectedType === "CUSTOMER_TYPE";
  const selectedCount = staticSelected
    ? counts[staticSelected.countKey]
    : customerTypeSelected
      ? (typeCounts[selectedCustomerTypeId] ?? null)
      : previewCount;

  useEffect(() => {
    onRecipientCountChange(selectedType ? selectedCount : null);
    // onRecipientCountChange identity isn't stable across renders in the
    // composer; only the computed count itself should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, selectedCount]);

  function selectCustomerType(typeId: string) {
    setSelectedType("CUSTOMER_TYPE");
    setSelectedCustomerTypeId(typeId);
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Choose your audience</CardTitle>
          {/* <CardDescription>
            Select which customer type will receive this campaign. Recipient
            counts are calculated live from your customer database.
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          {typeCountsLoading && customerTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">Loading customer types…</p>
          )}
          {!typeCountsLoading && customerTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No customer types yet — add one from Settings → Customers.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {customerTypes.map((type) => {
              const isSelected = customerTypeSelected && selectedCustomerTypeId === type.id;
              const count = typeCounts[type.id];
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => selectCustomerType(type.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <Tag className="size-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{type.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Customers labeled {type.name}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {count === undefined ? "…" : count.toLocaleString("en-US")}
                    </span>
                    <span className="block text-xs text-muted-foreground">recipients</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
        <div className="px-(--card-spacing) pt-1">
          <button
            type="button"
            onClick={() => setShow((prev) => !prev)}
            aria-expanded={show}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            {show ? "Hide audiences" : "More audiences"}
            {show ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </Card>
      {show && (
      <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-3">
      <Card>
        <CardHeader>
          <CardTitle>Other </CardTitle>
          <CardDescription>
            Target customers based on missing data or profile verification status.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {STATIC_OPTIONS.map((option) => {
            const isSelected = option.ruleType === selectedType;
            const count = counts[option.countKey];
            return (
              <button
                key={option.ruleType}
                type="button"
                onClick={() => setSelectedType(option.ruleType)}
                aria-pressed={isSelected}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md border",
                    isSelected
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  <option.icon className="size-4" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">
                    {count.toLocaleString("en-US")}
                  </span>
                  <span className="block text-xs text-muted-foreground">recipients</span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced audiences</CardTitle>
          <CardDescription>
            Target customers based on when they joined or their history with
            other campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {ADVANCED_OPTIONS.map((option) => {
            const isSelected = option.ruleType === selectedType;
            return (
              <div
                key={option.ruleType}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedType(option.ruleType)}
                  aria-pressed={isSelected}
                  className="flex w-full items-center gap-4 text-left focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <option.icon className="size-4" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>

                  {isSelected && (
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-sm font-semibold tabular-nums transition-opacity",
                          previewLoading ? "opacity-40" : "opacity-100"
                        )}
                      >
                        {previewCount !== null ? previewCount.toLocaleString("en-US") : "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground">recipients</span>
                    </span>
                  )}
                </button>

                {isSelected && option.ruleType === "NEW_SINCE_DATE" && (
                  <div className="flex flex-col gap-1.5 pl-12">
                    <Label htmlFor="quick-send-since-date">Since date</Label>
                    <DatePicker
                      id="quick-send-since-date"
                      value={sinceDate}
                      onChange={setSinceDate}
                      className="max-w-xs"
                    />
                  </div>
                )}

                {isSelected && option.ruleType === "NEVER_RECEIVED_TYPE" && (
                  <div className="flex flex-col gap-1.5 pl-12">
                    <Label htmlFor="quick-send-never-received-type">Campaign type</Label>
                    <Select value={historyCampaignType} onValueChange={(value) => setHistoryCampaignType(value ?? "")}>
                      <SelectTrigger id="quick-send-never-received-type" className="max-w-xs">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_TYPE_OPTIONS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {isSelected && option.ruleType === "RECEIVED_TYPE_BEFORE_DATE" && (
                  <div className="flex flex-wrap gap-4 pl-12">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-send-received-type">Campaign type</Label>
                      <Select value={historyCampaignType} onValueChange={(value) => setHistoryCampaignType(value ?? "")}>
                        <SelectTrigger id="quick-send-received-type" className="w-48">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMPAIGN_TYPE_OPTIONS.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="quick-send-before-date">Before date</Label>
                      <DatePicker
                        id="quick-send-before-date"
                        value={beforeDate}
                        onChange={setBeforeDate}
                      />
                    </div>
                  </div>
                )}

                {isSelected && option.ruleType === "SPECIFIC_CUSTOMERS" && (
                  <div className="flex flex-col gap-3 pl-12">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => setPickerOpen(true)}
                    >
                      <UserPlus className="size-4" aria-hidden="true" />
                      Choose customers
                    </Button>

                    {pickedCustomers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pickedCustomers.map((customer) => (
                          <Badge key={customer.id} variant="secondary" className="gap-1 pr-1">
                            {customer.name}
                            <button
                              type="button"
                              onClick={() =>
                                onPickedCustomersChange(
                                  pickedCustomers.filter((c) => c.id !== customer.id)
                                )
                              }
                              aria-label={`Remove ${customer.name}`}
                              className="flex size-3.5 items-center justify-center rounded-full hover:bg-muted-foreground/20"
                            >
                              <X className="size-2.5" aria-hidden="true" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      </div>
     )}
      <CustomerPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={pickedCustomers}
        onConfirm={onPickedCustomersChange}
      />

      {(staticSelected || advancedSelected || customerTypeSelected) && selectedCount !== null && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {selectedCount.toLocaleString("en-US")} customers
          </span>{" "}
          will receive this campaign.
        </p>
      )}
    </div>
  );
}
