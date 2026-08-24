"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Send } from "lucide-react";

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

const REQUEST_STYLE_LABELS: Record<RequestStyle, string> = {
  GET_QUERY: "GET — query string",
  POST_JSON: "POST — JSON body",
  POST_FORM: "POST — form body",
};

const DEFAULT_API_KEY_FIELD = "api_key";
const DEFAULT_SENDER_ID_FIELD = "senderid";
const DEFAULT_NUMBER_FIELD = "number";
const DEFAULT_MESSAGE_FIELD = "message";

export function SmsGatewayCredentialsForm() {
  const [status, setStatus] = useState<SmsGatewayCredentials | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [ratePerSegmentBdt, setRatePerSegmentBdt] = useState("");
  const [requestStyle, setRequestStyle] = useState<RequestStyle>("GET_QUERY");
  const [apiKeyField, setApiKeyField] = useState(DEFAULT_API_KEY_FIELD);
  const [senderIdField, setSenderIdField] = useState(DEFAULT_SENDER_ID_FIELD);
  const [numberField, setNumberField] = useState(DEFAULT_NUMBER_FIELD);
  const [messageField, setMessageField] = useState(DEFAULT_MESSAGE_FIELD);
  const [requestIdField, setRequestIdField] = useState("");
  const [successField, setSuccessField] = useState("");
  const [successValue, setSuccessValue] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
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
        setRequestStyle((data.requestStyle.value as RequestStyle | null) ?? "GET_QUERY");
        setApiKeyField(data.apiKeyField.value ?? DEFAULT_API_KEY_FIELD);
        setSenderIdField(data.senderIdField.value ?? DEFAULT_SENDER_ID_FIELD);
        setNumberField(data.numberField.value ?? DEFAULT_NUMBER_FIELD);
        setMessageField(data.messageField.value ?? DEFAULT_MESSAGE_FIELD);
        setRequestIdField(data.requestIdField.value ?? "");
        setSuccessField(data.successField.value ?? "");
        setSuccessValue(data.successValue.value ?? "");
        // Auto-expand for a returning admin who already customized this —
        // otherwise their config would be hidden from them by default.
        const hasCustomConfig =
          (data.requestStyle.value ?? "GET_QUERY") !== "GET_QUERY" ||
          (data.apiKeyField.value ?? DEFAULT_API_KEY_FIELD) !== DEFAULT_API_KEY_FIELD ||
          (data.senderIdField.value ?? DEFAULT_SENDER_ID_FIELD) !== DEFAULT_SENDER_ID_FIELD ||
          (data.numberField.value ?? DEFAULT_NUMBER_FIELD) !== DEFAULT_NUMBER_FIELD ||
          (data.messageField.value ?? DEFAULT_MESSAGE_FIELD) !== DEFAULT_MESSAGE_FIELD ||
          Boolean(data.requestIdField.value) ||
          Boolean(data.successField.value);
        if (hasCustomConfig) setShowAdvanced(true);
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
        requestStyle,
        apiKeyField: apiKeyField || undefined,
        senderIdField: senderIdField || undefined,
        numberField: numberField || undefined,
        messageField: messageField || undefined,
        requestIdField,
        successField,
        successValue,
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
            Works with any SMS provider — configure the send-SMS URL and
            credentials below, and (if your provider needs it) its exact
            request shape and field names under Advanced.
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

            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
              Advanced: request shape &amp; field names
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-5 rounded-lg border border-dashed p-4">
                <p className="text-xs text-muted-foreground">
                  Only needed if your provider doesn&apos;t use the common
                  GET + <code>api_key</code>/<code>senderid</code>/
                  <code>number</code>/<code>message</code> convention (e.g.
                  SSL Wireless SMS Plus, which needs POST + JSON with
                  different field names).
                </p>

                <FormField
                  htmlFor="sms-gateway-request-style"
                  label="Request style"
                  description="How credentials/number/message are sent to the API URL."
                >
                  <Select
                    value={requestStyle}
                    onValueChange={(value) => setRequestStyle((value as RequestStyle) ?? "GET_QUERY")}
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
                      value={apiKeyField}
                      onChange={(event) => setApiKeyField(event.target.value)}
                      placeholder={DEFAULT_API_KEY_FIELD}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField htmlFor="sms-gateway-sender-id-field" label="Sender ID field name">
                    <Input
                      id="sms-gateway-sender-id-field"
                      value={senderIdField}
                      onChange={(event) => setSenderIdField(event.target.value)}
                      placeholder={DEFAULT_SENDER_ID_FIELD}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField htmlFor="sms-gateway-number-field" label="Phone number field name">
                    <Input
                      id="sms-gateway-number-field"
                      value={numberField}
                      onChange={(event) => setNumberField(event.target.value)}
                      placeholder={DEFAULT_NUMBER_FIELD}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField htmlFor="sms-gateway-message-field" label="Message field name">
                    <Input
                      id="sms-gateway-message-field"
                      value={messageField}
                      onChange={(event) => setMessageField(event.target.value)}
                      placeholder={DEFAULT_MESSAGE_FIELD}
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
                    value={requestIdField}
                    onChange={(event) => setRequestIdField(event.target.value)}
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
                      value={successField}
                      onChange={(event) => setSuccessField(event.target.value)}
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
                      value={successValue}
                      onChange={(event) => setSuccessValue(event.target.value)}
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
