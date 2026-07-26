import { Trash2 } from 'lucide-react';
import { PLANT_TYPES, getSpeciesByPlantType } from '../../../data/taxonomy';
import PhotoUploader from './PhotoUploader';
import type { PlantEntry } from '../types/submission';

interface PlantCardProps {
  plant: PlantEntry;
  onChange: (updater: (prev: PlantEntry) => PlantEntry) => void;
  onRemove?: () => void;
  siteLatitude: number;
  siteLongitude: number;
  language?: 'bn' | 'en';
}

export default function PlantCard({ plant, onChange, onRemove, siteLatitude, siteLongitude, language = 'bn' }: PlantCardProps) {
  const t = {
    category: language === 'bn' ? 'ক্যাটাগরি' : 'Category',
    species: language === 'bn' ? 'প্রজাতির নাম' : 'Plant Name',
    variety: language === 'bn' ? 'জাত' : 'Variety',
    plantationDate: language === 'bn' ? 'রোপণের তারিখ' : 'Plantation Date',
    seedlingAge: language === 'bn' ? 'চারার বয়স (মাস)' : 'Seedling Age (months)',
    quantity: language === 'bn' ? 'সংখ্যা' : 'Quantity',
    selectCategory: language === 'bn' ? '— নির্বাচন করুন —' : '— Select —',
    otherSpecies: language === 'bn' ? 'অন্যান্য (লিখুন)' : 'Other (type manually)',
  };

  const set = <K extends keyof PlantEntry>(key: K, value: PlantEntry[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  const speciesOptions = plant.category ? getSpeciesByPlantType(plant.category) : [];
  const isCustomSpecies = plant.category !== '' && !speciesOptions.some((s) => s.name === plant.speciesName);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3 relative">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 text-gray-300 hover:text-red-500 cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 pr-6">
        <div>
          <label className="text-[10px] text-gray-400 mb-0.5 block">{t.category}</label>
          <select
            value={plant.category}
            onChange={(e) => {
              set('category', e.target.value);
              set('speciesName', ''); // reset species when category changes
            }}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">{t.selectCategory}</option>
            {PLANT_TYPES.map((pt) => (
              <option key={pt.id} value={pt.id}>{pt.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-gray-400 mb-0.5 block">{t.species}</label>
          {plant.category && speciesOptions.length > 0 && !isCustomSpecies ? (
            <select
              value={plant.speciesName}
              onChange={(e) => set('speciesName', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">{t.selectCategory}</option>
              {speciesOptions.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
              <option value="__custom__">{t.otherSpecies}</option>
            </select>
          ) : (
            <input
              type="text"
              value={plant.speciesName}
              onChange={(e) => set('speciesName', e.target.value)}
              placeholder={t.otherSpecies}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          )}
        </div>

        <div>
          <label className="text-[10px] text-gray-400 mb-0.5 block">{t.variety}</label>
          <input
            type="text"
            value={plant.variety || ''}
            onChange={(e) => set('variety', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 mb-0.5 block">{t.quantity}</label>
          <input
            type="number"
            min={1}
            value={plant.quantity}
            onChange={(e) => set('quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 mb-0.5 block">{t.plantationDate}</label>
          <input
            type="date"
            value={plant.plantationDate}
            onChange={(e) => set('plantationDate', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-400 mb-0.5 block">{t.seedlingAge}</label>
          <input
            type="number"
            min={0}
            value={plant.seedlingAgeMonths ?? ''}
            onChange={(e) => set('seedlingAgeMonths', e.target.value ? parseInt(e.target.value, 10) : undefined)}
            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <PhotoUploader
        photos={plant.photos}
        onChange={(photos) => set('photos', photos)}
        siteLatitude={siteLatitude}
        siteLongitude={siteLongitude}
        language={language}
      />
    </div>
  );
}
