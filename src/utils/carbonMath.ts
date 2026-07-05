import { SeedlingItem } from '../types';

/**
 * Bangladesh Forestry Biomass Carbon Sequestration Formulas
 * References: Bangladesh Forest Department (BFD) & IPCC Tier 2 Silviculture guidelines.
 * Sequestration rates represent average kg of CO2 sequestered per tree per year after reaching maturity.
 */
export const BANGLaDESH_SPECIES_CO2_RATES: Record<string, number> = {
  // Forest species
  'শাল': 22.4, // Shorea robusta (Shal)
  'গর্জন': 24.1, // Dipterocarpus turbinatus (Garjan)
  'সেগুন': 20.8, // Tectona grandis (Teak)
  'মেহগনি': 19.5, // Swietenia macrophylla (Mahogany)
  'ইউক্যালিপটাস': 21.0, // Eucalyptus (High-absorption, fast grower)
  'কড়ই': 18.2, // Albizia lebbeck (Karat)
  'গামার': 17.5, // Gmelina arborea (Gamari)
  'বাবলা': 15.6, // Acacia nilotica (Bablah)

  // Fruit species
  'আম': 16.5, // Mangifera indica (Mango)
  'কাঁঠাল': 15.2, // Artocarpus heterophyllus (Jackfruit)
  'জাম': 17.8, // Syzygium cumini (Black plum)
  'লিচু': 12.4, // Litchi chinensis (Litchi)
  'পেয়ারা': 9.8,  // Psidium guajava (Guava)
  'নারকেল': 14.5, // Cocos nucifera (Coconut)
  'সুপারি': 8.6,  // Areca catechu (Betel nut)

  // Medicinal species
  'নিম': 19.8,  // Azadirachta indica (Neem)
  'অর্জুন': 18.5, // Terminalia arjuna (Arjun)
  'আমলকী': 14.2, // Phyllanthus emblica (Amla)
  'হরিতকী': 15.0, // Terminalia chebula (Haritaki)
  'বহেরা': 16.2,  // Terminalia bellirica (Bahera)
};

/**
 * Calculates estimated CO2 sequestration in Metric Tons per year for a set of seedlings
 */
export function calculateCarbonSequestration(
  fruit: SeedlingItem[],
  forest: SeedlingItem[],
  medicinal: SeedlingItem[]
): number {
  let totalKgPerYear = 0;

  const processList = (list: SeedlingItem[]) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      const count = (item.count || 0) + (item.graftingCount || 0);
      if (count <= 0) return;

      // Find specific rate or default to standard generic tree (15 kg CO2/yr)
      const rate = BANGLaDESH_SPECIES_CO2_RATES[item.speciesName] || 15.0;
      totalKgPerYear += count * rate;
    });
  };

  processList(fruit);
  processList(forest);
  processList(medicinal);

  // Convert kg to Metric Tons
  const tons = totalKgPerYear / 1000;
  return parseFloat(tons.toFixed(3));
}

/**
 * Formats carbon value to show with locale and localized suffix
 */
export function formatCarbonValue(tons: number, lang: 'bn' | 'en' = 'bn'): string {
  if (lang === 'bn') {
    return `${tons.toLocaleString('bn-BD')} টন CO₂/বছর`;
  }
  return `${tons.toLocaleString('en-US')} Tons CO₂/yr`;
}
