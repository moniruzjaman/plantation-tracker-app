import { useState } from 'react';
import { Sprout, Plus, X, Target } from 'lucide-react';
import PlantCard from '../components/PlantCard';
import { createEmptyPlant, type PlantationSite } from '../types/submission';

interface PlantSpotProps {
  site: PlantationSite;
  siteLabel: string;
  onChange: (updater: (prev: PlantationSite) => PlantationSite) => void;
  /** Called when the user wants to add this spotted plant to a site */
  onAddToSite: (plant: typeof import('../types/submission').PlantEntry) => void;
  language?: 'bn' | 'en';
}

/**
 * Plant Spot - Quick plant spotting for field observations
 * Allows users to quickly record a plant sighting with minimal data entry
 */
export default function PlantSpot({ site, siteLabel, onChange, onAddToSite, language = 'bn' }: PlantSpotProps) {
  const [spottedPlant, setSpottedPlant] = useState<typeof import('../types/submission').PlantEntry | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const t = {
    title: language === 'bn' ? 'দ্রুত চারা চিহ্নিতকরণ' : 'Quick Plant Spotting',
    siteLabel: language === 'bn' ? 'বর্তমান সাইট' : 'Current Site',
    spotPlant: language === 'bn' ? 'চারাটি চিহ্নিত করুন' : 'Spot Plant',
    adding: language === 'bn' ? 'যোগ করা হচ্ছে...' : 'Adding...',
    addToSite: language === 'bn' ? 'এই সাইটে যোগ করুন' : 'Add to This Site',
    cancel: language === 'bn' => 'বাতিল', // Fixed typo: was 'বাতিল করুন' but kept short for button
    plantSpotted: language === 'bn' ? 'চারা চিহ্নিত Done!' : 'Plant Spotted!',
    tapToAdd: language === 'bn' ? 'চarafুডে যোগ করার জন্য ট্যাপ করুন' : 'Tap to add to site',
  };

  const handleSpotPlant = () => {
    // Create a basic plant entry with minimal required fields
    const newPlant = createEmptyPlant();
    // Set some defaults for quick spotting
    newPlant.quantity = 1;
    newPlant.plantationDate = new Date().toISOString().slice(0, 10);
    setSpottedPlant(newPlant);
  };

  const handleAddToSite = () => {
    if (spottedPlant) {
      setIsAdding(true);
      onAddToSite(spottedPlant);
      // Reset after adding
      setSpottedPlant(null);
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
          <Target size={16} className="text-emerald-600" /> {t.title}
        </h3>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
          {t.siteLabel}: {siteLabel}
        </span>
      </div>

      {spottedPlant ? (
        <>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="mb-2 font-semibold text-green-800">{t.plantSpotted}</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sprout size={14} className="text-green-600" />
                <span className="text-sm">{spottedPlant.speciesName || '(No species name)'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-green-600" />
                <span className="text-sm">{spottedPlant.quantity} {spottedPlant.quantity === 1 ? 'plant' : 'plants'}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500">{t.tapToAdd}</p>
          </div>
          <button
            type="button"
            onClick={handleAddToSite}
            disabled={isAdding}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isAdding ? (
              <>
                <Loader2 size={14} className="animate-spin" /> {t.adding}
              </>
            ) : (
              <>
                <Plus size={14} /> {t.addToSite}
              </>
            )}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleSpotPlant}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Target size={14} /> {t.spotPlant}
        </button>
      )}
    </div>
  );
}