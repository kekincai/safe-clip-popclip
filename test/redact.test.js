import test from "node:test";
import assert from "node:assert/strict";

import {
  luhnValid,
  redactText,
  validIpv4,
} from "../src/redact.js";

test("redacts known API token formats", () => {
  const input = "OPENAI_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz012345";
  const result = redactText(input);
  assert.equal(result.text, "OPENAI_KEY=[REDACTED:TOKEN]");
  assert.equal(result.count, 1);
});

test("redacts additional provider and environment secret formats", () => {
  const input = [
    "STRIPE=sk_test_abcdefghijklmnopqrstuvwxyz",
    "ANTHROPIC=sk-ant-abcdefghijklmnopqrstuvwxyz",
    "AWS_SECRET_ACCESS_KEY=not-a-real-aws-secret",
  ].join("\n");
  const output = redactText(input).text;
  assert.equal(output.includes("not-a-real-aws-secret"), false);
  assert.equal((output.match(/\[REDACTED:(?:TOKEN|SECRET)\]/g) ?? []).length, 3);
});

test("redacts structured secrets while preserving the key", () => {
  const result = redactText('{"client_secret":"not-a-real-secret"}');
  assert.equal(result.text, '{"client_secret":"[REDACTED:SECRET]"}');
});

test("redacts authorization headers", () => {
  const result = redactText("Authorization: Bearer abcdefghijklmnop");
  assert.equal(
    result.text,
    "Authorization: Bearer [REDACTED:BEARER_TOKEN]",
  );
});

test("redacts JWTs without consuming adjacent text", () => {
  const token = "eyJabcdefgh.abcdefgh.abcdefgh";
  assert.equal(
    redactText(`token=${token},next`).text,
    "token=[REDACTED:JWT],next",
  );
});

test("redacts credentials embedded in connection URLs", () => {
  const result = redactText("postgres://user:not-real-password@example.test/db");
  assert.equal(
    result.text,
    "postgres://user:[REDACTED:PASSWORD]@example.test/db",
  );
});

test("treats Unicode whitespace as a connection-password boundary", () => {
  const input = "postgres://user:password\u00a0tail@example.test/db";
  assert.equal(
    redactText(input).text,
    "postgres://user:password\u00a0[REDACTED:EMAIL]/db",
  );
});

test("redacts sensitive URL parameters without removing the URL", () => {
  const result = redactText(
    "https://example.test/join?room=demo&passcode=not-real-code&lang=ja",
  );
  assert.equal(
    result.text,
    "https://example.test/join?room=demo&passcode=%5BREDACTED%3AURL_SECRET%5D&lang=ja",
  );
});

test("redacts a complete private key block", () => {
  const input = [
    "before",
    "-----BEGIN PRIVATE KEY-----",
    "not-real-key-material",
    "-----END PRIVATE KEY-----",
    "after",
  ].join("\n");
  assert.equal(
    redactText(input).text,
    "before\n[REDACTED:PRIVATE_KEY]\nafter",
  );
});

test("redacts escaped private keys inside JSON", () => {
  const input =
    '{"private_key":"-----BEGIN PRIVATE KEY-----\\nnot-real\\n-----END PRIVATE KEY-----","client_email":"service@example.test"}';
  assert.equal(
    redactText(input).text,
    '{"private_key":"[REDACTED:PRIVATE_KEY]","client_email":"[REDACTED:EMAIL]"}',
  );
});

test("preserves multiline and mixed-quote structured-key compatibility", () => {
  const input = `{'private-key':"line one\nline two', "status":"ok"}`;
  assert.equal(
    redactText(input).text,
    `{'private-key':"[REDACTED:PRIVATE_KEY]', "status":"ok"}`,
  );
});

test("handles repeated incomplete candidates in bounded time", { timeout: 2000 }, () => {
  const repeats = 10_000;
  const inputs = [
    "-----BEGIN PRIVATE KEY-----".repeat(repeats),
    "eyJaaaaaaaa-".repeat(repeats),
    "a://".repeat(repeats),
    '{"private_key":"AAAA'.repeat(repeats),
    "a@a".repeat(repeats),
  ];

  for (const input of inputs) {
    assert.equal(redactText(input).count, 0);
  }
});

test("redacts common personal identifiers", () => {
  const input = "Contact person@example.test at +81 90-1234-5678 from 192.168.1.20";
  assert.equal(
    redactText(input).text,
    "Contact [REDACTED:EMAIL] at [REDACTED:PHONE] from [REDACTED:IP_ADDRESS]",
  );
});

test("redacts valid payment cards but leaves invalid digit groups", () => {
  assert.equal(
    redactText("Card 4111 1111 1111 1111").text,
    "Card [REDACTED:PAYMENT_CARD]",
  );
  assert.deepEqual(redactText("Reference 4111 1111 1111 1112"), {
    text: "Reference 4111 1111 1111 1112",
    count: 0,
  });
});

test("redacts labeled financial fields in Chinese and Japanese", () => {
  const result = redactText("口座残高：￥123,456\n账户余额: CNY 8000");
  assert.equal(
    result.text,
    "口座残高：[REDACTED:BALANCE]\n账户余额: [REDACTED:BALANCE]",
  );
});

test("redacts labeled account identifiers without consuming later words", () => {
  const result = redactText("Account number: 1234 5678 9012 owner: demo");
  assert.equal(result.text, "Account number: [REDACTED:ACCOUNT] owner: demo");
});

test("respects personal-data options", () => {
  const result = redactText("person@example.test 192.168.1.20", {
    redactEmails: false,
    redactIpAddresses: false,
  });
  assert.equal(result.text, "person@example.test 192.168.1.20");
});

test("supports generic replacement markers", () => {
  const result = redactText("person@example.test", {
    descriptiveLabels: false,
  });
  assert.equal(result.text, "[REDACTED]");
});

test("does not change ordinary developer text", () => {
  const input = '{"status":"ok","count":42,"date":"2026-09-13"}';
  assert.deepEqual(redactText(input), { text: input, count: 0 });
});

test("helper validators reject malformed values", () => {
  assert.equal(luhnValid("4111 1111 1111 1111"), true);
  assert.equal(luhnValid("0000 0000 0000 0000"), false);
  assert.equal(validIpv4("192.168.1.20"), true);
  assert.equal(validIpv4("999.168.1.20"), false);
  assert.equal(validIpv4("192.168.01.20"), false);
});
