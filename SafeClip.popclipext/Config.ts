// #popclip
// name: Safe Clip
// identifier: app.safeclip.popclip
// popclipVersion: 6221
// description: Redact secrets and personal data locally before copying or replacing selected text.
// keywords: redact privacy secret token password pii sanitize
// icon: symbol:hand.raised.fill

import { redactText } from "./redact.js";

const safeClipOptions = [
  {
    identifier: "redactEmails",
    label: "Email addresses",
    type: "boolean",
    defaultValue: true,
  },
  {
    identifier: "redactPhones",
    label: "Phone numbers",
    type: "boolean",
    defaultValue: true,
  },
  {
    identifier: "redactIpAddresses",
    label: "IPv4 addresses",
    type: "boolean",
    defaultValue: true,
  },
  {
    identifier: "redactFinancial",
    label: "Financial identifiers",
    type: "boolean",
    defaultValue: true,
    description: "Payment card numbers and labeled account or balance values.",
  },
  {
    identifier: "descriptiveLabels",
    label: "Descriptive labels",
    type: "boolean",
    defaultValue: true,
    description: "Use labels such as [REDACTED:EMAIL] instead of [REDACTED].",
  },
] as const;

type SafeClipOptions = InferOptions<typeof safeClipOptions>;

function sanitize(input: Input, options: SafeClipOptions) {
  return redactText(input.text, options).text;
}

function expectEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

defineExtension<SafeClipOptions>({
  options: safeClipOptions,
  actions: [
    {
      title: "Copy Safe",
      icon: "symbol:doc.on.doc.fill",
      requirements: ["text"],
      code: async (input, options) => {
        await popclip.copyText(sanitize(input, options));
      },
    },
    {
      title: "Replace Safe",
      icon: "symbol:rectangle.and.pencil.and.ellipsis",
      requirements: ["text", "paste"],
      code: async (input, options) => {
        await popclip.pasteText(sanitize(input, options));
      },
    },
  ],
  test: () => {
    expectEqual(
      redactText("Authorization: Bearer abcdefghijklmnop").text,
      "Authorization: Bearer [REDACTED:BEARER_TOKEN]",
      "bearer token",
    );
    expectEqual(
      redactText("Contact person@example.test from 192.168.1.20").text,
      "Contact [REDACTED:EMAIL] from [REDACTED:IP_ADDRESS]",
      "personal identifiers",
    );
    expectEqual(
      redactText("口座残高：￥123,456").text,
      "口座残高：[REDACTED:BALANCE]",
      "Japanese balance field",
    );
  },
});
