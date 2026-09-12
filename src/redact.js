const DEFAULT_OPTIONS = Object.freeze({
  redactEmails: true,
  redactPhones: true,
  redactIpAddresses: true,
  redactFinancial: true,
  descriptiveLabels: true,
});

function optionsWithDefaults(options = {}) {
  return { ...DEFAULT_OPTIONS, ...options };
}

function marker(label, options) {
  return options.descriptiveLabels ? `[REDACTED:${label}]` : "[REDACTED]";
}

function replace(text, pattern, replacement) {
  let count = 0;
  const output = text.replace(pattern, (...args) => {
    const next = typeof replacement === "function"
      ? replacement(...args)
      : replacement;
    if (next !== args[0]) count += 1;
    return next;
  });
  return { text: output, count };
}

function luhnValid(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function validIpv4(value) {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every(
      (part) =>
        /^\d{1,3}$/.test(part) &&
        Number(part) >= 0 &&
        Number(part) <= 255 &&
        (part === "0" || !part.startsWith("0")),
    )
  );
}

function mergeRedaction(state, result) {
  return { text: result.text, count: state.count + result.count };
}

function replaceSpans(text, spans, replacement) {
  if (spans.length === 0) return { text, count: 0 };

  let output = "";
  let cursor = 0;
  let count = 0;
  for (const { start, end } of spans) {
    if (start < cursor || end <= start) continue;
    output += text.slice(cursor, start);
    output += replacement;
    cursor = end;
    count += 1;
  }
  output += text.slice(cursor);
  return { text: output, count };
}

function isAsciiLetter(character) {
  return character !== undefined && /[A-Za-z]/.test(character);
}

function isAsciiWord(character) {
  return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function isPrivateKeyMarker(markerText, kind) {
  const match = /^-----(BEGIN|END)(?: [A-Z0-9]+)? PRIVATE KEY-----$/.exec(markerText);
  return match?.[1] === kind;
}

function redactPrivateKeyBlocks(text, replacement) {
  const markerPattern = /-----(?:BEGIN|END)(?: [A-Z0-9]+)? PRIVATE KEY-----/g;
  const spans = [];
  let openStart = -1;

  for (const match of text.matchAll(markerPattern)) {
    if (isPrivateKeyMarker(match[0], "BEGIN")) {
      if (openStart === -1) openStart = match.index;
    } else if (openStart !== -1) {
      spans.push({ start: openStart, end: match.index + match[0].length });
      openStart = -1;
    }
  }

  return replaceSpans(text, spans, replacement);
}

function isJwtRunCharacter(character) {
  return character !== undefined && /[A-Za-z0-9_.-]/.test(character);
}

function redactJwtTokens(text, replacement) {
  const spans = [];
  let runStart = 0;
  let matchedUntil = 0;

  while (runStart < text.length) {
    while (runStart < text.length && !isJwtRunCharacter(text[runStart])) runStart += 1;
    if (runStart >= text.length) break;

    let runEnd = runStart;
    while (runEnd < text.length && isJwtRunCharacter(text[runEnd])) runEnd += 1;

    const segments = [];
    let segmentStart = runStart;
    for (let index = runStart; index <= runEnd; index += 1) {
      if (index === runEnd || text[index] === ".") {
        segments.push({ start: segmentStart, end: index });
        segmentStart = index + 1;
      }
    }

    for (let index = 0; index + 2 < segments.length; index += 1) {
      const first = segments[index];
      const second = segments[index + 1];
      const third = segments[index + 2];
      if (second.end - second.start < 8 || third.end - third.start < 8) continue;

      let tokenStart = -1;
      const searchStart = Math.max(first.start, matchedUntil);
      for (let position = searchStart; position + 11 <= first.end; position += 1) {
        if (
          text.startsWith("eyJ", position) &&
          (position === 0 || !isAsciiWord(text[position - 1]))
        ) {
          tokenStart = position;
          break;
        }
      }
      if (tokenStart === -1) continue;

      let tokenEnd = third.end;
      while (tokenEnd > third.start && text[tokenEnd - 1] === "-") tokenEnd -= 1;
      if (
        tokenEnd - third.start < 8 ||
        !isAsciiWord(text[tokenEnd - 1]) ||
        (tokenEnd < text.length && isAsciiWord(text[tokenEnd]))
      ) {
        continue;
      }

      spans.push({ start: tokenStart, end: tokenEnd });
      matchedUntil = tokenEnd;
    }

    runStart = runEnd + 1;
  }

  return replaceSpans(text, spans, replacement);
}

function isSchemeCharacter(character) {
  return character !== undefined && /[A-Za-z0-9+.-]/.test(character);
}

function findSchemeStart(text, runStart, runEnd) {
  for (let index = runStart; index < runEnd; index += 1) {
    if (
      isAsciiLetter(text[index]) &&
      (index === 0 || !isAsciiWord(text[index - 1]))
    ) {
      return index;
    }
  }
  return -1;
}

function redactConnectionPasswords(text, replacement) {
  const spans = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const delimiter = text.indexOf("://", searchFrom);
    if (delimiter === -1) break;

    let schemeRunStart = delimiter;
    while (schemeRunStart > 0 && isSchemeCharacter(text[schemeRunStart - 1])) {
      schemeRunStart -= 1;
    }
    const schemeStart = findSchemeStart(text, schemeRunStart, delimiter);

    const usernameStart = delimiter + 3;
    let colon = usernameStart;
    while (
      colon < text.length &&
      text[colon] !== "/" &&
      text[colon] !== ":" &&
      text[colon] !== "@" &&
      !isWhitespace(text[colon])
    ) {
      colon += 1;
    }

    if (schemeStart !== -1 && colon > usernameStart && text[colon] === ":") {
      const passwordStart = colon + 1;
      let passwordEnd = passwordStart;
      while (
        passwordEnd < text.length &&
        text[passwordEnd] !== "@" &&
        text[passwordEnd] !== "/" &&
        !isWhitespace(text[passwordEnd])
      ) {
        passwordEnd += 1;
      }
      if (passwordEnd > passwordStart && text[passwordEnd] === "@") {
        spans.push({ start: passwordStart, end: passwordEnd });
      }
    }

    searchFrom = delimiter + 3;
  }

  return replaceSpans(text, spans, replacement);
}

