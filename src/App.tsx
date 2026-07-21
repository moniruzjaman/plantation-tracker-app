/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import NetworkStatus, { NetworkStatusData } from './components/NetworkStatus';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import GeolocationIndicator, { GeoState } from './components/GeolocationIndicator';
import WelcomeModal from './components/WelcomeModal';
import PWAInstaller from './components/PWAInstaller';
import SyncToast from './components/SyncToast';
import OfflinePlantationDashboard from './components/OfflinePlantationDashboard';
import AIAssistant from './components/AIAssistant';
import PlantationForm from './components/plantation/PlantationForm';
import MapTab from './components/plantation/MapTab';
import ProfilePage from './components/plantation/ProfilePage';
import { saveSubmission, getSubmissions } from './utils/submissionStore';
import { getSubmissionReward } from './lib/db';
import { useAuth } from './hooks/useAuth';
import type { PlantationSubmission } from './types/plantation';
import UserGuideModal from './components/UserGuideModal';
import MobileControlCenter from './components/MobileControlCenter';
import { shareApp, shareViaWhatsApp, getDefaultSharePayload } from './utils/shareApp';
import { 
  Sparkles, 
  ClipboardList, 
  LayoutDashboard, 
  Map as MapIcon, 
  UserCircle,
  Menu,
  X,
  Share2,
  BookOpen,
  MessageCircle,
  Link as LinkIcon,
  Facebook,
  Send as TelegramIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Star } from 'lucide-react';

// Tabs the iframe still owns (not yet ported natively). 'dashboard' is now
// native (OfflinePlantationDashboard), so it's no longer in this list.
const IFRAME_OWNED_TABS = ['storedData', 'admin'] as const;

