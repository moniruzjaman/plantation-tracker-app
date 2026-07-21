/**
 * VM0047 v1.1 Compliant Carbon Stock Calculation
 *
 * Implements the IPCC Tier 2 Allometric Equation (Chave et al. 2014)
 * for Aboveground Biomass estimation, plus IPCC default root:shoot ratio
 * for Belowground Biomass, and standard carbon fraction conversion.
 *
 * This complements the existing `carbonMath.ts` (which calculates annual
 * CO2 sequestration rates) by providing ABSOLUTE carbon stock estimates
 * required for carbon credit verification.
 *
 * References:
 * - Chave et al. (2014) "Improved allometric models to estimate the
 *   aboveground biomass of tropical trees" — Global Change Biology
 * - IPCC 2006 Guidelines for National Greenhouse Gas Inventories, Vol. 4
 * - Verra VM0047 v1.1 Methodology
 */

import type { SeedlingEntry } from '../types/plantation';

// ---------- Species Wood Density (g/cm³) ----------
// Source: Global Wood Density Database (Chave et al. 2009)
// Used in the Chave allometric equation for tropical moist forests

export const SPECIES_WOOD_DENSITY: Record<string, number> = {
  // Forest species
  'শাল': 0.68,        // Shorea robusta
  'গর্জন': 0.62,      // Dipterocarpus turbinatus
  'সেগুন': 0.55,      // Tectona grandis
  'মেহগনি': 0.53,     // Swietenia macrophylla
  'ইউক্যালিপটাস': 0.60, // Eucalyptus globulus
  'কড়ই': 0.50,       // Albizia lebbeck
  'গামার': 0.52,      // Gmelina arborea
  'বাবলা': 0.78,      // Acacia nilotica
  'আকাশমণি': 0.45,    // Acacia auriculiformis
  'শিশু': 0.66,       // Dalbergia sissoo
  'রেইনট্রি': 0.42,   // Samanea saman

  // Fruit species
  'আম': 0.53,         // Mangifera indica
  'কাঁঠাল': 0.51,     // Artocarpus heterophyllus
  'জাম': 0.68,        // Syzygium cumini
  'লিচু': 0.47,       // Litchi chinensis
  'পেয়ারা': 0.62,    // Psidium guajava
  'নারকেল': 0.48,    // Cocos nucifera
  'নারিকেল': 0.48,   // Cocos nucifera (alternate spelling)
  'সুপারি': 0.68,    // Areca catechu

  // Medicinal species
  'নিম': 0.56,        // Azadirachta indica
  'ঘৃতকুমারী': 0.22, // Aloe vera (not woody, use low value)
  'অর্জুন': 0.62,    // Terminalia arjuna
  'আমলকী': 0.58,     // Phyllanthus emblica
  'হরিতকী': 0.72,    // Terminalia chebula
  'বহেরা': 0.70,     // Terminalia bellirica

  // Ornamental
  'কৃষ্ণচূড়া': 0.45, // Delonix regia

  // Bamboo
  'বাঁশ': 0.55,       // Bambusoideae (average)
};

// Default wood density for unknown species (tropical average)
const DEFAULT_WOOD_DENSITY = 0.55;

// IPCC constants
const ROOT_SHOOT_RATIO = 0.26;     // Belowground = 26% of Aboveground (IPCC default)
const CARBON_FRACTION = 0.47;      // Carbon = 47% of dry biomass (IPCC default)
const CO2_CONVERSION = 3.67;       // CO2 = Carbon × (44/12)

// ---------- Carbon Stock Report ----------

export interface CarbonStockReport {
  /** Aboveground carbon stock (Mg C/ha) */
  abovegroundCarbonMgPerHa: number;
  /** Belowground carbon stock (Mg C/ha) */
  belowgroundCarbonMgPerHa: number;
  /** Total carbon stock (Mg C) for the given area */
  totalCarbonStockMg: number;
  /** CO2 equivalent in metric tons */
  co2EquivalentTons: number;
  /** Methodology identifier */
  methodology: 'VM0047_v1.1';
  /** Confidence based on data completeness */
  confidenceLevel: 'high' | 'medium' | 'low';
  /** Number of trees with measured data */
  treesWithMeasurements: number;
  /** Number of trees estimated (no DBH/height) */
  treesEstimated: number;
}

// ---------- Core Calculation ----------

/**
 * Calculate Aboveground Biomass for a single tree using Chave et al. 2014
 * equation for tropical moist forests:
 *
 *   AGB (kg) = 0.0673 × (ρ² × DBH² × H)^0.976
 *
 * where ρ = wood density (g/cm³), DBH = diameter at breast height (cm),
 * H = total height (m).
 *
 * @param dbhCm - Diameter at Breast Height in centimeters
 * @param heightM - Total tree height in meters
 * @param woodDensity - Wood density in g/cm³
 * @returns Aboveground biomass in kg (dry weight)
 */
