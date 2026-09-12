# Safe Clip for PopClip

[![CI](https://github.com/kekincai/safe-clip-popclip/actions/workflows/ci.yml/badge.svg)](https://github.com/kekincai/safe-clip-popclip/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/kekincai/safe-clip-popclip)](https://github.com/kekincai/safe-clip-popclip/releases/latest)

Safe Clip redacts common secrets and personal data from selected text before you copy or replace it. Processing happens locally inside PopClip: the extension has no network entitlement, does not read files, and does not store the selected text.

## Actions

- **Copy Safe** copies a sanitized version while leaving the source text unchanged.
- **Replace Safe** replaces the current selection with its sanitized version.

Secrets are always checked. Optional categories are enabled by default and can be changed in PopClip's extension settings.

| Category | Examples |
| --- | --- |
| Secrets | API tokens, bearer/basic credentials, JWTs, private keys, password fields, credentials in connection URLs, sensitive URL parameters |
| Personal data | Email addresses, phone numbers, IPv4 addresses |
| Financial data | Luhn-valid payment card numbers and labeled account or balance fields in English, Chinese and Japanese |

Safe Clip uses deterministic pattern matching. It can miss unusual formats or redact harmless text that resembles sensitive data. Always review sanitized text before sharing it.

## Requirements

- PopClip 2026.8.1 (build 6221) or newer
- macOS

## Install

1. Download `SafeClip.popclipextz` from the [latest release](https://github.com/kekincai/safe-clip-popclip/releases/latest).
2. Double-click the downloaded package in Finder.
3. Review PopClip's installation prompt and enable the actions you want. PopClip may warn that a directly distributed community extension is unsigned.

During development, run the tests first and then double-click the package to reinstall it.

## Privacy and security

- No network entitlement is requested.
- No API key or account is required.
- No selected text is logged or persisted by the extension.
- Copy Safe is recommended when you do not want to modify the source document.
- Pattern matching is a safety aid, not a guarantee that a document is anonymous.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting guidance and the supported security scope.

## Development

The redaction engine is plain JavaScript so it can be tested with Node.js and imported by PopClip's TypeScript configuration.

```bash
npm test
```

Repository layout:

```text
SafeClip.popclipext/
  Config.ts       PopClip metadata, options and actions
  redact.js       Local redaction engine
test/
  redact.test.js  Node test suite
```

## Contributing

Bug reports and focused pattern additions are welcome. Test data must be synthetic—never include real tokens, account details, personal data or private documents in an issue, fixture or pull request.

## License

[MIT](LICENSE)