// Navigation tabs definition — 4 pages: Form, Map, Profile, Dashboard.
const tabs = [
  { id: 'form', label: 'ফর্ম', icon: ClipboardList },
  { id: 'map', label: 'ম্যাপ', icon: MapIcon },
  { id: 'profile', label: 'প্রোফাইল', icon: UserCircle },
  { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
] as const;

type TabId = typeof tabs[number]['id'] | 'storedData' | 'admin';

export default function App() {
  const [networkState, setNetworkState] = useState<NetworkStatusData | null>(null);
  const [geoState, setGeoState] = useState<GeoState | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInitialTab, setAiInitialTab] = useState<'chat' | 'diagnose' | undefined>(undefined);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [currentTab, setCurrentTab] = useState<TabId>('form');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [rewardToast, setRewardToast] = useState<{ xp: number; tokens: number; breakdown: { label: string; xp: number; tokens: number }[] } | null>(null);
  const [mcSubmissions, setMcSubmissions] = useState<PlantationSubmission[]>([]);
  const { addXp, addTokens, session } = useAuth();
  const offlineQueue = useOfflineQueue();

  // Keep the floating status hub's submission stats fresh.
  const refreshMcSubmissions = useCallback(() => {
    getSubmissions().then(setMcSubmissions).catch(() => {});
  }, []);

  useEffect(() => {
    refreshMcSubmissions();
  }, [refreshMcSubmissions]);

  const handleHeaderShare = useCallback(async () => {
    const result = await shareApp();
    if (result === 'copied') {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
    if (result === 'shared' || result === 'copied') {
      setSharePopoverOpen(false);
    }
  }, []);

  const handleHeaderCopyLink = useCallback(() => {
    const { url } = getDefaultSharePayload();
    navigator.clipboard?.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  }, []);

  const handleHeaderFacebookShare = useCallback(() => {
    const { url } = getDefaultSharePayload();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
  }, []);

  const handleHeaderTelegramShare = useCallback(() => {
    const { url, text } = getDefaultSharePayload();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }, []);


  // Ref to notify MapTab to invalidateSize
  const mapInvalidateRef = useRef<(() => void) | null>(null);
  const registerMapInvalidate = useCallback((fn: () => void) => {
    mapInvalidateRef.current = fn;
  }, []);

  // Unified tab switching
  const handleTabChange = useCallback((tabId: TabId) => {
    setCurrentTab(tabId);
    setMobileDrawerOpen(false);
    if (!IFRAME_OWNED_TABS.includes(tabId as any)) return;
    const iframe = document.getElementById('app-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        if (typeof (iframe.contentWindow as any).switchTab === 'function') {
          (iframe.contentWindow as any).switchTab(tabId);
        }
        iframe.contentWindow.postMessage({ type: 'switch-tab', tab: tabId }, '*');
      } catch (err) {
        console.warn("Direct tab switch call failed, sending postMessage:", err);
        try {
          iframe.contentWindow.postMessage({ type: 'switch-tab', tab: tabId }, '*');
        } catch (postErr) {
          console.error("Tab switch message dispatch failed:", postErr);
        }
      }
    }
  }, []);

  // Invalidate Leaflet map size when switching to map tab
  useEffect(() => {
    if (currentTab === 'map' && mapInvalidateRef.current) {
      // Use requestAnimationFrame to ensure the container is visible and laid out
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mapInvalidateRef.current?.();
        });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [currentTab]);

  // Listen to cross-window requests, AI triggers, and rural data saver toggle events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      if (event.data.type === 'request-location') {
        if (!IFRAME_OWNED_TABS.includes(currentTab as any)) return;
        const iframe = document.getElementById('app-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow && geoState && geoState.coords) {
          iframe.contentWindow.postMessage({
            type: 'device-location',
            coords: {
              latitude: geoState.coords.latitude,
              longitude: geoState.coords.longitude,
              accuracy: geoState.coords.accuracy
            }
          }, '*');
        }
      }

      if (event.data.type === 'tab-changed') {
        const tab = event.data.tab;
        if (['form', 'dashboard', 'map', 'storedData', 'admin', 'profile'].includes(tab)) {
          setCurrentTab(tab as TabId);
        }
      }

      if (event.data.type === 'open-ai-assistant') {
        setAiInitialTab(event.data.tab || 'chat');
        setAiInitialPrompt(event.data.prompt || undefined);
        setIsAiOpen(true);
      }

      if (event.data.type === 'rural-data-saver-change') {
        const enabled = event.data.enabled;
        localStorage.setItem('rural_data_saver_active', enabled ? 'true' : 'false');
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'rural_data_saver_active',
          newValue: enabled ? 'true' : 'false'
        }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [geoState, currentTab]);

  // Listen for app-navigate custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (['form', 'dashboard', 'map', 'storedData', 'admin', 'profile'].includes(tab)) {
        handleTabChange(tab as TabId);
      }
    };
    window.addEventListener('app-navigate', handler);
    return () => window.removeEventListener('app-navigate', handler);
  }, [handleTabChange]);

  // Only push GPS to iframe when the iframe is visible
  useEffect(() => {
    if (geoState?.coords && IFRAME_OWNED_TABS.includes(currentTab as any)) {
      const iframe = document.getElementById('app-iframe') as HTMLIFrameElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'device-location',
          coords: {
            latitude: geoState.coords.latitude,
            longitude: geoState.coords.longitude,
            accuracy: geoState.coords.accuracy
          }
        }, '*');
      }
    }
  }, [geoState, currentTab]);

  const handlePlantationSubmit = (submission: PlantationSubmission) => {
    saveSubmission(submission);
    refreshMcSubmissions();

    // Award tokens & XP based on data richness
    const reward = getSubmissionReward(submission);
    if (reward.xp > 0) addXp(reward.xp, 'ফর্ম জমা');
    if (reward.tokens > 0) addTokens(reward.tokens, 'তথ্য পুরস্কার');

    // Show reward toast
    if (reward.xp > 0 || reward.tokens > 0) {
      setRewardToast(reward);
      setTimeout(() => setRewardToast(null), 4000);
    }
  };

  // Active tab label for drawer header
  const activeTabDef = tabs.find(t => t.id === currentTab);
  const activeTabLabel = activeTabDef?.label ?? '';

  return (
    <div className="flex flex-col w-full h-[100dvh] overflow-hidden bg-slate-50 font-sans safe-area-top">
      <NetworkStatus onStateChange={setNetworkState} />
      <GeolocationIndicator onStateChange={setGeoState} />
      <WelcomeModal />
      <PWAInstaller />
      <SyncToast />
      <MobileControlCenter
        networkState={networkState}
        geoState={geoState}
        submissions={mcSubmissions}
        userEmail={session?.profile?.mobile || 'guest@dae.gov.bd'}
        onOpenGuide={() => setGuideOpen(true)}
      />

      {/* ======= SUBMISSION REWARD TOAST ======= */}
      <AnimatePresence>
        {rewardToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-sm bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500 to-emerald-500 px-4 py-2 text-white text-xs font-bold flex items-center gap-1.5">
              <Star size={14} /> পুরস্কার অর্জিত!
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-50 rounded-lg p-1.5">
                    <Star size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-emerald-700 leading-none">+{rewardToast.xp}</p>
                    <p className="text-[10px] text-gray-500">XP</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-amber-50 rounded-lg p-1.5">
                    <Coins size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-amber-700 leading-none">+{rewardToast.tokens}</p>
                    <p className="text-[10px] text-gray-500">গ্রিন টোকেন</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-1.5 space-y-0.5 max-h-24 overflow-y-auto">
                {rewardToast.breakdown.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-gray-600">
                    <span>{b.label}</span>
                    <span className="text-gray-400 font-mono">+{b.xp}XP +{b.tokens}টোকেন</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======= TOP HEADER ======= */}
      <header className="flex-shrink-0 bg-gradient-to-r from-green-900 via-green-800 to-emerald-950 text-white shadow-md relative no-print overflow-visible" style={{ zIndex: 30 }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 92% -30%, rgba(220,38,38,.35) 0%, rgba(220,38,38,0) 55%)' }}
        />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-12 sm:h-14 md:h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* Hamburger menu for mobile + tablet (below md) */}
            <button
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
              className="md:hidden flex-shrink-0 p-1.5 -ml-1 rounded-lg hover:bg-emerald-700/50 transition-colors cursor-pointer"
              aria-label="মেনু খুলুন"
            >
              {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <img
              src="/bd-logo.svg"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/bd-logo.png'; }}
              alt="বাংলাদেশ সরকার"
              className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full p-0.5 shadow flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-bold text-xs sm:text-sm md:text-base leading-tight tracking-tight truncate">বৃক্ষরোপণ মনিটরিং ও তথ্য সংগ্রহ</h1>
              <p className="text-[9px] sm:text-[10px] text-emerald-200/90 hidden sm:block font-medium">কৃষি সম্প্রসারণ অধিদপ্তর (DAE) | মোবাইল ডাটা সার্ভিস</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs — hidden below md */}
          <nav className="hidden md:flex items-center gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer relative ${
                    isActive 
                      ? 'text-white bg-emerald-700/70 font-bold shadow-inner border border-emerald-600/30' 
                      : 'text-emerald-100 hover:text-white hover:bg-emerald-700/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-emerald-200'}`} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabUnderline"
                      className="absolute bottom-1 left-4 right-4 h-0.5 bg-red-400 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <img
            src="/dae-logo.webp"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/dae-logo.png'; }}
            alt="কৃষি সম্প্রসারণ অধিদপ্তর"
            className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full p-0.5 shadow flex-shrink-0"
          />
        </div>

        {/* Flag-inspired accent divider */}
        <div className="h-[3px] relative" style={{ background: 'linear-gradient(to right,#166534,#dc2626 50%,#166534)', opacity: 0.9 }} />

        {/* Minimal icon-only actions row — kept small to save vertical space */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1 flex items-center justify-end gap-4 relative">
          <button
            onClick={() => setGuideOpen(true)}
            title="ব্যবহার নির্দেশিকা"
            aria-label="ব্যবহার নির্দেশিকা"
            className="flex items-center gap-1 py-0.5 px-1 text-emerald-100 hover:opacity-75 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer bg-transparent border-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">নির্দেশিকা</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setSharePopoverOpen((v) => !v)}
              title="অ্যাপ শেয়ার করুন"
              aria-label="অ্যাপ শেয়ার করুন"
              className="flex items-center gap-1 py-0.5 px-1 text-red-200 hover:opacity-75 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer bg-transparent border-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold">শেয়ার</span>
            </button>

            <AnimatePresence>
              {sharePopoverOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSharePopoverOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-8 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 z-50 text-gray-800"
                  >
                    <p className="text-[11px] font-bold text-green-800 mb-2 px-1">📤 অ্যাপটি শেয়ার করুন</p>
                    <button
                      onClick={handleHeaderShare}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 shadow-sm hover:brightness-110 transition cursor-pointer mb-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" /> মোবাইল শেয়ার মেনু
                    </button>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={handleHeaderFacebookShare} className="flex flex-col items-center gap-1 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition cursor-pointer">
                        <Facebook className="w-4 h-4 text-blue-700" />
                        <span className="text-[9px] font-semibold text-blue-700">Facebook</span>
                      </button>
                      <button onClick={handleHeaderTelegramShare} className="flex flex-col items-center gap-1 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 transition cursor-pointer">
                        <TelegramIcon className="w-4 h-4 text-sky-600" />
                        <span className="text-[9px] font-semibold text-sky-600">Telegram</span>
                      </button>
                      <button onClick={() => shareViaWhatsApp()} className="flex flex-col items-center gap-1 py-2 rounded-lg bg-green-50 hover:bg-green-100 transition cursor-pointer">
                        <MessageCircle className="w-4 h-4 text-green-700" />
                        <span className="text-[9px] font-semibold text-green-700">WhatsApp</span>
                      </button>
                    </div>
                    <button
                      onClick={handleHeaderCopyLink}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-1.5 rounded-xl text-xs font-semibold text-green-800 bg-green-50 hover:bg-green-100 transition cursor-pointer"
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> {shareCopied ? '✅ লিংক কপি হয়েছে' : 'লিংক কপি করুন'}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* User Guide modal — reachable from the header on every tab */}
      <UserGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* ======= MOBILE DRAWER OVERLAY (below md only) ======= */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="md:hidden fixed inset-0 bg-black/40 z-40"
            />
            {/* Drawer sheet from top */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white rounded-b-2xl shadow-2xl overflow-hidden"
              style={{ top: '48px' }} /* align with header height on mobile */
            >
              <nav className="p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                      {isActive && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ======= MAIN CONTENT STAGE ======= */}
      <main className="flex-1 w-full relative overflow-hidden bg-white min-h-0">
        <div
          className="absolute inset-0 overflow-y-auto form-scroll-area"
          style={{ display: currentTab === 'form' ? 'block' : 'none' }}
        >
          <PlantationForm geoState={geoState} onSubmit={handlePlantationSubmit} />
        </div>

        <div
          className="absolute inset-0"
          style={{ display: currentTab === 'map' ? 'block' : 'none' }}
        >
          <MapTab geoState={geoState} onMapReady={registerMapInvalidate} />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto form-scroll-area"
          style={{ display: currentTab === 'profile' ? 'block' : 'none' }}
        >
          <ProfilePage networkState={networkState} geoState={geoState} />
        </div>

        <div
          className="absolute inset-0 overflow-y-auto form-scroll-area"
          style={{ display: currentTab === 'dashboard' ? 'block' : 'none' }}
        >
          <OfflinePlantationDashboard syncState={offlineQueue} />
        </div>

        {/* Legacy iframe for storedData / admin */}
        <iframe 
          id="app-iframe"
          src="legacy-nursery.html" 
          style={{ display: ['form', 'map', 'profile', 'dashboard'].includes(currentTab) ? 'none' : 'block', width: '100%', height: '100%', border: 'none' }}
          title="Plantation Dashboard" 
          allow="geolocation"
          onLoad={(e) => {
            try {
              const win = e.currentTarget.contentWindow;
              if (win) {
                (win as any).VITE_GEE_PIPELINE_URL = import.meta.env.VITE_GEE_PIPELINE_URL;
                if (typeof (win as any).switchTab === 'function' && IFRAME_OWNED_TABS.includes(currentTab as any)) {
                  (win as any).switchTab(currentTab);
                }
              }
            } catch (err) {
              console.error("Failed to inject env vars:", err);
            }
          }}
        />
      </main>

      {/* ======= MOBILE BOTTOM TAB BAR (below md only) ======= */}
      <nav className="md:hidden flex-shrink-0 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] flex items-center justify-around relative no-print mobile-bottom-nav" style={{ zIndex: 30, height: '56px', minHeight: '56px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="flex flex-col items-center justify-center flex-1 py-1 transition active:scale-95 cursor-pointer relative -outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-500"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`p-1 rounded-xl transition-colors duration-200 ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] mt-0.5 font-semibold transition-colors duration-200 leading-tight ${isActive ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="mobileActiveIndicator"
                  className="absolute -top-px left-1/4 right-1/4 h-0.5 bg-emerald-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>
      
      {/* ======= AI Co-Pilot Floating FAB ======= */}
      <div className="fixed bottom-[72px] md:bottom-6 right-3 md:right-4 pointer-events-auto" style={{ zIndex: 40 }}>
        <motion.button
          id="aiCoPilotFAB"
          onClick={() => setIsAiOpen(!isAiOpen)}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-2xl border transition-all text-[10px] sm:text-xs font-extrabold cursor-pointer ${
            isAiOpen 
              ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-850' 
              : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700 shadow-emerald-500/20'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
        >
          <div className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </div>
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="font-sans hidden xs:inline">
            {isAiOpen ? 'সহকারী বন্ধ' : 'AI কো-পাইলট'}
          </span>
        </motion.button>
      </div>

      {/* ======= AI Assistant Modal ======= */}
      <AnimatePresence>
        {isAiOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiOpen(false)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs"
              style={{ zIndex: 45 }}
            />
            <motion.div
              id="aiAssistantPanel"
              initial={{ opacity: 0, x: 50, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="fixed bottom-[88px] md:bottom-24 right-2 sm:right-4 w-[95vw] sm:w-[420px] h-[60vh] sm:h-[65vh] max-h-[500px] sm:max-h-[550px] shadow-2xl rounded-2xl overflow-hidden"
              style={{ zIndex: 50 }}
            >
              <AIAssistant 
                onClose={() => setIsAiOpen(false)} 
                initialTab={aiInitialTab}
                initialPrompt={aiInitialPrompt}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}