function isWhitespace(character) {
  return character !== undefined && /\s/.test(character);
}

function structuredPrivateKeyValueStart(text, start) {
  if (text[start] !== '"' && text[start] !== "'") return -1;

  const rest = text.slice(start + 1, start + 12).toLowerCase();
  const keyName = ["private_key", "private-key", "privatekey"].find((name) =>
    rest.startsWith(name),
  );
  if (!keyName) return -1;

  let cursor = start + 1 + keyName.length;
  if (text[cursor] !== '"' && text[cursor] !== "'") return -1;
  cursor += 1;
  while (isWhitespace(text[cursor])) cursor += 1;
  if (text[cursor] !== ":") return -1;
  cursor += 1;
  while (isWhitespace(text[cursor])) cursor += 1;
  if (text[cursor] !== '"' && text[cursor] !== "'") return -1;
  return cursor + 1;
}

function redactStructuredPrivateKeys(text, replacement) {
  const spans = [];
  let cursor = 0;

  while (cursor < text.length) {
    const valueStart = structuredPrivateKeyValueStart(text, cursor);
    if (valueStart === -1) {
      cursor += 1;
      continue;
    }

    let valueEnd = valueStart;
    while (valueEnd < text.length) {
      if (text[valueEnd] === '"' || text[valueEnd] === "'") {
        let afterQuote = valueEnd + 1;
        while (isWhitespace(text[afterQuote])) afterQuote += 1;
        if (text[afterQuote] === "," || text[afterQuote] === "}") break;
      }
      valueEnd += 1;
    }

    if (valueEnd === text.length) break;
    spans.push({ start: valueStart, end: valueEnd });
    cursor = valueEnd + 1;
  }

  return replaceSpans(text, spans, replacement);
}

function isEmailLocalCharacter(character) {
  return character !== undefined && /[A-Za-z0-9._%+-]/.test(character);
}

function isEmailDomainCharacter(character) {
  return character !== undefined && /[A-Za-z0-9.-]/.test(character);
}

function redactEmails(text, replacement) {
  const spans = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const at = text.indexOf("@", searchFrom);
    if (at === -1) break;

    let localRunStart = at;
    while (localRunStart > 0 && isEmailLocalCharacter(text[localRunStart - 1])) {
      localRunStart -= 1;
    }

    let emailStart = -1;
    for (let index = localRunStart; index < at; index += 1) {
      if (isAsciiWord(text[index]) && (index === 0 || !isAsciiWord(text[index - 1]))) {
        emailStart = index;
        break;
      }
    }

    let domainEnd = at + 1;
    while (domainEnd < text.length && isEmailDomainCharacter(text[domainEnd])) {
      domainEnd += 1;
    }

    let emailEnd = -1;
    if (emailStart !== -1) {
      for (let dot = at + 2; dot < domainEnd; dot += 1) {
        if (text[dot] !== ".") continue;
        let tldEnd = dot + 1;
        while (tldEnd < domainEnd && isAsciiLetter(text[tldEnd])) tldEnd += 1;
        if (
          tldEnd - (dot + 1) >= 2 &&
          (tldEnd === text.length || !isAsciiWord(text[tldEnd]))
        ) {
          emailEnd = tldEnd;
        }
      }
    }

    if (emailEnd !== -1) {
      spans.push({ start: emailStart, end: emailEnd });
      searchFrom = emailEnd;
    } else {
      searchFrom = at + 1;
    }
  }

  return replaceSpans(text, spans, replacement);
}

