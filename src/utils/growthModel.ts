/**
 * Bangladesh Plantation Growth and Health Prognosis Model
 * Aligned with Bangladesh Forest Department (BFD) silvicultural growth patterns
 * and IPCC Tier 2 tropical region specifications.
 */

export interface SpeciesGrowthParam {
  bnName: string;
  enName: string;
  category: 'fruit' | 'forest' | 'medicinal';
  yearlyGrowthMeters: number; // Height increase in meters per year
  yearlyCanopyMeters: number; // Canopy radius increase in meters per year
  baseSurvivalRate: number; // Percentage
  waterPreference: 'high' | 'medium' | 'low';
  scientificName: string;
}

export const SPECIES_GROWTH_PARAMS: Record<string, SpeciesGrowthParam> = {
  // Forest species
  'শাল': {
    bnName: 'শাল',
    enName: 'Shal',
    category: 'forest',
    yearlyGrowthMeters: 0.9,
    yearlyCanopyMeters: 0.25,
    baseSurvivalRate: 85,
    waterPreference: 'medium',
    scientificName: 'Shorea robusta'
  },
  'গর্জন': {
    bnName: 'গর্জন',
    enName: 'Garjan',
    category: 'forest',
    yearlyGrowthMeters: 1.1,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 80,
    waterPreference: 'high',
    scientificName: 'Dipterocarpus turbinatus'
  },
  'সেগুন': {
    bnName: 'সেগুন',
    enName: 'Teak (Segun)',
    category: 'forest',
    yearlyGrowthMeters: 1.4,
    yearlyCanopyMeters: 0.35,
    baseSurvivalRate: 88,
    waterPreference: 'medium',
    scientificName: 'Tectona grandis'
  },
  'মেহগনি': {
    bnName: 'মেহগনি',
    enName: 'Mahogany (Mehgoni)',
    category: 'forest',
    yearlyGrowthMeters: 1.2,
    yearlyCanopyMeters: 0.4,
    baseSurvivalRate: 82,
    waterPreference: 'medium',
    scientificName: 'Swietenia macrophylla'
  },
  'ইউক্যালিপটাস': {
    bnName: 'ইউক্যালিপটাস',
    enName: 'Eucalyptus',
    category: 'forest',
    yearlyGrowthMeters: 2.1,
    yearlyCanopyMeters: 0.5,
    baseSurvivalRate: 92,
    waterPreference: 'low',
    scientificName: 'Eucalyptus globulus'
  },
  'কড়ই': {
    bnName: 'কড়ই',
    enName: 'Karat (Koroi)',
    category: 'forest',
    yearlyGrowthMeters: 1.0,
    yearlyCanopyMeters: 0.45,
    baseSurvivalRate: 86,
    waterPreference: 'medium',
    scientificName: 'Albizia lebbeck'
  },
  'গামার': {
    bnName: 'গামার',
    enName: 'Gamari (Gamar)',
    category: 'forest',
    yearlyGrowthMeters: 1.5,
    yearlyCanopyMeters: 0.35,
    baseSurvivalRate: 84,
    waterPreference: 'medium',
    scientificName: 'Gmelina arborea'
  },
  'বাবলা': {
    bnName: 'বাবলা',
    enName: 'Bablah',
    category: 'forest',
    yearlyGrowthMeters: 1.1,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 89,
    waterPreference: 'low',
    scientificName: 'Acacia nilotica'
  },

  // Fruit species
  'আম': {
    bnName: 'আম',
    enName: 'Mango (Am)',
    category: 'fruit',
    yearlyGrowthMeters: 0.8,
    yearlyCanopyMeters: 0.4,
    baseSurvivalRate: 90,
    waterPreference: 'medium',
    scientificName: 'Mangifera indica'
  },
  'কাঁঠাল': {
    bnName: 'কাঁঠাল',
    enName: 'Jackfruit (Kanthal)',
    category: 'fruit',
    yearlyGrowthMeters: 0.7,
    yearlyCanopyMeters: 0.35,
    baseSurvivalRate: 85,
    waterPreference: 'medium',
    scientificName: 'Artocarpus heterophyllus'
  },
  'জাম': {
    bnName: 'জাম',
    enName: 'Black Plum (Jam)',
    category: 'fruit',
    yearlyGrowthMeters: 1.0,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 87,
    waterPreference: 'high',
    scientificName: 'Syzygium cumini'
  },
  'লিচু': {
    bnName: 'লিচু',
    enName: 'Litchi',
    category: 'fruit',
    yearlyGrowthMeters: 0.6,
    yearlyCanopyMeters: 0.35,
    baseSurvivalRate: 83,
    waterPreference: 'medium',
    scientificName: 'Litchi chinensis'
  },
  'পেয়ারা': {
    bnName: 'পেয়ারা',
    enName: 'Guava (Peyara)',
    category: 'fruit',
    yearlyGrowthMeters: 0.7,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 91,
    waterPreference: 'medium',
    scientificName: 'Psidium guajava'
  },
  'নারকেল': {
    bnName: 'নারকেল',
    enName: 'Coconut (Narikel)',
    category: 'fruit',
    yearlyGrowthMeters: 0.5,
    yearlyCanopyMeters: 0.2,
    baseSurvivalRate: 93,
    waterPreference: 'high',
    scientificName: 'Cocos nucifera'
  },
  'সুপারি': {
    bnName: 'সুপারি',
    enName: 'Betel Nut (Supari)',
    category: 'fruit',
    yearlyGrowthMeters: 0.8,
    yearlyCanopyMeters: 0.1,
    baseSurvivalRate: 88,
    waterPreference: 'high',
    scientificName: 'Areca catechu'
  },

  // Medicinal species
  'নিম': {
    bnName: 'নিম',
    enName: 'Neem',
    category: 'medicinal',
    yearlyGrowthMeters: 1.2,
    yearlyCanopyMeters: 0.35,
    baseSurvivalRate: 94,
    waterPreference: 'low',
    scientificName: 'Azadirachta indica'
  },
  'অর্জুন': {
    bnName: 'অর্জুন',
    enName: 'Arjun',
    category: 'medicinal',
    yearlyGrowthMeters: 1.0,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 89,
    waterPreference: 'medium',
    scientificName: 'Terminalia arjuna'
  },
  'আমলকী': {
    bnName: 'আমলকী',
    enName: 'Amla (Amloki)',
    category: 'medicinal',
    yearlyGrowthMeters: 0.8,
    yearlyCanopyMeters: 0.25,
    baseSurvivalRate: 88,
    waterPreference: 'medium',
    scientificName: 'Phyllanthus emblica'
  },
  'হরিতকী': {
    bnName: 'হরিতকী',
    enName: 'Haritaki',
    category: 'medicinal',
    yearlyGrowthMeters: 0.7,
    yearlyCanopyMeters: 0.25,
    baseSurvivalRate: 86,
    waterPreference: 'medium',
    scientificName: 'Terminalia chebula'
  },
  'বহেরা': {
    bnName: 'বহেরা',
    enName: 'Bahera',
    category: 'medicinal',
    yearlyGrowthMeters: 0.8,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 85,
    waterPreference: 'medium',
    scientificName: 'Terminalia bellirica'
  }
};

