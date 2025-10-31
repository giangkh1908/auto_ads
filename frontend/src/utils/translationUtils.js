/**
 * Translation utilities - tích hợp với i18next
 * Chuyển đổi và format các giá trị Facebook Ads
 */

import i18n from '../i18n';

/**
 * Chuyển đổi objective sang ngôn ngữ hiện tại
 * @param {string} objective - Facebook objective value
 * @returns {string} Translated label
 */
export const translateObjective = (objective) => {
  if (!objective) return i18n.t('ads:labels.not_set');
  return i18n.t(`ads:objectives.${objective}`, { defaultValue: objective });
};

/**
 * Chuyển đổi optimization goal sang ngôn ngữ hiện tại
 * @param {string} goal - Optimization goal value
 * @returns {string} Translated label
 */
export const translateOptimizationGoal = (goal) => {
  if (!goal) return '';
  return i18n.t(`ads:optimization_goals.${goal}`, { defaultValue: goal });
};

/**
 * Chuyển đổi giới tính sang ngôn ngữ hiện tại
 * @param {Array|number|string} genders - Gender array, number or string
 * @returns {string} Translated label
 */
export const translateGenders = (genders) => {
  if (!genders) return '';
  
  if (Array.isArray(genders)) {
    return genders
      .map(g => i18n.t(`ads:genders.${g}`, { defaultValue: String(g) }))
      .join(', ');
  }
  
  return i18n.t(`ads:genders.${genders}`, { defaultValue: String(genders) });
};

/**
 * Chuyển đổi quốc gia sang ngôn ngữ hiện tại
 * @param {Array} countries - Country codes array
 * @returns {string} Translated labels
 */
export const translateCountries = (countries) => {
  if (!countries || !Array.isArray(countries)) return '';
  
  return countries
    .map(c => i18n.t(`ads:countries.${c}`, { defaultValue: c }))
    .join(', ');
};

/**
 * Chuyển đổi status sang ngôn ngữ hiện tại
 * @param {string} status - Status value
 * @returns {string} Translated label
 */
export const translateStatus = (status) => {
  if (!status) return '';
  return i18n.t(`ads:status.${status}`, { defaultValue: status });
};

/**
 * Format targeting object thành array các dòng text theo ngôn ngữ hiện tại
 * @param {Object} targeting - Targeting object from adset
 * @returns {Array<string>|string} Array of formatted targeting info or fallback string
 */
export const formatTargetingVN = (targeting) => {
  if (!targeting || Object.keys(targeting).length === 0) {
    return i18n.t('ads:labels.not_set');
  }

  const parts = [];

  // Giới tính
  if (targeting.genders) {
    const genderLabel = i18n.t('ads:labels.gender', { defaultValue: 'Giới tính' });
    parts.push(`${genderLabel}: ${translateGenders(targeting.genders)}`);
  }

  // Độ tuổi
  if (targeting.age_min && targeting.age_max) {
    const ageLabel = i18n.t('ads:labels.age', { defaultValue: 'Tuổi' });
    parts.push(`${ageLabel}: ${targeting.age_min}-${targeting.age_max}`);
  }

  // Vị trí
  if (targeting.geo_locations?.countries) {
    const locationLabel = i18n.t('ads:labels.location', { defaultValue: 'Vị trí' });
    parts.push(`${locationLabel}: ${translateCountries(targeting.geo_locations.countries)}`);
  }

  // Ngôn ngữ
  if (targeting.languages && targeting.languages.length > 0) {
    const languageLabel = i18n.t('ads:labels.language', { defaultValue: 'Ngôn ngữ' });
    parts.push(`${languageLabel}: ${targeting.languages.join(', ')}`);
  }

  return parts.length > 0 ? parts : [i18n.t('ads:labels.not_set')];
};

/**
 * Format số tiền theo định dạng locale
 * @param {number} amount - Số tiền
 * @param {string} currency - Mã tiền tệ (VND, USD...)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'VND') => {
  if (!amount && amount !== 0) return '';
  
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format số lượng lớn (1000 -> 1K, 1000000 -> 1M)
 * @param {number} num - Số cần format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (absNum >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  
  return num.toString();
};