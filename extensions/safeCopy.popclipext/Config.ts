// #popclip
// name: safeCopy
// identifier: app.safeclip.popclip
// popclipVersion: 6221
// description: Copy selected text after locally redacting secrets and personal data.
// keywords: redact privacy secret token password pii sanitize copy
// icon: safe-copy.svg
// showAs: icon

import { redactText } from "./redact.js";

const options = [
  { identifier: "redactEmails", label: "Email addresses", type: "boolean", defaultValue: true },
  { identifier: "redactPhones", label: "Phone numbers", type: "boolean", defaultValue: true },
  { identifier: "redactIpAddresses", label: "IPv4 addresses", type: "boolean", defaultValue: true },
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

type Options = InferOptions<typeof options>;

defineExtension<Options>({
  options,
  action: async (input, currentOptions) => {
    await popclip.copyText(redactText(input.text, currentOptions).text);
  },
  test: () => {
    const actual = redactText("Authorization: Bearer abcdefghijklmnop").text;
    const expected = "Authorization: Bearer [REDACTED:BEARER_TOKEN]";
    if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
  },
});
