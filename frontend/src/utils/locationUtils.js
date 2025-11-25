// Utility functions để convert giữa country names và country codes
import { getCode, getName } from "country-list";

/**
 * Convert country names array to country codes array
 * @param {string[]} countryNames - Array of country names (e.g., ["Vietnam", "United States"])
 * @returns {string[]} Array of country codes (e.g., ["VN", "US"])
 */
export function convertCountryNamesToCodes(countryNames) {
  if (!countryNames || !Array.isArray(countryNames) || countryNames.length === 0) {
    return ["VN"];
  }

  const countryCodes = countryNames
    .map((name) => {
      try {
        const code = getCode(name);
        if (code) return code.toUpperCase();
      } catch {
        return null;
      }
      return manualCountryNameToCode(name);
    })
    .filter((code) => code !== null);

  return countryCodes.length > 0 ? countryCodes : ["VN"];
}

function manualCountryNameToCode(countryName) {
  const COUNTRY_NAME_TO_CODE = {
    "Viet Nam": "VN", "Vietnam": "VN",
    "United States": "US", "United States of America": "US", "USA": "US",
    "United Kingdom": "GB", "UK": "GB",
    "Japan": "JP", "China": "CN",
    "South Korea": "KR", "Korea": "KR",
    "Thailand": "TH", "Singapore": "SG",
    "Malaysia": "MY", "Indonesia": "ID",
    "Philippines": "PH", "Australia": "AU",
    "New Zealand": "NZ", "Canada": "CA",
    "Germany": "DE", "France": "FR",
    "Italy": "IT", "Spain": "ES",
    "Netherlands": "NL", "Belgium": "BE",
    "Switzerland": "CH", "Austria": "AT",
    "Sweden": "SE", "Norway": "NO",
    "Denmark": "DK", "Finland": "FI",
    "Poland": "PL", "Portugal": "PT",
    "Greece": "GR", "Ireland": "IE",
    "India": "IN", "Brazil": "BR",
    "Mexico": "MX", "Argentina": "AR",
    "Chile": "CL", "Colombia": "CO",
    "Peru": "PE", "Turkey": "TR",
    "Russia": "RU", "Ukraine": "UA",
    "Saudi Arabia": "SA", "United Arab Emirates": "AE", "UAE": "AE",
    "Israel": "IL", "Egypt": "EG",
    "South Africa": "ZA", "Nigeria": "NG", "Kenya": "KE",
  };

  if (COUNTRY_NAME_TO_CODE[countryName]) {
    return COUNTRY_NAME_TO_CODE[countryName];
  }

  const normalizedName = countryName.trim();
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (name.toLowerCase() === normalizedName.toLowerCase()) {
      return code;
    }
  }

  return null;
}

/**
 * Convert country codes array to country names array
 * @param {string[]} countryCodes - Array of country codes (e.g., ["VN", "US"])
 * @returns {string[]} Array of country names (e.g., ["Vietnam", "United States"])
 */
export function convertCountryCodesToNames(countryCodes) {
  if (!countryCodes || !Array.isArray(countryCodes) || countryCodes.length === 0) {
    return ["Vietnam"];
  }

  const countryNames = countryCodes
    .map((code) => {
      try {
        const name = getName(code);
        if (name) return name;
      } catch {
        return null;
      }
      return manualCountryCodeToName(code);
    })
    .filter((name) => name !== null);

  return countryNames.length > 0 ? countryNames : ["Vietnam"];
}

function manualCountryCodeToName(countryCode) {
  const COUNTRY_CODE_TO_NAME = {
    "VN": "Vietnam", "US": "United States", "GB": "United Kingdom",
    "JP": "Japan", "CN": "China", "KR": "South Korea",
    "TH": "Thailand", "SG": "Singapore", "MY": "Malaysia",
    "ID": "Indonesia", "PH": "Philippines", "AU": "Australia",
    "NZ": "New Zealand", "CA": "Canada", "DE": "Germany",
    "FR": "France", "IT": "Italy", "ES": "Spain",
    "NL": "Netherlands", "BE": "Belgium", "CH": "Switzerland",
    "AT": "Austria", "SE": "Sweden", "NO": "Norway",
    "DK": "Denmark", "FI": "Finland", "PL": "Poland",
    "PT": "Portugal", "GR": "Greece", "IE": "Ireland",
    "IN": "India", "BR": "Brazil", "MX": "Mexico",
    "AR": "Argentina", "CL": "Chile", "CO": "Colombia",
    "PE": "Peru", "TR": "Turkey", "RU": "Russia",
    "UA": "Ukraine", "SA": "Saudi Arabia", "AE": "United Arab Emirates",
    "IL": "Israel", "EG": "Egypt", "ZA": "South Africa",
    "NG": "Nigeria", "KE": "Kenya",
  };

  return COUNTRY_CODE_TO_NAME[countryCode.toUpperCase()] || null;
}

