/**
 * STRICT Indian Mobile Number Normalization Module
 * 
 * Rules:
 * - Allow ONLY Indian numbers
 * - Output format: 91XXXXXXXXXX (12 digits)
 * - Remove non-digits, leading zeros, + prefix
 * - Regex Validation: ^91[6-9][0-9]{9}$
 */

const normalizeMobile = (rawMobile) => {
    if (!rawMobile) return { valid: false, reason: 'Empty value' };

    // 1. Convert to string and basic cleanup (remove spaces, dashes, +, (), special chars)
    let clean = String(rawMobile).replace(/[^0-9]/g, '');

    // 2. Handle known prefixes / lengths
    // Goal: Get to 10 digits to prepend 91, or check if it is already 12 digits starting with 91

    // Case A: 10 digits (Standard local format) -> Prepend 91
    if (clean.length === 10) {
        clean = '91' + clean;
    }
    // Case B: 11 digits starting with 0 (Landline style or old mobile format) -> Replace 0 with 91
    else if (clean.length === 11 && clean.startsWith('0')) {
        clean = '91' + clean.substring(1);
    }
    // Case C: 12 digits starting with 91 (Already valid country code) -> Keep as is
    else if (clean.length === 12 && clean.startsWith('91')) {
        // clean remains same
    }
    // Case D: Anything else -> Invalid length or format
    else {
        return { valid: false, reason: 'Invalid length or format', original: rawMobile };
    }

    // 3. Strict Regex Validation for Indian Mobile Numbers
    // ^91   : Starts with 91
    // [6-9] : Mobile numbers start with 6, 7, 8, or 9
    // [0-9]{9} : Followed by 9 digits
    const indianMobileRegex = /^91[6-9][0-9]{9}$/;

    if (!indianMobileRegex.test(clean)) {
        return { valid: false, reason: 'Invalid Indian mobile pattern', original: rawMobile };
    }

    return { valid: true, mobile: clean };
};

module.exports = { normalizeMobile };