function redactStep(state, pattern, replacement) {
  const result = replace(state.text, pattern, replacement);
  return mergeRedaction(state, result);
}

export function redactText(input, rawOptions = {}) {
  const options = optionsWithDefaults(rawOptions);
  let state = { text: String(input ?? ""), count: 0 };

  state = mergeRedaction(
    state,
    redactPrivateKeyBlocks(state.text, marker("PRIVATE_KEY", options)),
  );

  state = redactStep(
    state,
    /\b(?:sk-(?:(?:proj|svcacct|ant)-)?[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{20,}|(?:AKIA|ASIA)[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    marker("TOKEN", options),
  );

  state = mergeRedaction(
    state,
    redactJwtTokens(state.text, marker("JWT", options)),
  );

  state = redactStep(
    state,
    /(\b(?:Authorization\s*:\s*)?Bearer\s+)[A-Za-z0-9._~+\/-]{8,}={0,2}/gi,
    (_match, prefix) => `${prefix}${marker("BEARER_TOKEN", options)}`,
  );

  state = redactStep(
    state,
    /(\bAuthorization\s*:\s*Basic\s+)[A-Za-z0-9+/]{8,}={0,2}/gi,
    (_match, prefix) => `${prefix}${marker("BASIC_CREDENTIAL", options)}`,
  );

  state = mergeRedaction(
    state,
    redactConnectionPasswords(state.text, marker("PASSWORD", options)),
  );

  state = mergeRedaction(
    state,
    redactStructuredPrivateKeys(state.text, marker("PRIVATE_KEY", options)),
  );

  state = redactStep(
    state,
    /((?:["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key|password|passwd|secret|private[_-]?key|passcode)["']?)\s*[:=]\s*["']?)((?!\[REDACTED(?::[A-Z_]+)?\])[^&"'\s,;}\]]{6,})(["']?)/gi,
    (_match, prefix, _value, suffix) =>
      `${prefix}${marker("SECRET", options)}${suffix}`,
  );

  state = redactStep(
    state,
    /([?&](?:access_token|refresh_token|api[_-]?key|token|auth|signature|code|pwd|passcode)=)([^&#\s]+)/gi,
    (_match, prefix) => `${prefix}${encodeURIComponent(marker("URL_SECRET", options))}`,
  );

  if (options.redactFinancial) {
    state = redactStep(
      state,
      /\b(?:\d[ -]*?){13,19}\b/g,
      (value) => (luhnValid(value) ? marker("PAYMENT_CARD", options) : value),
    );

    state = redactStep(
      state,
      /((?:available[ \t]+balance|current[ \t]+balance|account[ \t]+balance|balance|口座残高|利用可能額|利用可能残高|残高|可用余额|账户余额|帳戶餘額|余额|餘額)[ \t]*[:：]?[ \t]*)(?:(?:[¥￥$€£]|JPY|USD|EUR|GBP|CNY)[ \t]*)?-?\d[\d,]*(?:\.\d{1,2})?[ \t]*(?:JPY|USD|EUR|GBP|CNY|円|元)?/giu,
      (_match, prefix) => `${prefix}${marker("BALANCE", options)}`,
    );

    state = redactStep(
      state,
      /((?:account(?:[ \t]+(?:number|no\.?))?|acct(?:[ \t]+no\.?)?|bank[ \t]+account|口座番号|口座|账号|賬號|帐号)[ \t]*[:：#]?[ \t]*)(?:[A-Z]{2}\d{2}(?:[A-Z0-9 ]{8,28}[A-Z0-9])|\d(?:[\d* -]{2,28}[\d*])|[A-Z0-9]{6,34})/giu,
      (_match, prefix) => `${prefix}${marker("ACCOUNT", options)}`,
    );
  }

  if (options.redactEmails) {
    state = mergeRedaction(
      state,
      redactEmails(state.text, marker("EMAIL", options)),
    );
  }

  if (options.redactPhones) {
    state = redactStep(
      state,
      /(?:^|[^\w])((?:\+\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]){2,4}\d{3,4})(?=$|[^\w])/g,
      (whole, phone) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10 || digits.length > 15) return whole;
        const prefixLength = whole.length - phone.length;
        return `${whole.slice(0, prefixLength)}${marker("PHONE", options)}`;
      },
    );
  }

  if (options.redactIpAddresses) {
    state = redactStep(
      state,
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      (value) => (validIpv4(value) ? marker("IP_ADDRESS", options) : value),
    );
  }

  return state;
}

export { DEFAULT_OPTIONS, luhnValid, validIpv4 };
