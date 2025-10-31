// Basic reusable validators for forms

export const validateRequired = (value) => {
  return typeof value === 'string' ? value.trim().length > 0 : !!value
}

export const validateEmail = (value) => {
  if (!validateRequired(value)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())
}

export const validatePhone = (value) => {
  if (!value) return true // optional by default
  return /^(\+)?\d{9,11}$/.test(String(value).trim())
}

export const validateMinLength = (value, min) => {
  if (!validateRequired(value)) return false
  return String(value).trim().length >= min
}

export const validatePassword = (value, { minLength = 6 } = {}) => {
  return validateMinLength(value, minLength)
}

export const validateFullName = (value) => {
  return validateMinLength(value, 2)
}

export const buildErrors = (fields) => {
  // fields: Array of { key, valid, message }
  const errors = {}
  for (const f of fields) {
    if (!f.valid) errors[f.key] = f.message
  }
  return errors
}

// ===== App-specific helpers with toast =====
// Lưu ý: truyền vào đối tượng toast từ hook useToast() khi sử dụng

export const validateNonEmpty = (value, label, toast) => {
  const ok = validateRequired(value)
  if (!ok && toast) {
    toast.warning(`Thiếu thông tin ${label}`, {
      description: `Vui lòng nhập ${label}`
    })
  }
  return ok
}

export const validateObjectiveSelected = (objective, toast) => {
  const allowed = [
    'AWARENESS',
    'TRAFFIC',
    'ENGAGEMENT',
    'LEADS',
    'APP_PROMOTION',
    'SALES',
  ]
  const ok = allowed.includes(objective)
  if (!ok && toast) {
    toast.warning('Chưa chọn mục tiêu chiến dịch', {
      description: 'Vui lòng chọn một mục tiêu trước khi tiếp tục'
    })
  }
  return ok
}

export const validateCampaignStep = (campaign, toast) => {
  if (!campaign) {
    if (toast) toast.warning('Thiếu dữ liệu chiến dịch')
    return false
  }
  const nameOk = validateNonEmpty(campaign.name, 'tên chiến dịch', toast)
  const pageOk = !!campaign.facebookPageId
  if (!pageOk && toast) {
    toast.warning('Chưa chọn Trang Facebook', {
      description: 'Vui lòng chọn Trang Facebook cho chiến dịch'
    })
  }
  return nameOk && pageOk
}


// ===== Datetime helpers for adset scheduling =====
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const getOneDayAfter = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + ONE_DAY_MS).toISOString();
};

export const toInputDateTimeLocal = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}`;
};

export const isEndAtLeastOneDayAfterStart = (startIso, endIso) => {
  if (!startIso || !endIso) return true; // let other validators handle nulls
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return true;
  return e.getTime() >= s.getTime() + ONE_DAY_MS;
};

export const ensureEndAfterStartPlusOneDay = (startIso, endIso) => {
  if (!startIso) return endIso || null;
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return endIso || null;
  const minEnd = new Date(s.getTime() + ONE_DAY_MS).toISOString();
  if (!endIso) return minEnd;
  const e = new Date(endIso);
  if (Number.isNaN(e.getTime())) return minEnd;
  return e.getTime() < s.getTime() + ONE_DAY_MS ? minEnd : endIso;
};