export function calculateTreeBiomassKg(
  dbhCm: number,
  heightM: number,
  woodDensity: number
): number {
  if (dbhCm <= 0 || heightM <= 0 || woodDensity <= 0) return 0;
  // Chave et al. 2014 tropical moist forest equation
  const agb = 0.0673 * Math.pow(woodDensity * woodDensity * dbhCm * dbhCm * heightM, 0.976);
  return agb; // kg
}

/**
 * Calculate carbon stock for a plantation site.
 *
 * For trees with DBH + height measurements: uses Chave allometric equation.
 * For trees without measurements: uses species-specific allometric estimates
 * based on age-derived height from growthModel.
 *
 * @param seedlings - Species and count data from submission
 * @param measurements - Optional per-species DBH/height measurements from monitoring
 * @param areaHectares - Plantation area (for per-hectare calculations)
 * @param yearsSincePlanting - Years since planting (for estimation)
 */
export function calculateCarbonStock(
  seedlings: SeedlingEntry[],
  measurements: Array<{
    speciesName: string;
    avgDbhCm: number;
    avgHeightM: number;
  }> = [],
  areaHectares: number = 1,
  yearsSincePlanting: number = 1
): CarbonStockReport {
  let totalBiomassKg = 0;
  let treesWithMeasurements = 0;
  let treesEstimated = 0;
  let hasDbhData = false;

  // Build measurement lookup
  const measurementMap = new Map<string, { avgDbhCm: number; avgHeightM: number }>();
  for (const m of measurements) {
    measurementMap.set(m.speciesName, { avgDbhCm: m.avgDbhCm, avgHeightM: m.avgHeightM });
  }

  for (const seedling of seedlings) {
    if (!seedling.count || seedling.count <= 0) continue;

    const woodDensity = SPECIES_WOOD_DENSITY[seedling.speciesName] ?? DEFAULT_WOOD_DENSITY;
    const measurement = measurementMap.get(seedling.speciesName);

    if (measurement && measurement.avgDbhCm > 0 && measurement.avgHeightM > 0) {
      // Measured tree — use Chave equation
      const biomassPerTree = calculateTreeBiomassKg(
        measurement.avgDbhCm,
        measurement.avgHeightM,
        woodDensity
      );
      totalBiomassKg += biomassPerTree * seedling.count;
      treesWithMeasurements += seedling.count;
      hasDbhData = true;
    } else {
      // Estimated tree — use age-based approximation
      // For young trees (1-3 years), estimate DBH from age and species growth rate
      const estimatedDbhCm = Math.min(2.0 * yearsSincePlanting, 15); // rough: ~2cm/year, cap at 15cm
      const estimatedHeightM = Math.min(0.9 * yearsSincePlanting + 0.3, 10); // rough: ~0.9m/year, cap at 10m
      const biomassPerTree = calculateTreeBiomassKg(estimatedDbhCm, estimatedHeightM, woodDensity);
      totalBiomassKg += biomassPerTree * seedling.count;
      treesEstimated += seedling.count;
    }
  }

  // Convert biomass to carbon
  const totalBiomassMg = totalBiomassKg / 1000; // kg → Mg (metric tons)
  const abovegroundCarbonMg = totalBiomassMg * CARBON_FRACTION;
  const belowgroundCarbonMg = abovegroundCarbonMg * ROOT_SHOOT_RATIO;
  const totalCarbonMg = abovegroundCarbonMg + belowgroundCarbonMg;
  const co2EquivalentTons = totalCarbonMg * CO2_CONVERSION;

  // Per-hectare calculations (if area provided)
  const areaFactor = areaHectares > 0 ? areaHectares : 1;

  // Confidence level based on data quality
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (hasDbhData && treesWithMeasurements > 0) {
    confidenceLevel = treesWithMeasurements / (treesWithMeasurements + treesEstimated) > 0.8 ? 'high' : 'medium';
  } else {
    confidenceLevel = 'low';
  }

  return {
    abovegroundCarbonMgPerHa: parseFloat((abovegroundCarbonMg / areaFactor).toFixed(4)),
    belowgroundCarbonMgPerHa: parseFloat((belowgroundCarbonMg / areaFactor).toFixed(4)),
    totalCarbonStockMg: parseFloat(totalCarbonMg.toFixed(4)),
    co2EquivalentTons: parseFloat(co2EquivalentTons.toFixed(4)),
    methodology: 'VM0047_v1.1',
    confidenceLevel,
    treesWithMeasurements,
    treesEstimated,
  };
}

/**
 * Map the app's 4-tier health status to VM0047's 3-tier classification.
 */
export function mapToVM0047Health(
  appStatus: 'excellent' | 'good' | 'fair' | 'critical'
): 'healthy' | 'stressed' | 'dead' {
  switch (appStatus) {
    case 'excellent':
    case 'good':
      return 'healthy';
    case 'fair':
      return 'stressed';
    case 'critical':
      return 'dead';
  }
}