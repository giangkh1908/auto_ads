// Utility functions để convert giữa country names và country codes
import { getCode, getNames } from "country-list";

/**
 * Convert country names array to country codes array
 * @param {string[]} countryNames - Array of country names (e.g., ["Viet Nam", "United States"])
 * @returns {string[]} Array of country codes (e.g., ["VN", "US"])
 */
export function convertCountryNamesToCodes(countryNames) {
  if (!countryNames || !Array.isArray(countryNames) || countryNames.length === 0) {
    return ["VN"]; // Default fallback
  }

  const countryCodes = countryNames
    .map((name) => {
      // Try to get code using country-list package
      try {
        const code = getCode(name);
        if (code) return code;
      } catch {
        // getCode might throw error for invalid country name
      }
      
      // Fallback: manual mapping for common cases
      return manualCountryNameToCode(name);
    })
    .filter((code) => code !== null); // Remove null values

  // Return codes or default to ["VN"]
  return countryCodes.length > 0 ? countryCodes : ["VN"];
}

/**
 * Manual mapping for country names to codes (fallback)
 * @param {string} countryName - Country name
 * @returns {string|null} Country code or null
 */
function manualCountryNameToCode(countryName) {
  const COUNTRY_NAME_TO_CODE = {
    "Viet Nam": "VN",
    "Vietnam": "VN",
    "United States": "US",
    "United States of America": "US",
    "USA": "US",
    "United Kingdom": "GB",
    "UK": "GB",
    "Japan": "JP",
    "China": "CN",
    "South Korea": "KR",
    "Korea": "KR",
    "Thailand": "TH",
    "Singapore": "SG",
    "Malaysia": "MY",
    "Indonesia": "ID",
    "Philippines": "PH",
    "Australia": "AU",
    "New Zealand": "NZ",
    "Canada": "CA",
    "Germany": "DE",
    "France": "FR",
    "Italy": "IT",
    "Spain": "ES",
    "Netherlands": "NL",
    "Belgium": "BE",
    "Switzerland": "CH",
    "Austria": "AT",
    "Sweden": "SE",
    "Norway": "NO",
    "Denmark": "DK",
    "Finland": "FI",
    "Poland": "PL",
    "Portugal": "PT",
    "Greece": "GR",
    "Ireland": "IE",
    "India": "IN",
    "Brazil": "BR",
    "Mexico": "MX",
    "Argentina": "AR",
    "Chile": "CL",
    "Colombia": "CO",
    "Peru": "PE",
    "Turkey": "TR",
    "Russia": "RU",
    "Ukraine": "UA",
    "Saudi Arabia": "SA",
    "United Arab Emirates": "AE",
    "Israel": "IL",
    "Egypt": "EG",
    "South Africa": "ZA",
    "Nigeria": "NG",
    "Kenya": "KE",
  };

  // Try exact match first
  if (COUNTRY_NAME_TO_CODE[countryName]) {
    return COUNTRY_NAME_TO_CODE[countryName];
  }

  // Try case-insensitive match
  const normalizedName = countryName.trim();
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (name.toLowerCase() === normalizedName.toLowerCase()) {
      return code;
    }
  }

  return null;
}

/**
 * Convert country codes array to country names array (for displaying in UI)
 * @param {string[]} countryCodes - Array of country codes (e.g., ["VN", "US"])
 * @returns {string[]} Array of country names (e.g., ["Viet Nam", "United States"])
 */
export function convertCountryCodesToNames(countryCodes) {
  if (!countryCodes || !Array.isArray(countryCodes) || countryCodes.length === 0) {
    return ["Viet Nam"]; // Default fallback
  }

  try {
    const countryNamesMap = getNames();
    
    // Build reverse map (code -> name) from country-list
    // Note: country-list's getNames() returns { code: name }, we need reverse
    const codeToNameMap = {};
    // We need to iterate through all codes to find matching names
    // Since getCode() works, we can use it to validate and getNames() to map back
    Object.entries(countryNamesMap).forEach(([code, name]) => {
      codeToNameMap[code] = name;
    });

    const countryNames = countryCodes
      .map((code) => {
        // Try to get name from reverse map
        const name = codeToNameMap[code];
        if (name) return name;
        
        // Fallback: manual mapping
        return manualCountryCodeToName(code);
      })
      .filter((name) => name !== null);

    return countryNames.length > 0 ? countryNames : ["Viet Nam"];
  } catch {
    // If getNames fails, use manual mapping only
    const countryNames = countryCodes
      .map((code) => manualCountryCodeToName(code))
      .filter((name) => name !== null);

    return countryNames.length > 0 ? countryNames : ["Viet Nam"];
  }
}

/**
 * Manual mapping for country codes to names (fallback)
 * @param {string} countryCode - Country code
 * @returns {string|null} Country name or null
 */
