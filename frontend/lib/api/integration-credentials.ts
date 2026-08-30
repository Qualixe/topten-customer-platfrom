import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/types";

export interface SecretField {
  isSecret: true;
  isSet: boolean;
}

export interface PlainField {
  isSecret: false;
  value: string | null;
}

export type RequestStyle = "GET_QUERY" | "POST_JSON" | "POST_FORM";

/** Not tied to any single SMS provider — the admin points this at whatever
 * gateway's send-SMS endpoint they use, including that provider's exact
 * field names and request shape (see `app.common.sms_gateway_client` on the
 * backend). Everything below `ratePerSegmentBdt` has a default matching the
 * common "GET + query string" convention (e.g. bulksmsbd.net), so a simple
 * gateway needs none of it touched. */
export interface SmsGatewayCredentials {
  apiUrl: PlainField;
  apiKey: SecretField;
  senderId: PlainField;
  /** Most gateways don't expose pricing via API — this is an admin-editable
   * override, always present (falls back to a config default server-side). */
  ratePerSegmentBdt: PlainField;
  requestStyle: PlainField;
  apiKeyField: PlainField;
  senderIdField: PlainField;
  numberField: PlainField;
  messageField: PlainField;
  /** A caller-generated correlation id some providers require per request
   * (e.g. SSL Wireless's `csms_id`) — blank means don't send one. */
  requestIdField: PlainField;
  /** Which response-body field/value combination means success. Needed
   * because many gateways return HTTP 200 even on failure, encoding the
   * real result in the body instead — leaving both blank falls back to
   * "HTTP 2xx = success". */
  successField: PlainField;
  successValue: PlainField;
  /** Optional — not every provider exposes a balance check. Reuses
   * requestStyle/apiKeyField/senderIdField/successField/successValue
   * above; only the URL differs from the send-SMS one. */
  balanceUrl: PlainField;
}

export interface SmsGatewayCredentialsInput {
  apiUrl?: string;
  apiKey?: string;
  senderId?: string;
  ratePerSegmentBdt?: string;
  requestStyle?: RequestStyle;
  apiKeyField?: string;
  senderIdField?: string;
  numberField?: string;
  messageField?: string;
  requestIdField?: string;
  successField?: string;
  successValue?: string;
  balanceUrl?: string;
}

export async function getSmsGatewayCredentials(): Promise<SmsGatewayCredentials> {
  const envelope = await apiGet<ApiEnvelope<SmsGatewayCredentials>>(
    "/notifications/sms-gateway/credentials"
  );
  return envelope.data;
}

export async function updateSmsGatewayCredentials(
  input: SmsGatewayCredentialsInput
): Promise<SmsGatewayCredentials> {
  const envelope = await apiPut<ApiEnvelope<SmsGatewayCredentials>>(
    "/notifications/sms-gateway/credentials",
    {
      api_url: input.apiUrl,
      api_key: input.apiKey,
      sender_id: input.senderId,
      rate_per_segment_bdt: input.ratePerSegmentBdt,
      request_style: input.requestStyle,
      api_key_field: input.apiKeyField,
      sender_id_field: input.senderIdField,
      number_field: input.numberField,
      message_field: input.messageField,
      request_id_field: input.requestIdField,
      success_field: input.successField,
      success_value: input.successValue,
      balance_url: input.balanceUrl,
    }
  );
  return envelope.data;
}

export interface TestSmsResult {
  success: boolean;
  httpStatus: number;
  message: string;
}

/** Sends one real SMS via the configured gateway to a number typed in
 * here — never derived from customer data — to verify the saved
 * URL/API key/sender ID work. Resolves with the provider's own
 * success/failure (a 4xx from this API itself only means the request was
 * invalid, e.g. no credentials saved yet). */
export async function sendSmsGatewayTestSms(input: {
  number: string;
  message: string;
}): Promise<TestSmsResult> {
  const envelope = await apiPost<ApiEnvelope<TestSmsResult>>("/notifications/sms-gateway/test-sms", {
    number: input.number,
    message: input.message,
  });
  return envelope.data;
}

export interface SmsBalance {
  /** Null when the provider call failed, or succeeded with a response
   * shape this client didn't recognize — never a guessed zero. */
  balance: number | null;
  success: boolean;
  httpStatus: number;
  message: string;
}

/** Live account balance from the configured gateway's balance endpoint.
 * Never throws for "not configured" or a provider-side failure — both
 * come back as `success: false` with a `message`, so a page built on this
 * can render a clear state instead of crashing. */
export async function getSmsGatewayBalance(): Promise<SmsBalance> {
  const envelope = await apiGet<ApiEnvelope<SmsBalance>>("/notifications/sms-gateway/balance");
  return envelope.data;
}

export interface PathaoCredentials {
  clientId: PlainField;
  clientSecret: SecretField;
  username: PlainField;
  password: SecretField;
  storeId: PlainField;
  /** Whether dispatching hits Pathao's sandbox or its real, live API.
   * Defaults true (sandbox) until deliberately turned off. */
  sandbox: boolean;
}

export interface PathaoCredentialsInput {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  storeId?: string;
  sandbox?: boolean;
}

export async function getPathaoCredentials(): Promise<PathaoCredentials> {
  const envelope = await apiGet<ApiEnvelope<PathaoCredentials>>("/couriers/pathao/credentials");
  return envelope.data;
}

export async function updatePathaoCredentials(
  input: PathaoCredentialsInput
): Promise<PathaoCredentials> {
  const envelope = await apiPut<ApiEnvelope<PathaoCredentials>>("/couriers/pathao/credentials", {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    username: input.username,
    password: input.password,
    store_id: input.storeId,
    sandbox: input.sandbox,
  });
  return envelope.data;
}

export interface PathaoLocation {
  id: number;
  name: string;
}

export async function listPathaoStores(): Promise<PathaoLocation[]> {
  const envelope = await apiGet<ApiEnvelope<PathaoLocation[]>>("/couriers/pathao/stores");
  return envelope.data;
}

export async function listPathaoCities(): Promise<PathaoLocation[]> {
  const envelope = await apiGet<ApiEnvelope<PathaoLocation[]>>("/couriers/pathao/cities");
  return envelope.data;
}

export async function listPathaoZones(cityId: number): Promise<PathaoLocation[]> {
  const envelope = await apiGet<ApiEnvelope<PathaoLocation[]>>(
    `/couriers/pathao/cities/${cityId}/zones`
  );
  return envelope.data;
}

export async function listPathaoAreas(zoneId: number): Promise<PathaoLocation[]> {
  const envelope = await apiGet<ApiEnvelope<PathaoLocation[]>>(
    `/couriers/pathao/zones/${zoneId}/areas`
  );
  return envelope.data;
}
