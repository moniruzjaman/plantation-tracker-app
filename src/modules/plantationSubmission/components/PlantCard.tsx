import { Trash2, Save, Pencil, CheckCircle2, AlertCircle } from 'lucide-react';
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
    save: language === 'bn' ? 'চারাটি সংরক্ষণ করুন' : 'Save this plant',
    saved: language === 'bn' ? 'সংরক্ষিত' : 'Saved',
    edit: language === 'bn' ? 'সম্পাদনা' : 'Edit',
    incomplete: language === 'bn'
      ? 'সংরক্ষণের আগে ক্যাটাগরি, প্রজাতির নাম ও সংখ্যা পূরণ করুন'
      : 'Fill in category, plant name, and quantity before saving',
    qty: language === 'bn' ? 'সংখ্যা' : 'qty',
  };

  const set = <K extends keyof PlantEntry>(key: K, value: PlantEntry[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  const speciesOptions = plant.category ? getSpeciesByPlantType(plant.category) : [];
  const isCustomSpecies = plant.category !== '' && !speciesOptions.some((s) => s.name === plant.speciesName);

  const isFilledOut = plant.category.trim() !== '' && plant.speciesName.trim() !== '' && plant.quantity > 0;

  const handleSave = () => {
    if (!isFilledOut) return;
    set('confirmed', true);
  };

  // Once saved, collapse to a compact summary row so a long plant list
  // doesn't stay a wall of open forms — tap Edit to reopen.
  if (plant.confirmed) {
    return (
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5">
        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-900 truncate">{plant.speciesName}</p>
          <p className="text-[10px] text-emerald-600">{plant.variety ? `${plant.variety} · ` : ''}{t.qty}: {plant.quantity}</p>
        </div>
        <button
          type="button"
          onClick={() => set('confirmed', false)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-700 text-[11px] font-bold hover:bg-emerald-50 cursor-pointer shrink-0"
        >
          <Pencil size={12} /> {t.edit}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-300 hover:text-red-500 cursor-pointer shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

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

      <button
        type="button"
        onClick={handleSave}
        disabled={!isFilledOut}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <Save size={14} /> {t.save}
      </button>
      {!isFilledOut && (
        <p className="text-[10px] text-amber-600 flex items-center gap-1 -mt-1.5">
          <AlertCircle size={11} /> {t.incomplete}
        </p>
      )}
    </div>
  );
}
