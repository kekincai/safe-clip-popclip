# safeReplace

Replace selected text with a locally redacted version containing no detected secrets or personal data.

## What it detects

- API tokens, JWTs, authorization headers and private keys
- Passwords and credentials in structured fields, URLs and connection strings
- Email addresses, phone numbers and IPv4 addresses
- Luhn-valid payment card numbers
- Labeled account and balance fields in English, Chinese and Japanese

All processing happens inside PopClip. safeReplace has no network entitlement, does not read files and does not persist the selected text.

## Options

Email, phone, IPv4 and financial detection can be switched on or off independently. Descriptive replacement labels such as `[REDACTED:EMAIL]` can be replaced with a generic `[REDACTED]` marker.

Pattern matching can miss unusual formats or redact harmless text that resembles sensitive data. Review the result before sharing it. Use `safeCopy` instead when the original document must not be modified.

## Changelog

- 0.3.0: Initial PopClip Extensions Directory submission.