/**
 * Convert language code to Facebook locale ID
 * Mapping chuẩn theo Facebook Marketing API (từ endpoint type=adlocale)
 * Dựa trên tài liệu: https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search/
 * @param {string} languageCode - Language code (e.g., "vi", "en", "zh")
 * @returns {number|null} Facebook locale ID or null
 */
export function convertLanguageCodeToLocaleId(languageCode) {
  if (!languageCode || languageCode === "all") {
    return null;
  }

  // Mapping chuẩn theo Facebook Ads API
  // Key = locale ID trả về từ Graph API khi query type=adlocale
  const LANGUAGE_TO_LOCALE_ID = {
    "ar": 1,       // ar_AR - Arabic
    "cs": 2,       // cs_CZ - Czech  
    "da": 3,       // da_DK - Danish
    "de": 4,       // de_DE - German
    "el": 5,       // el_GR - Greek
    "en": 6,       // en_US - English (US)
    "en-US": 6,    // en_US - English (US)
    "es": 7,       // es_ES - Spanish (Spain)
    "es-ES": 7,    // es_ES - Spanish (Spain)
    "es-LA": 8,    // es_LA - Spanish (Latin America)
    "fi": 9,       // fi_FI - Finnish
    "fr": 10,      // fr_FR - French (France)
    "he": 11,      // he_IL - Hebrew
    "hi": 12,      // hi_IN - Hindi
    "hu": 13,      // hu_HU - Hungarian
    "id": 14,      // id_ID - Indonesian
    "it": 15,      // it_IT - Italian
    "ja": 16,      // ja_JP - Japanese
    "ko": 17,      // ko_KR - Korean
    "nb": 18,      // nb_NO - Norwegian (Bokmål)
    "no": 18,      // nb_NO - Norwegian
    "nl": 19,      // nl_NL - Dutch
    "pl": 20,      // pl_PL - Polish
    "pt": 21,      // pt_PT - Portuguese (Portugal)
    "pt-PT": 21,   // pt_PT - Portuguese (Portugal)
    "pt-BR": 22,   // pt_BR - Portuguese (Brazil)
    "ro": 23,      // ro_RO - Romanian
    "en-GB": 24,   // en_GB - English (UK)
    "ru": 25,      // ru_RU - Russian
    "sv": 26,      // sv_SE - Swedish
    "th": 27,      // th_TH - Thai
    "tr": 28,      // tr_TR - Turkish
    "vi": 29,      // vi_VN - Vietnamese
    "zh": 30,      // zh_CN - Chinese (Simplified)
    "zh-CN": 30,   // zh_CN - Chinese (Simplified)
    "zh-HK": 31,   // zh_HK - Chinese (Hong Kong)
    "zh-TW": 32,   // zh_TW - Chinese (Traditional)
    "af": 33,      // af_ZA - Afrikaans
    "sq": 34,      // sq_AL - Albanian
    "hy": 35,      // hy_AM - Armenian
    "az": 36,      // az_AZ - Azerbaijani
    "be": 37,      // be_BY - Belarusian
    "bn": 38,      // bn_IN - Bengali
    "bs": 39,      // bs_BA - Bosnian
    "bg": 40,      // bg_BG - Bulgarian
    "ca": 41,      // ca_ES - Catalan
    "hr": 42,      // hr_HR - Croatian
    "et": 43,      // et_EE - Estonian
    "tl": 44,      // tl_PH - Filipino
    "fr-CA": 45,   // fr_CA - French (Canada)
    "ka": 46,      // ka_GE - Georgian
    "gu": 47,      // gu_IN - Gujarati
    "is": 48,      // is_IS - Icelandic
    "kn": 49,      // kn_IN - Kannada
    "kk": 50,      // kk_KZ - Kazakh
    "km": 51,      // km_KH - Khmer
    "lv": 52,      // lv_LV - Latvian
    "lt": 53,      // lt_LT - Lithuanian
    "mk": 54,      // mk_MK - Macedonian
    "ms": 55,      // ms_MY - Malay
    "ml": 56,      // ml_IN - Malayalam
    "mr": 57,      // mr_IN - Marathi
    "mn": 58,      // mn_MN - Mongolian
    "ne": 59,      // ne_NP - Nepali
    "pa": 60,      // pa_IN - Punjabi
    "sr": 61,      // sr_RS - Serbian
    "sk": 62,      // sk_SK - Slovak
    "sl": 63,      // sl_SI - Slovenian
    "sw": 64,      // sw_KE - Swahili
    "ta": 65,      // ta_IN - Tamil
    "te": 66,      // te_IN - Telugu
    "uk": 67,      // uk_UA - Ukrainian
    "ur": 68,      // ur_PK - Urdu
    "uz": 69,      // uz_UZ - Uzbek
    "es-MX": 70,   // es_MX - Spanish (Mexico)
    "es-AR": 71,   // es_AR - Spanish (Argentina)
  };

  return LANGUAGE_TO_LOCALE_ID[languageCode] || null;
}

