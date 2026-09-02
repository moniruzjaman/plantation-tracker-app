import { UserCircle, Phone } from 'lucide-react';
import type { Personnel } from '../types/submission';

interface PersonnelStepProps {
  personnel: Personnel;
  onChange: (updater: (prev: Personnel) => Personnel) => void;
  language?: 'bn' | 'en';
}

export default function PersonnelStep({ personnel, onChange, language = 'bn' }: PersonnelStepProps) {
  const t = {
    title: language === 'bn' ? 'ব্যক্তিগত তথ্য' : 'Personnel',
    planter: language === 'bn' ? 'রোপণকারী' : 'Planter',
    caretaker: language === 'bn' ? 'পরিচর্যাকারী' : 'Caretaker',
    name: language === 'bn' ? 'নাম' : 'Name',
    mobile: language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile',
    sameAsPlanter: language === 'bn' ? 'রোপণকারীর মতোই' : 'Same as Planter',
  };

  const set = <K extends keyof Personnel>(key: K, value: Personnel[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSameAsPlanter = (checked: boolean) => {
    onChange((prev) => ({
      ...prev,
      caretakerSameAsPlanter: checked,
      caretakerName: checked ? prev.planterName : prev.caretakerName,
      caretakerMobile: checked ? prev.planterMobile : prev.caretakerMobile,
    }));
  };

  const setPlanterName = (value: string) => {
    onChange((prev) => ({
      ...prev,
      planterName: value,
      caretakerName: prev.caretakerSameAsPlanter ? value : prev.caretakerName,
    }));
  };

  const setPlanterMobile = (value: string) => {
    onChange((prev) => ({
      ...prev,
      planterMobile: value,
      caretakerMobile: prev.caretakerSameAsPlanter ? value : prev.caretakerMobile,
    }));
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
        <UserCircle size={16} className="text-emerald-600" /> {t.title}
      </h3>

      {/* Planter */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <label className="text-[10px] font-semibold text-gray-500">{t.planter}</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 mb-0.5 block">{t.name}</label>
            <input
              type="text"
              value={personnel.planterName}
              onChange={(e) => setPlanterName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 mb-0.5 block flex items-center gap-1">
              <Phone size={9} /> {t.mobile}
            </label>
            <input
              type="tel"
              value={personnel.planterMobile}
              onChange={(e) => setPlanterMobile(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Caretaker */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-gray-500">{t.caretaker}</label>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={personnel.caretakerSameAsPlanter}
              onChange={(e) => toggleSameAsPlanter(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            {t.sameAsPlanter}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 mb-0.5 block">{t.name}</label>
            <input
              type="text"
              value={personnel.caretakerName}
              disabled={personnel.caretakerSameAsPlanter}
              onChange={(e) => set('caretakerName', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 mb-0.5 block flex items-center gap-1">
              <Phone size={9} /> {t.mobile}
            </label>
            <input
              type="tel"
              value={personnel.caretakerMobile}
              disabled={personnel.caretakerSameAsPlanter}
              onChange={(e) => set('caretakerMobile', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