export interface RegionalBenchmark {
  regionNameBn: string;
  regionNameEn: string;
  suitabilityScore: number; // 0 to 100
  expectedGrowthRateMultiplier: number;
  benchmarkGrowthMetersPerYear: number;
  soilTypeBn: string;
  soilTypeEn: string;
  limitingFactorBn: string;
  limitingFactorEn: string;
}

export interface HealthPrognosis {
  expectedHeightMeters: number;
  expectedCanopyRadiusMeters: number;
  survivalProbabilityPercent: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'critical';
  monthsElapsed: number;
  advisoryBn: string;
  advisoryEn: string;
  plantingSeasonBn: string;
  plantingSeasonEn: string;
  
  // New Regional Benchmark & Threshold Alerts fields
  regionalBenchmark: RegionalBenchmark;
  actualGrowthRateMetersPerYear: number;
  performanceIndexPercent: number;
  growthAlertLevel: 'optimal' | 'normal' | 'underperforming' | 'severely_underperforming';
  growthAlertMsgBn: string;
  growthAlertMsgEn: string;
}

/**
 * Retrieves regional silvicultural benchmarks based on Bangladesh districts/agro-ecological zones.
 */
export function getRegionalBenchmark(districtName: string, speciesName: string): RegionalBenchmark {
  const norm = (districtName || '').trim().toLowerCase();
  
  // Categorize region based on district name
  let zone: 'hills' | 'coastal' | 'barind' | 'floodplain' = 'floodplain';
  let regionNameBn = 'প্লাবনভূমি ও উর্বরা পলল সমভূমি';
  let regionNameEn = 'Floodplain Fertile Zone';
  let soilTypeBn = 'পলি ও দোঁয়াশ সমৃদ্ধ মাটি (উচ্চ উর্বরতা)';
  let soilTypeEn = 'Alluvial & Loamy Soil (High Fertility)';
  
  // Match districts (bilingual support)
  if (
    /sylhet|chittagong|bandarban|rangamati|khagrachari|cox|ctg|সিলেট|চট্টগ্রাম|বান্দরবান|রাঙ্গামাটি|খাগড়াছড়ি|কক্সবাজার/.test(norm)
  ) {
    zone = 'hills';
    regionNameBn = 'পার্বত্য ও পাহাড়ি বনাঞ্চল অঞ্চল';
    regionNameEn = 'Hill Tracts & Forest Zone';
    soilTypeBn = 'লাল অম্লীয় পাহাড়ি মৃত্তিকা ও কাঁকর';
    soilTypeEn = 'Acidic Hilly Clay Loam with Gravel';
  } else if (
    /khulna|satkhira|bagerhat|barisal|patuakhali|bhola|noakhali|feni|barguna|pirojpurn|খুলনা|সাতক্ষীরা|বাগেরহাট|বরিশাল|পটুয়াখালী|ভোলা|নোয়াখালী|ফেনী|বরগুনা|পিরোজপুর/.test(norm)
  ) {
    zone = 'coastal';
    regionNameBn = 'উপকূলীয় ও লবণাক্ত সুন্দরবন জোয়ার অঞ্চল';
    regionNameEn = 'Coastal & Saline Tide Zone';
    soilTypeBn = 'লবণাক্ত কাদামাটি ও পলিযুক্ত তটরেখা';
    soilTypeEn = 'Saline Silty Clay Shoreline Soil';
  } else if (
    /rajshahi|dinajpur|rangpur|bogra|naogaon|chapainawabganj|kurigram|gaibandha|লালমনিরহাট|কুড়িগ্রাম|গাইবান্ধা|রংপুর|দিনাজপুর|রাজশাহী|বগুড়া|নওগাঁ|চাঁপাইনবাবগঞ্জ/.test(norm)
  ) {
    zone = 'barind';
    regionNameBn = 'বরেন্দ্র ও শুষ্ক খরাপ্রবণ অঞ্চল';
    regionNameEn = 'Barind & Semi-Arid Drought Zone';
    soilTypeBn = 'অনুর্বর লাল শক্ত বরেন্দ্র এঁটেল মাটি';
    soilTypeEn = 'Clayey Hard Acidic Barind Tract Soil';
  }

  // Get species parameters
  const param = SPECIES_GROWTH_PARAMS[speciesName] || {
    yearlyGrowthMeters: 0.9,
    category: 'forest',
    waterPreference: 'medium'
  };

  // Suitability calculations
  let suitabilityScore = 85;
  let multiplier = 1.0;
  let limitingFactorBn = 'আগাছা দমন এবং যথাসময়ে সুষম জৈব সার প্রয়োগ করুন।';
  let limitingFactorEn = 'Perform timely weeding and apply organic compost.';

  if (zone === 'hills') {
    if (param.category === 'forest') {
      suitabilityScore = 96;
      multiplier = 1.18;
      limitingFactorBn = 'পাহাড়ি ঢালে ভারী বৃষ্টিতে পুষ্টি ধুয়ে যাওয়া ও ভূমিধস রোধে গোড়ায় মাটির বেষ্টনী দিন।';
      limitingFactorEn = 'Build semi-circular terraces on hill slopes to counter nutrient runoff.';
    } else if (speciesName === 'নিম' || speciesName === 'আমলকী') {
      suitabilityScore = 68;
      multiplier = 0.82;
      limitingFactorBn = 'মাটির অতিরিক্ত অম্লতা প্রশমিত করতে চারার গোড়ার মাটিতে অল্প ডলোমাইড চুন যোগ করুন।';
      limitingFactorEn = 'Incorporate agricultural lime/dolomite to neutralize hilly soil acidity.';
    } else {
      suitabilityScore = 82;
      multiplier = 0.96;
    }
  } else if (zone === 'coastal') {
    if (speciesName === 'নারকেল' || speciesName === 'সুপারি' || speciesName === 'কড়ই' || speciesName === 'গর্জন') {
      suitabilityScore = 98;
      multiplier = 1.22;
      limitingFactorBn = 'লবণাক্ত পরিবেশের সাথে দারুণ মানানসই। কোনো বিশেষ সারের প্রয়োজন নেই।';
      limitingFactorEn = 'Perfectly adapted to shoreline salinity. No complex corrective fertilizers needed.';
    } else if (param.category === 'fruit' && speciesName !== 'নারকেল' && speciesName !== 'সুপারি') {
      suitabilityScore = 52;
      multiplier = 0.62;
      limitingFactorBn = 'অতিরিক্ত লবণাক্ততায় চারা শুকিয়ে যেতে পারে। গোড়ায় শুষ্ক খড় বিছিয়ে পানি সেচ নিশ্চিত করুন।';
      limitingFactorEn = 'High salt stress damages root hairs. Elevate tree base and mulch with dry hay.';
    } else {
      suitabilityScore = 64;
      multiplier = 0.74;
      limitingFactorBn = 'উপকূলীয় জোয়ারের জলাবদ্ধতা থেকে চারা বাঁচাতে চারার চারপাশে মাটি উঁচু করে দিন।';
      limitingFactorEn = 'Construct raised soil mounds around seedlings to prevent tidal water inundation.';
    }
  } else if (zone === 'barind') {
    if (param.waterPreference === 'low') {
      suitabilityScore = 94;
      multiplier = 1.12;
      limitingFactorBn = 'অনুর্বর শক্ত মাটি ও খরা সহনশীলতা চমৎকার। আর্দ্রতা ধরে রাখতে নিয়মিত গোড়া হালকা নিড়ানি দিন।';
      limitingFactorEn = 'Superb drought resilience. Loosen soil crust gently to facilitate root aeration.';
    } else if (param.waterPreference === 'high') {
      suitabilityScore = 48;
      multiplier = 0.58;
      limitingFactorBn = 'গ্রীষ্মকালীন চরম পানি সংকট। প্রবৃদ্ধি বজায় রাখতে সপ্তাহে ৩ বার গভীর ড্রিপ সেচ দিন।';
      limitingFactorEn = 'Severe groundwater depletion. Apply direct root-zone irrigation 3x weekly.';
    } else {
      suitabilityScore = 74;
      multiplier = 0.82;
      limitingFactorBn = 'গ্রীষ্মের শুষ্কতা প্রবৃদ্ধি ধীর করে। তীব্র রোদে পাতা পোড়া রোধে খড় মালচিং করুন।';
      limitingFactorEn = 'Dry soil stunts growth. Apply protective dry straw mulch to lower ground temperature.';
    }
  } else {
    // Floodplain fertile zone
    if (param.category === 'fruit') {
      suitabilityScore = 96;
      multiplier = 1.12;
      limitingFactorBn = 'উর্বর পলি মাটিতে ফলের চারার সর্বোচ্চ বিকাশ। বর্ষার পূর্বে গোড়ায় কিছু কম্পোস্ট দিন।';
      limitingFactorEn = 'Peak growth in fertile alluvium. Apply organic compost before heavy rains.';
    } else if (speciesName === 'শাল' || speciesName === 'গর্জন') {
      suitabilityScore = 72;
      multiplier = 0.88;
      limitingFactorBn = 'সমতলে জলাবদ্ধতা এড়াতে চারার গোড়ায় ড্রেনেজ নালা তৈরি করুন।';
      limitingFactorEn = 'Sensitive to stagnant monsoon pools; clear pathways to drain excess rainfall.';
    }
  }

  const benchmarkGrowthMetersPerYear = parseFloat((param.yearlyGrowthMeters * multiplier).toFixed(3));

  return {
    regionNameBn,
    regionNameEn,
    suitabilityScore,
    expectedGrowthRateMultiplier: multiplier,
    benchmarkGrowthMetersPerYear,
    soilTypeBn,
    soilTypeEn,
    limitingFactorBn,
    limitingFactorEn
  };
}