/**
 * Convert Facebook locale ID to language code (reverse mapping)
 * @param {number} localeId - Facebook locale ID
 * @returns {string|null} Language code or null
 */
export function convertLocaleIdToLanguageCode(localeId) {
  if (!localeId || typeof localeId !== "number") {
    return null;
  }

  // Reverse mapping: locale ID → language code
  const LOCALE_ID_TO_LANGUAGE = {
    1: "ar",      // Arabic
    2: "cs",      // Czech
    3: "da",      // Danish
    4: "de",      // German
    5: "el",      // Greek
    6: "en-US",   // English (US)
    7: "es-ES",   // Spanish (Spain)
    8: "es-LA",   // Spanish (Latin America)
    9: "fi",      // Finnish
    10: "fr",     // French
    11: "he",     // Hebrew
    12: "hi",     // Hindi
    13: "hu",     // Hungarian
    14: "id",     // Indonesian
    15: "it",     // Italian
    16: "ja",     // Japanese
    17: "ko",     // Korean
    18: "nb",     // Norwegian
    19: "nl",     // Dutch
    20: "pl",     // Polish
    21: "pt",     // Portuguese (Portugal)
    22: "pt-BR",  // Portuguese (Brazil)
    23: "ro",     // Romanian
    24: "en-GB",  // English (UK)
    25: "ru",     // Russian
    26: "sv",     // Swedish
    27: "th",     // Thai
    28: "tr",     // Turkish
    29: "vi",     // Vietnamese
    30: "zh-CN",  // Chinese (Simplified)
    31: "zh-HK",  // Chinese (Hong Kong)
    32: "zh-TW",  // Chinese (Traditional)
    33: "af",     // Afrikaans
    34: "sq",     // Albanian
    35: "hy",     // Armenian
    36: "az",     // Azerbaijani
    37: "be",     // Belarusian
    38: "bn",     // Bengali
    39: "bs",     // Bosnian
    40: "bg",     // Bulgarian
    41: "ca",     // Catalan
    42: "hr",     // Croatian
    43: "et",     // Estonian
    44: "tl",     // Filipino
    45: "fr-CA",  // French (Canada)
    46: "ka",     // Georgian
    47: "gu",     // Gujarati
    48: "is",     // Icelandic
    49: "kn",     // Kannada
    50: "kk",     // Kazakh
    51: "km",     // Khmer
    52: "lv",     // Latvian
    53: "lt",     // Lithuanian
    54: "mk",     // Macedonian
    55: "ms",     // Malay
    56: "ml",     // Malayalam
    57: "mr",     // Marathi
    58: "mn",     // Mongolian
    59: "ne",     // Nepali
    60: "pa",     // Punjabi
    61: "sr",     // Serbian
    62: "sk",     // Slovak
    63: "sl",     // Slovenian
    64: "sw",     // Swahili
    65: "ta",     // Tamil
    66: "te",     // Telugu
    67: "uk",     // Ukrainian
    68: "ur",     // Urdu
    69: "uz",     // Uzbek
    70: "es-MX",  // Spanish (Mexico)
    71: "es-AR",  // Spanish (Argentina)
  };

  return LOCALE_ID_TO_LANGUAGE[localeId]
}