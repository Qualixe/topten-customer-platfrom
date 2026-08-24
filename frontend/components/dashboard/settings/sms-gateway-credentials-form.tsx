"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, Send } from "lucide-react";

import { FormField } from "@/components/dashboard/form-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getSmsGatewayCredentials,
  sendSmsGatewayTestSms,
  updateSmsGatewayCredentials,
  type RequestStyle,
  type SmsGatewayCredentials,
  type TestSmsResult,
} from "@/lib/api/integration-credentials";
import { ApiError } from "@/lib/api/types";

const MASKED_PLACEHOLDER = "••••••••••••";

/** The request-shape fields a provider preset controls — everything past
 * URL/key/sender ID/rate. */
interface FieldMapping {
  requestStyle: RequestStyle;
  apiKeyField: string;
  senderIdField: string;
  numberField: string;
  messageField: string;
  requestIdField: string;
  successField: string;
  successValue: string;
}

type PresetId = "common" | "ssl_wireless" | "custom";

/** Picking a preset fills in every field below in one go — the whole point
 * is that almost nobody should ever need to type these by hand. "Custom" is
 * the escape hatch for a provider that matches neither. */
const PRESETS: Record<Exclude<PresetId, "custom">, { label: string; mapping: FieldMapping }> = {
  common: {
    label: "Common (GET query string) — most BD resellers, e.g. bulksmsbd.net",
    mapping: {
      requestStyle: "GET_QUERY",
      apiKeyField: "api_key",
      senderIdField: "senderid",
      numberField: "number",
      messageField: "message",
      requestIdField: "",
      // These gateways return HTTP 200 even on failure — response_code is
      // the real result. Without this, a failed send reads as "Sent".
      successField: "response_code",
      successValue: "202",
    },
  },
  ssl_wireless: {
    label: "SSL Wireless SMS Plus",
    mapping: {
      requestStyle: "POST_JSON",
      apiKeyField: "api_token",
      senderIdField: "sid",
      numberField: "msisdn",
      messageField: "sms",
      requestIdField: "csms_id",
      successField: "status_code",
      successValue: "200",
    },
  },
};

function mappingsEqual(a: FieldMapping, b: FieldMapping): boolean {
  return (
    a.requestStyle === b.requestStyle &&
    a.apiKeyField === b.apiKeyField &&
    a.senderIdField === b.senderIdField &&
    a.numberField === b.numberField &&
    a.messageField === b.messageField &&
    a.requestIdField === b.requestIdField &&
    a.successField === b.successField &&
    a.successValue === b.successValue
  );
}

function detectPreset(mapping: FieldMapping): PresetId {
  for (const [id, preset] of Object.entries(PRESETS) as [Exclude<PresetId, "custom">, (typeof PRESETS)[keyof typeof PRESETS]][]) {
    if (mappingsEqual(mapping, preset.mapping)) return id;
  }
  return "custom";
}

const REQUEST_STYLE_LABELS: Record<RequestStyle, string> = {
  GET_QUERY: "GET — query string",
  POST_JSON: "POST — JSON body",
  POST_FORM: "POST — form body",
};