/**
 * Calculates growth prognosis based on tree species, planting date, district, and initial state.
 */
export function calculateGrowthPrognosis(
  speciesName: string,
  plantingDateStr: string,
  districtName?: string,
  initialAgeMonths: number = 6 // Default average nursery seedling age
): HealthPrognosis {
  const param = SPECIES_GROWTH_PARAMS[speciesName] || {
    bnName: speciesName,
    enName: speciesName,
    category: 'forest',
    yearlyGrowthMeters: 0.9,
    yearlyCanopyMeters: 0.3,
    baseSurvivalRate: 85,
    waterPreference: 'medium',
    scientificName: 'Unknown species'
  };

  // Get regional benchmarks provided by AI analysis
  const regionalBenchmark = getRegionalBenchmark(districtName || '', speciesName);

  // Default current date is set to June 2026 (applet system date baseline)
  const currentDate = new Date('2026-06-29');
  const plantingDate = new Date(plantingDateStr);
  
  // Calculate months elapsed
  let monthsElapsed = (currentDate.getFullYear() - plantingDate.getFullYear()) * 12 + (currentDate.getMonth() - plantingDate.getMonth());
  if (monthsElapsed < 0) {
    monthsElapsed = 0;
  }

  const totalAgeYears = (initialAgeMonths + monthsElapsed) / 12;

  // Season of planting analysis to calculate survival adjustments
  const plantingMonth = plantingDate.getMonth(); // 0 = Jan, 11 = Dec
  let seasonMultiplier = 1.0;
  let plantingSeasonBn = '';
  let plantingSeasonEn = '';

  if (plantingMonth >= 5 && plantingMonth <= 7) {
    // June, July, August - Monsoon (বর্ষা)
    seasonMultiplier = 1.12; // Excellent water availability
    plantingSeasonBn = 'বর্ষা কাল (আদর্শ সময়)';
    plantingSeasonEn = 'Monsoon Season (Ideal)';
  } else if (plantingMonth >= 8 && plantingMonth <= 9) {
    // September, October - Late Monsoon / Autumn (শরৎ)
    seasonMultiplier = 1.05;
    plantingSeasonBn = 'শরৎ কাল (উত্তম সময়)';
    plantingSeasonEn = 'Autumn / Late Monsoon';
  } else if (plantingMonth >= 10 || plantingMonth <= 1) {
    // November, December, January, February - Dry Cool Winter (শীত)
    seasonMultiplier = 0.88; // Lower survival due to lack of moisture
    plantingSeasonBn = 'শীত কাল (শুষ্ক ও ঠান্ডা)';
    plantingSeasonEn = 'Dry Winter Season';
  } else {
    // March, April, May - Pre-monsoon Hot Drought (গ্রীষ্ম)
    seasonMultiplier = 0.75; // Risk of heatwaves and lack of rain
    plantingSeasonBn = 'গ্রীষ্ম কাল (তীব্র খরা ঝুঁকি)';
    plantingSeasonEn = 'Pre-Monsoon Summer (Drought Risk)';
  }

  // Non-linear logistic-style tapering height calculation:
  // Tree height growth slows down after early years to represent mature plateau.
  // Season of planting and regional fertility multiplier affects growth speed as well!
  let expectedHeight = 0.3; // Base height of a typical 6-month seedling in meters (30cm)
  for (let i = 0; i < totalAgeYears; i++) {
    const ageMultiplier = Math.max(0.3, 1 - (i * 0.05)); // Growth slows by 5% each year
    // The seasonal stress and regional fertility both scale the growth speed
    const environmentalFactor = i === 0 
      ? (seasonMultiplier * regionalBenchmark.expectedGrowthRateMultiplier) 
      : (1 + (seasonMultiplier - 1) * 0.3) * regionalBenchmark.expectedGrowthRateMultiplier;
    expectedHeight += param.yearlyGrowthMeters * ageMultiplier * environmentalFactor * Math.min(1, totalAgeYears - i);
  }

  // Canopy radius modeling (increases with age, slows down similarly)
  let expectedCanopy = 0.1; // Base canopy radius (10cm)
  for (let i = 0; i < totalAgeYears; i++) {
    const ageMultiplier = Math.max(0.4, 1 - (i * 0.08));
    const environmentalFactor = i === 0 
      ? (seasonMultiplier * regionalBenchmark.expectedGrowthRateMultiplier) 
      : (1 + (seasonMultiplier - 1) * 0.3) * regionalBenchmark.expectedGrowthRateMultiplier;
    expectedCanopy += param.yearlyCanopyMeters * ageMultiplier * environmentalFactor * Math.min(1, totalAgeYears - i);
  }

  // Survival probability calculations adjusted for species base rate, planting season, and time elapsed
  // Long-term trees that survive first 6 months have stabilized survival rates.
  let survivalProbability = param.baseSurvivalRate * seasonMultiplier;
  
  if (monthsElapsed > 6) {
    // Stabilizes and improves slightly after surviving critical initial months
    survivalProbability = Math.min(98, survivalProbability + 5);
  } else {
    // Initial critical root development phase
    survivalProbability = Math.max(40, Math.min(95, survivalProbability));
  }

  survivalProbability = Math.round(survivalProbability);

  // Classify overall status
  let healthStatus: 'excellent' | 'good' | 'fair' | 'critical' = 'good';
  if (survivalProbability >= 90) {
    healthStatus = 'excellent';
  } else if (survivalProbability >= 75) {
    healthStatus = 'good';
  } else if (survivalProbability >= 60) {
    healthStatus = 'fair';
  } else {
    healthStatus = 'critical';
  }

  // Calculate underperformance against ideal regional benchmark
  const actualGrowthRateMetersPerYear = totalAgeYears > 0 
    ? parseFloat(((expectedHeight - 0.3) / totalAgeYears).toFixed(3)) 
    : param.yearlyGrowthMeters;
    
  const idealRegionalBenchmarkAnnualGrowth = regionalBenchmark.benchmarkGrowthMetersPerYear;
  
  // Calculate performance index percent (how actual rate stands against regional standard)
  const performanceIndexPercent = Math.min(
    150, 
    Math.round((actualGrowthRateMetersPerYear / idealRegionalBenchmarkAnnualGrowth) * 100)
  );

  // Growth Alert system with standard agronomic threshold levels
  let growthAlertLevel: 'optimal' | 'normal' | 'underperforming' | 'severely_underperforming' = 'normal';
  let growthAlertMsgBn = '';
  let growthAlertMsgEn = '';

  if (performanceIndexPercent >= 95) {
    growthAlertLevel = 'optimal';
    growthAlertMsgBn = `আদর্শ প্রবৃদ্ধি হার! চারাগাছটি নির্ধারিত আঞ্চলিক সূচক অতিক্রম করেছে।`;
    growthAlertMsgEn = `Optimal growth rate! The tree is matching or exceeding regional benchmarks.`;
  } else if (performanceIndexPercent >= 85) {
    growthAlertLevel = 'normal';
    growthAlertMsgBn = `স্বাভাবিক প্রবৃদ্ধি। গাছটি আঞ্চলিক মানদণ্ডের সন্তোষজনক কাছাকাছি রয়েছে।`;
    growthAlertMsgEn = `Normal growth rate. Seedling development is stable and near regional standards.`;
  } else if (performanceIndexPercent >= 70) {
    growthAlertLevel = 'underperforming';
    growthAlertMsgBn = `সতর্কতা: চারাগাছের বৃদ্ধি মন্থর (${100 - performanceIndexPercent}% ধীর)। আর্দ্রতা সংকটে ভুগছে; সেচ বৃদ্ধি করুন এবং নাইট্রোজেন সার দিন।`;
    growthAlertMsgEn = `Warning: Underperforming regional benchmark by ${100 - performanceIndexPercent}%. Seedling is moisture-stressed; boost watering and apply nitrogen.`;
  } else {
    growthAlertLevel = 'severely_underperforming';
    growthAlertMsgBn = `বিপদ সংকেত: চারাগাছটি মারাত্মক স্টান্টেড বা বৃদ্ধিহীন (${100 - performanceIndexPercent}% ধীর)। শিকড়ে আর্দ্রতা সংরক্ষণে অবিলম্বে মালচিং ও তরল খৈল দিন।`;
    growthAlertMsgEn = `Critical Alert: Growth is severely stunted (${100 - performanceIndexPercent}% below regional benchmark). Urgent mulching and biological feeding required.`;
  }

  // Generate actionable, highly practical local advisory content
  let advisoryBn = '';
  let advisoryEn = '';

  // Tailored seasonal advices
  if (plantingMonth >= 5 && plantingMonth <= 8) {
    advisoryBn = 'বর্ষা মৌসুমে রোপণ করায় প্রাকৃতিক পানি সেচ পর্যাপ্ত। তবে চারার গোড়ায় যেন কোনোভাবেই পানি জমে না থাকে সেদিকে খেয়াল রাখুন। নিষ্কাশন নালা সচল রাখুন এবং অতিরিক্ত বৃষ্টির কারণে পাতা পচা রোগ হলে ট্রাইকোডার্মা বা জৈব ছত্রাকনাশক প্রয়োগ করুন।';
    advisoryEn = 'Planted during monsoon; natural moisture is high. Ensure proper drainage to avoid waterlogging around roots. For leaf rot due to heavy rains, apply Trichoderma or organic bio-fungicide.';
  } else if (plantingMonth >= 10 || plantingMonth <= 2) {
    advisoryBn = 'শীতকালীন শুষ্ক রোপণ। চারাগাছের গোড়ায় নিয়মিত সপ্তাহে ২-৩ বার পরিমিত পানি সেচ দিন। আর্দ্রতা ধরে রাখতে গোড়ায় খড় বা শুকনো পাতা দিয়ে ডাবল-লেয়ার মালচিং করুন। ইউরিয়া সার পরিহার করে টিএসপি ও কম্পোস্ট ব্যবহার করুন।';
    advisoryEn = 'Dry winter planting. Irrigate 2-3 times weekly. Apply thick straw/leaf mulching around the tree base to retain soil moisture. Prefer compost and TSP over excessive urea.';
  } else {
    advisoryBn = 'তীব্র খরা বা গ্রীষ্মকালীন রোপণ। তীব্র রোদে চারার পাতা যেন পুড়ে না যায় সেজন্য হালকা নেট দিয়ে আংশিক ছায়ার ব্যবস্থা করুন। সকাল এবং বিকেল দুই বেলা নিয়মিত সেচ দিন। গোড়া আলগা করে দিয়ে প্রচুর জৈব সার দিন।';
    advisoryEn = 'Hot pre-monsoon planting. Provide partial shade using green nets to prevent leaf scorch. Irrigate twice daily (early morning & late afternoon). Mix rich organic manure into loose soil.';
  }

  // Adjust advice based on water preference and limiting factors
  advisoryBn += ` ${regionalBenchmark.limitingFactorBn}`;
  advisoryEn += ` ${regionalBenchmark.limitingFactorEn}`;

  if (param.waterPreference === 'high') {
    advisoryBn += ' এটি অতিরিক্ত পানি প্রিয় প্রজাতি, তাই শুষ্ক দিনগুলোতে গোড়ার মাটি যেন সবসময় ভিজা থাকে তা নিশ্চিত করুন।';
    advisoryEn += ' This is a high-water preference species; ensure the soil around roots remains consistently moist during dry days.';
  } else if (param.waterPreference === 'low') {
    advisoryBn += ' এটি খরা-সহনশীল প্রজাতি, অতিরিক্ত সেচ দিলে শিকড় পচে যেতে পারে। শুধু মাটি খুব শুকনো হলেই পানি দিন।';
    advisoryEn += ' This is a drought-hardy species. Avoid waterlogging as it may cause root rot. Water only when topsoil is completely dry.';
  }

  return {
    expectedHeightMeters: parseFloat(expectedHeight.toFixed(2)),
    expectedCanopyRadiusMeters: parseFloat(expectedCanopy.toFixed(2)),
    survivalProbabilityPercent: survivalProbability,
    healthStatus,
    monthsElapsed,
    advisoryBn,
    advisoryEn,
    plantingSeasonBn,
    plantingSeasonEn,
    
    // New fields
    regionalBenchmark,
    actualGrowthRateMetersPerYear,
    performanceIndexPercent,
    growthAlertLevel,
    growthAlertMsgBn,
    growthAlertMsgEn
  };
}
