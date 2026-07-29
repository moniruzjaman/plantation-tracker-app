import { useState } from 'react';
import { Sprout, Plus, X, Target, Loader2 } from 'lucide-react';
import PlantCard from '../components/PlantCard';
import { createEmptyPlant, type PlantationSite } from '../types/submission';

interface PlantSpotProps {
  site: PlantationSite;
  siteLabel: string;
  onChange: (updater: (prev: PlantationState) => PlantationState) => void;
  /** Called when the user wants to add this spotted plant to a site */
  onAddToSite: (plant: typeof import('../types/submission').PlantEntry) => void;
  language?: 'bn' | 'en';
}

export default function PlantSpot({ site, siteLabel, onChange, onAddToSite, language = 'bn' }: PlantSpotProps) {
  const [spottedPlant, setSpottedPlant] = useState(() => createEmptyPlant());
  const [isAdding, setIsAdding] = useState(false);

  const t = {
    title: language === 'bn' ? 'গাছ দেখানো' : 'Spot Plant',
    plantSpotted: language === 'bn' ? 'গাছ দেখানো!' : 'Plant Spotted!',
    tapToAdd: language === 'bn' ? 'Tambahkan untuk menambah' : 'Tap to add',
    spotPlant: language === 'bn' ? 'গাছ দেখান' : 'Spot Plant',
    addToSite: language === 'bn' ? 'সাইটে যোগ করুন' : 'Add to Site',
    adding: language === 'bn' ? 'যোগ হচ্ছে...' : 'Adding...',
  };

  const handleSpotPlant = () => {
    setSpottedPlant(createEmptyPlant());
  };

  const handleAddToSite = () => {
    setIsAdding(true);
    onAddToSite(spottedPlant);
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
          <Sprout size={16} className="text-emerald-600" /> {t.title}</h3>
      </div>

      {spottedPlant.speciesName || spottedPlant.quantity > 0 ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sprout size={14} className="text-green-600" />
              <span className="text-sm">{spottedPlant.speciesName || '(No species name)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Plus size={14} className="text-green-600" /><span className="text-sm">{spottedPlant.quantity} {spottedPlant.quantity === 1 ? 'plant' : 'plants'}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500">{t.tapToAdd}</p><button
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
          <Target size={14} /> {t.spotPlant}</button>
      )}
    </div>
  );
}