export function SmsGatewayCredentialsForm() {
  const [status, setStatus] = useState<SmsGatewayCredentials | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [ratePerSegmentBdt, setRatePerSegmentBdt] = useState("");
  const [preset, setPreset] = useState<PresetId>("common");
  const [mapping, setMapping] = useState<FieldMapping>(PRESETS.common.mapping);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getSmsGatewayCredentials()
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setApiUrl(data.apiUrl.value ?? "");
        setSenderId(data.senderId.value ?? "");
        setRatePerSegmentBdt(data.ratePerSegmentBdt.value ?? "");
        const loadedMapping: FieldMapping = {
          requestStyle: (data.requestStyle.value as RequestStyle | null) ?? "GET_QUERY",
          apiKeyField: data.apiKeyField.value ?? "api_key",
          senderIdField: data.senderIdField.value ?? "senderid",
          numberField: data.numberField.value ?? "number",
          messageField: data.messageField.value ?? "message",
          requestIdField: data.requestIdField.value ?? "",
          successField: data.successField.value ?? "",
          successValue: data.successValue.value ?? "",
        };
        setMapping(loadedMapping);
        setPreset(detectPreset(loadedMapping));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Unable to load saved credentials."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePresetChange(nextPreset: PresetId) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setMapping(PRESETS[nextPreset].mapping);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updated = await updateSmsGatewayCredentials({
        apiUrl,
        apiKey: apiKey || undefined,
        senderId,
        ratePerSegmentBdt,
        requestStyle: mapping.requestStyle,
        apiKeyField: mapping.apiKeyField || undefined,
        senderIdField: mapping.senderIdField || undefined,
        numberField: mapping.numberField || undefined,
        messageField: mapping.messageField || undefined,
        requestIdField: mapping.requestIdField,
        successField: mapping.successField,
        successValue: mapping.successValue,
      });
      setStatus(updated);
      setApiKey("");
      setRatePerSegmentBdt(updated.ratePerSegmentBdt.value ?? "");
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to reach the API server. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>SMS Gateway</CardTitle>
          <CardDescription>
            Works with any SMS provider — enter its URL and credentials, and
            pick it from the list below (or choose Custom if it&apos;s not
            listed).
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-5">
            <FormField
              htmlFor="sms-gateway-api-url"
              label="API URL"
              description="Your provider's send-SMS endpoint, e.g. https://example.com/api/smsapi."
            >
              <Input
                id="sms-gateway-api-url"
                type="url"
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
                placeholder="https://your-provider.com/api/smsapi"
                disabled={loading}
              />
            </FormField>

            <FormField
              htmlFor="sms-gateway-api-key"
              label="API Key"
              description={
                status?.apiKey.isSet
                  ? "A key is already saved — leave blank to keep it, or enter a new one to replace it."
                  : "Not set yet."
              }
            >
              <Input
                id="sms-gateway-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={status?.apiKey.isSet ? MASKED_PLACEHOLDER : "Enter API key"}
                disabled={loading}
              />
            </FormField>

            <FormField
              htmlFor="sms-gateway-sender-id"
              label="Sender ID"
              description="The approved sender ID/number registered with your provider."
            >
              <Input
                id="sms-gateway-sender-id"
                value={senderId}
                onChange={(event) => setSenderId(event.target.value)}
                placeholder="e.g. TOPTEN"
                disabled={loading}
              />
            </FormField>

            <FormField
              htmlFor="sms-gateway-rate"
              label="Rate per SMS segment (BDT)"
              description="Most gateways don't expose pricing via API, so this rate is set manually and used to estimate campaign costs."
            >
              <Input
                id="sms-gateway-rate"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={ratePerSegmentBdt}
                onChange={(event) => setRatePerSegmentBdt(event.target.value)}
                placeholder="e.g. 0.45"
                disabled={loading}
              />
            </FormField>

            <FormField
              htmlFor="sms-gateway-preset"
              label="Provider"
              description="Fills in the request shape and field names below automatically."
            >
              <Select value={preset} onValueChange={(value) => handlePresetChange((value as PresetId) ?? "common")}>
                <SelectTrigger id="sms-gateway-preset" disabled={loading}>
                  <SelectValue>
                    {(value: PresetId) => (value === "custom" ? "Custom / other" : PRESETS[value].label)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">{PRESETS.common.label}</SelectItem>
                  <SelectItem value="ssl_wireless">{PRESETS.ssl_wireless.label}</SelectItem>
                  <SelectItem value="custom">Custom / other</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {preset === "custom" && (
              <div className="flex flex-col gap-5 rounded-lg border border-dashed p-4">
                <p className="text-xs text-muted-foreground">
                  Match your provider&apos;s exact API — the field names it
                  expects and how it reports success.
                </p>

                <FormField
                  htmlFor="sms-gateway-request-style"
                  label="Request style"
                  description="How credentials/number/message are sent to the API URL."
                >
                  <Select
                    value={mapping.requestStyle}
                    onValueChange={(value) =>
                      setMapping((prev) => ({ ...prev, requestStyle: (value as RequestStyle) ?? "GET_QUERY" }))
                    }
                  >
                    <SelectTrigger id="sms-gateway-request-style" disabled={loading}>
                      <SelectValue>
                        {(value: RequestStyle) => REQUEST_STYLE_LABELS[value]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(REQUEST_STYLE_LABELS) as [RequestStyle, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField htmlFor="sms-gateway-api-key-field" label="API key field name">
                    <Input
                      id="sms-gateway-api-key-field"
                      value={mapping.apiKeyField}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, apiKeyField: event.target.value }))
                      }
                      placeholder="api_key"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField htmlFor="sms-gateway-sender-id-field" label="Sender ID field name">
                    <Input
                      id="sms-gateway-sender-id-field"
                      value={mapping.senderIdField}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, senderIdField: event.target.value }))
                      }
                      placeholder="senderid"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField htmlFor="sms-gateway-number-field" label="Phone number field name">
                    <Input
                      id="sms-gateway-number-field"
                      value={mapping.numberField}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, numberField: event.target.value }))
                      }
                      placeholder="number"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField htmlFor="sms-gateway-message-field" label="Message field name">
                    <Input
                      id="sms-gateway-message-field"
                      value={mapping.messageField}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, messageField: event.target.value }))
                      }
                      placeholder="message"
                      disabled={loading}
                    />
                  </FormField>
                </div>

                <FormField
                  htmlFor="sms-gateway-request-id-field"
                  label="Request ID field name (optional)"
                  description="For providers that require a unique id per request (e.g. SSL Wireless's csms_id) — a fresh one is generated automatically. Leave blank if not needed."
                >
                  <Input
                    id="sms-gateway-request-id-field"
                    value={mapping.requestIdField}
                    onChange={(event) =>
                      setMapping((prev) => ({ ...prev, requestIdField: event.target.value }))
                    }
                    placeholder="e.g. csms_id"
                    disabled={loading}
                  />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    htmlFor="sms-gateway-success-field"
                    label="Success field (optional)"
                    description="Response body field to check instead of HTTP status."
                  >
                    <Input
                      id="sms-gateway-success-field"
                      value={mapping.successField}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, successField: event.target.value }))
                      }
                      placeholder="e.g. status_code"
                      disabled={loading}
                    />
                  </FormField>
                  <FormField
                    htmlFor="sms-gateway-success-value"
                    label="Success value (optional)"
                    description="Value that field must equal to count as sent."
                  >
                    <Input
                      id="sms-gateway-success-value"
                      value={mapping.successValue}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, successValue: event.target.value }))
                      }
                      placeholder="e.g. 200"
                      disabled={loading}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="size-4" aria-hidden="true" />
                Saved
              </span>
            )}
            <Button type="submit" disabled={loading || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <TestSmsCard credentialsSaved={!loading && Boolean(status?.apiKey.isSet && status?.apiUrl.value)} />
    </div>
  );
}

