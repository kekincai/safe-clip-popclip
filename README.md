# Safe Clip for PopClip

[![CI](https://github.com/kekincai/safe-clip-popclip/actions/workflows/ci.yml/badge.svg)](https://github.com/kekincai/safe-clip-popclip/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/kekincai/safe-clip-popclip)](https://github.com/kekincai/safe-clip-popclip/releases/latest)

Safe Clip provides two independent PopClip extensions that redact common secrets and personal data. Processing happens locally inside PopClip: neither extension has a network entitlement, reads files, or stores the selected text.

## Actions

- **safeCopy** copies a sanitized version while leaving the source text unchanged.
- **safeReplace** replaces the current selection with its sanitized version.

They are separate single-action packages, so PopClip shows their exact names without adding a shared “Safe Clip” action prefix. Their custom icons distinguish overlapping documents for copying from opposing arrows for replacement.

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

1. Download `safeCopy.popclipextz` and/or `safeReplace.popclipextz` from the [latest release](https://github.com/kekincai/safe-clip-popclip/releases/latest).
2. Double-click each downloaded package in Finder.
3. Review PopClip's installation prompt. PopClip may warn that a directly distributed community extension is unsigned.

During development, edit the canonical engine in `src/redact.js`, run `npm run sync`, then run `npm run check`. Install the generated packages from `dist/`.

## Privacy and security

- No network entitlement is requested.
- No API key or account is required.
- No selected text is logged or persisted by the extension.
- safeCopy is recommended when you do not want to modify the source document.
- Pattern matching is a safety aid, not a guarantee that a document is anonymous.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting guidance and the supported security scope.

## Development

The redaction engine is plain JavaScript so it can be tested with Node.js and imported by PopClip's TypeScript configuration.

```bash
npm run check
```

Repository layout:

```text
extensions/                 Directory-ready `.popclipext` source packages
src/redact.js               Canonical local redaction engine
scripts/sync-packages.mjs   Keeps both package copies synchronized
scripts/build.mjs           Reproducible `.popclipextz` builder
popclip-directory.yaml      Official directory submission configuration
test/                       Node test suite
dist/                       Generated installable packages, not committed
```

## Contributing

Bug reports and focused pattern additions are welcome. Test data must be synthetic—never include real tokens, account details, personal data or private documents in an issue, fixture or pull request.

## License

[MIT](LICENSE)
