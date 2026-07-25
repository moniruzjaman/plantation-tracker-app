import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, ShieldCheck, AlertTriangle, MapPin, UserCircle } from 'lucide-react';
import { validateGeofence, type GeofenceValidationResult } from '../validation/geofenceValidator';
import { routeToValidator, type ValidationTask } from '../services/validationRouter';
import { toBnNum } from '../../../utils/mapHelper';
import type { PlantationSite, Personnel, SubmissionInfo } from '../types/submission';

interface ReviewStepProps {
  sites: PlantationSite[];
  personnel: Personnel[];
  submissionInfo: SubmissionInfo;
  language?: 'bn' | 'en';
}

const RISK_STYLE: Record<string, { bg: string; text: string; icon: typeof ShieldCheck }> = {
  low: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: ShieldCheck },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertTriangle },
  high: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertTriangle },
};

/**
 * Read-only review of the whole draft before submit: every site's plants,
 * a live geofence validation score per site (validation/geofenceValidator.ts),
 * and the auto-assigned SAAO/validation task per site
 * (services/validationRouter.ts) — the officer never picks a validator.
 */
export default function ReviewStep({ sites, personnel, submissionInfo, language = 'bn' }: ReviewStepProps) {
  const [results, setResults] = useState<Record<string, GeofenceValidationResult>>({});
  const [routing, setRouting] = useState<Record<string, ValidationTask>>({});
  const [validating, setValidating] = useState(true);

  const t = {
    title: language === 'bn' ? 'পর্যালোচনা' : 'Review',
    site: language === 'bn' ? 'সাইট' : 'Site',
    plants: language === 'bn' ? 'চারা' : 'plants',
    geofenceScore: language === 'bn' ? 'জিও-ফেন্স স্কোর' : 'Geofence Score',
    validator: language === 'bn' ? 'নির্ধারিত SAAO' : 'Assigned SAAO',
    unassigned: language === 'bn' ? 'এখনো নির্ধারিত হয়নি' : 'Not yet assigned',
    submissionInfo: language === 'bn' ? 'জমা তথ্য' : 'Submission Information',
    submittedBy: language === 'bn' ? 'জমাদানকারী' : 'Submitted By',
    office: language === 'bn' ? 'অফিস' : 'Office',
    date: language === 'bn' ? 'তারিখ' : 'Date',
    status: language === 'bn' ? 'অবস্থা' : 'Status',
    pendingValidation: language === 'bn' ? 'যাচাইয়ের অপেক্ষায়' : 'Pending Validation',
    validating: language === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Validating...',
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setValidating(true);
      const nextResults: Record<string, GeofenceValidationResult> = {};
      const nextRouting: Record<string, ValidationTask> = {};
      for (const site of sites) {
        nextResults[site.site_id] = await validateGeofence(site);
        nextRouting[site.site_id] = routeToValidator(site);
      }
      if (!cancelled) {
        setResults(nextResults);
        setRouting(nextRouting);
        setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
        <ClipboardCheck size={16} className="text-emerald-600" /> {t.title}
      </h3>

      {sites.map((site, i) => {
        const p = personnel.find((pn) => pn.site_id === site.site_id);
        const result = results[site.site_id];
        const task = routing[site.site_id];
        const riskStyle = result ? RISK_STYLE[result.risk] : null;
        const RiskIcon = riskStyle?.icon;

        return (
          <div key={site.site_id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
              <span className="font-bold text-xs text-gray-700 flex items-center gap-1">
                <MapPin size={12} /> {t.site} {i + 1} — {site.location.villageOrRoad || site.location.upazila}
              </span>
              <span className="text-[10px] text-gray-400">
                {toBnNum(site.plants.reduce((s, pl) => s + pl.quantity, 0))} {t.plants}
              </span>
            </div>

            <div className="p-3 space-y-3">
              {/* Plants list */}
              <div className="space-y-1">
                {site.plants.map((pl) => (
                  <div key={pl.plant_id} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-700">{pl.speciesName || '—'} {pl.variety && `(${pl.variety})`}</span>
                    <span className="font-semibold text-emerald-700">{toBnNum(pl.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Personnel */}
              {p && (
                <div className="text-[11px] text-gray-500 flex items-center gap-1">
                  <UserCircle size={11} /> {p.planterName || '—'} {p.planterMobile && `· ${p.planterMobile}`}
                </div>
              )}

              {/* Geofence score */}
              <div className="pt-2 border-t border-gray-100">
                <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.geofenceScore}</label>
                {validating || !result ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Loader2 size={12} className="animate-spin" /> {t.validating}
                  </div>
                ) : (
                  <div className={`rounded-lg p-2 ${riskStyle!.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      {RiskIcon && <RiskIcon size={14} className={riskStyle!.text} />}
                      <span className={`text-sm font-black ${riskStyle!.text}`}>
                        {toBnNum(result.score)}/{toBnNum(result.maxScore)}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold ${riskStyle!.text}`}>{result.recommendation}</span>
                  </div>
                )}
              </div>

              {/* Assigned SAAO */}
              <div>
                <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.validator}</label>
                {!task ? (
                  <p className="text-[11px] text-gray-400">—</p>
                ) : task.status === 'assigned' ? (
                  <p className="text-[11px] text-gray-700">
                    {task.saaoName} · {task.saaoMobile} <span className="text-gray-400">({task.blockName})</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600">{t.unassigned} — {task.reason}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Submission info — auto-populated, non-editable */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
        <label className="text-[10px] font-semibold text-gray-500">{t.submissionInfo}</label>
        <div className="grid grid-cols-2 gap-y-1 text-[11px] text-gray-700">
          <span className="text-gray-400">{t.submittedBy}</span>
          <span className="text-right font-medium">{submissionInfo.submittedByName}</span>
          <span className="text-gray-400">{t.office}</span>
          <span className="text-right font-medium">{submissionInfo.office}</span>
          <span className="text-gray-400">{t.date}</span>
          <span className="text-right font-medium">{new Date(submissionInfo.submissionDate).toLocaleDateString('bn-BD')}</span>
          <span className="text-gray-400">{t.status}</span>
          <span className="text-right font-bold text-amber-600">{t.pendingValidation}</span>
        </div>
      </div>
    </div>
  );
}