function TestSmsCard({ credentialsSaved }: { credentialsSaved: boolean }) {
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState(
    "This is a test message from TopTen Customer Platform."
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestSmsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setResult(null);

    try {
      setResult(await sendSmsGatewayTestSms({ number, message }));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to reach the API server. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a test SMS</CardTitle>
        <CardDescription>
          Sends one real message through your configured gateway to a number
          you choose — the quickest way to confirm the URL, API key, and
          sender ID actually work. Never touches customer data or campaigns.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSend}>
        <CardContent className="flex flex-col gap-5">
          <FormField htmlFor="sms-gateway-test-sms-number" label="Phone number">
            <Input
              id="sms-gateway-test-sms-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              placeholder="e.g. 01711000101"
              disabled={!credentialsSaved || sending}
              required
            />
          </FormField>

          <FormField htmlFor="sms-gateway-test-sms-message" label="Message">
            <Textarea
              id="sms-gateway-test-sms-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={!credentialsSaved || sending}
              required
            />
          </FormField>

          {!credentialsSaved && (
            <p className="text-sm text-muted-foreground">
              Save an API URL, API key, and sender ID above first.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div
              className={
                result.success
                  ? "flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
                  : "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              }
            >
              {result.success ? (
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="whitespace-pre-wrap break-words">
                {result.success ? "Sent — " : `Failed (HTTP ${result.httpStatus}) — `}
                {result.message || "No response body returned."}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!credentialsSaved || sending}>
            <Send className="size-4" aria-hidden="true" />
            {sending ? "Sending…" : "Send test SMS"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