function manualCountryCodeToName(countryCode) {
  const COUNTRY_CODE_TO_NAME = {
    "VN": "Viet Nam",
    "US": "United States",
    "GB": "United Kingdom",
    "JP": "Japan",
    "CN": "China",
    "KR": "South Korea",
    "TH": "Thailand",
    "SG": "Singapore",
    "MY": "Malaysia",
    "ID": "Indonesia",
    "PH": "Philippines",
    "AU": "Australia",
    "NZ": "New Zealand",
    "CA": "Canada",
    "DE": "Germany",
    "FR": "France",
    "IT": "Italy",
    "ES": "Spain",
    "NL": "Netherlands",
    "BE": "Belgium",
    "CH": "Switzerland",
    "AT": "Austria",
    "SE": "Sweden",
    "NO": "Norway",
    "DK": "Denmark",
    "FI": "Finland",
    "PL": "Poland",
    "PT": "Portugal",
    "GR": "Greece",
    "IE": "Ireland",
    "IN": "India",
    "BR": "Brazil",
    "MX": "Mexico",
    "AR": "Argentina",
    "CL": "Chile",
    "CO": "Colombia",
    "PE": "Peru",
    "TR": "Turkey",
    "RU": "Russia",
    "UA": "Ukraine",
    "SA": "Saudi Arabia",
    "AE": "United Arab Emirates",
    "IL": "Israel",
    "EG": "Egypt",
    "ZA": "South Africa",
    "NG": "Nigeria",
    "KE": "Kenya",
  };

  return COUNTRY_CODE_TO_NAME[countryCode] || null;
}

/**
 * Convert language code to Facebook locale ID
 * Facebook API requires locale IDs as numbers, not language codes
 * @param {string} languageCode - Language code (e.g., "vi", "en", "zh")
 * @returns {number|null} Facebook locale ID or null
 */
export function convertLanguageCodeToLocaleId(languageCode) {
  if (!languageCode || languageCode === "all") {
    return null;
  }

  // Facebook locale ID mapping (based on Facebook API documentation)
  const LANGUAGE_TO_LOCALE_ID = {
    "vi": 6,      // Vietnamese
    "en": 28,     // English (US)
    "zh": 7,      // Chinese (Simplified)
    "zh-CN": 7,   // Chinese (Simplified) - alternative
    "zh-TW": 8,   // Chinese (Traditional)
    "ja": 25,     // Japanese
    "ko": 19,     // Korean
    "fr": 16,     // French
    "de": 15,     // German
    "es": 13,     // Spanish
    "ru": 26,     // Russian
    "th": 30,     // Thai
    "id": 20,     // Indonesian
    "ms": 24,     // Malay
    "hi": 21,     // Hindi
    "pt": 27,     // Portuguese
    "pt-BR": 27,  // Portuguese (Brazil)
    "it": 22,     // Italian
    "ar": 1,      // Arabic
    "nl": 23,     // Dutch
    "pl": 29,     // Polish
    "tr": 31,     // Turkish
    "sv": 32,     // Swedish
    "da": 14,     // Danish
    "no": 33,     // Norwegian
    "fi": 17,     // Finnish
    "cs": 9,      // Czech
    "hu": 34,     // Hungarian
    "ro": 35,     // Romanian
    "el": 18,     // Greek
    "he": 36,     // Hebrew
    "uk": 37,     // Ukrainian
    "sk": 38,     // Slovak
    "hr": 39,     // Croatian
    "bg": 40,     // Bulgarian
    "sr": 41,     // Serbian
    "sl": 42,     // Slovenian
    "lt": 43,     // Lithuanian
    "lv": 44,     // Latvian
    "et": 45,     // Estonian
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
    6: "vi",      // Vietnamese
    28: "en",     // English (US)
    7: "zh",      // Chinese (Simplified)
    8: "zh-TW",   // Chinese (Traditional)
    25: "ja",     // Japanese
    19: "ko",     // Korean
    16: "fr",     // French
    15: "de",     // German
    13: "es",     // Spanish
    26: "ru",     // Russian
    30: "th",     // Thai
    20: "id",     // Indonesian
    24: "ms",     // Malay
    21: "hi",     // Hindi
    27: "pt",     // Portuguese
    22: "it",     // Italian
    1: "ar",      // Arabic
    23: "nl",     // Dutch
    29: "pl",     // Polish
    31: "tr",     // Turkish
    32: "sv",     // Swedish
    14: "da",     // Danish
    33: "no",     // Norwegian
    17: "fi",     // Finnish
    9: "cs",      // Czech
    34: "hu",     // Hungarian
    35: "ro",     // Romanian
    18: "el",     // Greek
    36: "he",     // Hebrew
    37: "uk",     // Ukrainian
    38: "sk",     // Slovak
    39: "hr",     // Croatian
    40: "bg",     // Bulgarian
    41: "sr",     // Serbian
    42: "sl",     // Slovenian
    43: "lt",     // Lithuanian
    44: "lv",     // Latvian
    45: "et",     // Estonian
  };

  return LOCALE_ID_TO_LANGUAGE[localeId] || null;
}

