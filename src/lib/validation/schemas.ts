export interface FormErrors {
  nurseryName?: string;
  ownerName?: string;
  ownerMobile?: string;
  latitude?: string;
  longitude?: string;
  accuracy?: string;
  seedlings?: string;
}

/**
 * Bounds of Bangladesh: 
 * Latitude: 20.59° N to 26.63° N
 * Longitude: 88.01° E to 92.67° E
 */
export function validateBangladeshCoords(lat: number, lng: number): boolean {
  return lat >= 20.3 && lat <= 26.8 && lng >= 87.8 && lng <= 92.9;
}

/**
 * Validates Bangladeshi mobile number formats (+8801... or 01...)
 */
export function validateBDMobile(mobile: string): boolean {
  const clean = mobile.replace(/[\s-]/g, '');
  const pattern = /^(?:\+?88)?01[3-9]\d{8}$/;
  return pattern.test(clean);
}

/**
 * Full submission form validator
 */
export function validatePlantationSubmission(data: {
  nurseryName: string;
  ownerName: string;
  ownerMobile: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  hasSeedlings: boolean;
}): { isValid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};

  if (!data.nurseryName || data.nurseryName.trim().length < 3) {
    errors.nurseryName = 'নার্সারির নাম অন্তত ৩ অক্ষরের হতে হবে (Nursery name must be at least 3 chars)';
  }

  if (!data.ownerName || data.ownerName.trim().length < 3) {
    errors.ownerName = 'মালিকের নাম অন্তত ৩ অক্ষরের হতে হবে (Owner name must be at least 3 chars)';
  }

  if (!validateBDMobile(data.ownerMobile)) {
    errors.ownerMobile = 'সঠিক বাংলাদেশী মোবাইল নম্বর দিন (e.g. 017xxxxxxxx)';
  }

  if (isNaN(data.latitude) || isNaN(data.longitude)) {
    errors.latitude = 'সঠিক অক্ষাংশ ও দ্রাঘিমাংশ প্রদান করুন (Provide valid GPS coordinates)';
  } else if (!validateBangladeshCoords(data.latitude, data.longitude)) {
    errors.latitude = 'স্থানাঙ্কটি বাংলাদেশের ভৌগোলিক সীমানার বাইরে! (Coordinates are outside Bangladesh)';
  }

  if (isNaN(data.accuracy) || data.accuracy > 100) {
    errors.accuracy = 'জিপিএস অ্যাকুরেসি দুর্বল (>১০০মি)। ভালো সিগন্যালের জন্য খোলা জায়গায় যান।';
  }

  if (!data.hasSeedlings) {
    errors.seedlings = 'অন্তত একটি চারার তালিকা ও পরিমাণ যুক্ত করুন (Add at least one seedling entry)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
