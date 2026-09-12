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

function redactStep(state, pattern, replacement) {
  const result = replace(state.text, pattern, replacement);
  return { text: result.text, count: state.count + result.count };
}

export function redactText(input, rawOptions = {}) {
  const options = optionsWithDefaults(rawOptions);
  let state = { text: String(input ?? ""), count: 0 };

  state = redactStep(
    state,
    /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/g,
    marker("PRIVATE_KEY", options),
  );

  state = redactStep(
    state,
    /\b(?:sk-(?:(?:proj|svcacct|ant)-)?[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{20,}|(?:AKIA|ASIA)[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    marker("TOKEN", options),
  );

  state = redactStep(
    state,
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    marker("JWT", options),
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

  state = redactStep(
    state,
    /(\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:)([^@\s/]+)(@)/gi,
    (_match, prefix, _password, suffix) =>
      `${prefix}${marker("PASSWORD", options)}${suffix}`,
  );

  state = redactStep(
    state,
    /(["']private[_-]?key["']\s*:\s*["'])([\s\S]*?)(["'](?=\s*[,}]))/gi,
    (_match, prefix, _value, suffix) =>
      `${prefix}${marker("PRIVATE_KEY", options)}${suffix}`,
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
    state = redactStep(
      state,
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      marker("EMAIL", options),
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
