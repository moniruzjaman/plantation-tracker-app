import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Smartphone, CheckCircle, HelpCircle, X, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // 1. Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    if (isIOS) setPlatform('ios');
    else if (isAndroid) setPlatform('android');
    else setPlatform('desktop');

    // 2. Check if already installed or running in standalone mode / native android app
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone ||
      Capacitor.isNativePlatform();

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 3. Listen to beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default browser mini-infobar prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    // 4. Listen to appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      // Clean up prompt
      try {
        localStorage.setItem('pwa_installed_status', 'true');
      } catch (err) {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Initial check from localStorage fallback
    try {
      if (localStorage.getItem('pwa_installed_status') === 'true') {
        setIsInstalled(true);
      }
    } catch (err) {}

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If prompt event is not yet generated, toggle explanatory helper tooltip
      setShowTooltip(true);
      return;
    }

    // Show the native browser installation prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      // User dismissed
    }
  };

  // If already installed, or on a native Android wrapper context, don't display the install button
  if (isInstalled || Capacitor.isNativePlatform()) {
    return null;
  }

  // Determine if we have the prompt available to trigger directly
  const hasDirectInstall = !!deferredPrompt;

  return (
    <div className="absolute top-[160px] right-4 z-[40] pointer-events-none font-sans" id="pwaInstallerContainer">
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        {/* Floating Installation Button */}
        <motion.button
          id="btnPWAInstall"
          layout
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-lg border backdrop-blur-sm transition-all text-xs font-semibold cursor-pointer ${
            hasDirectInstall 
              ? 'bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-white border-green-500 hover:from-green-700 hover:to-emerald-700' 
              : 'bg-white/95 border-gray-150 text-gray-700 hover:bg-gray-50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {hasDirectInstall ? (
            <Download className="w-4 h-4 text-white animate-bounce" id="iconPWADownload" />
          ) : (
            <Smartphone className="w-4 h-4 text-emerald-600" id="iconPWASmartphone" />
          )}

          <span>
            {hasDirectInstall ? 'অ্যাপ ডাউনলোড করুন' : 'মোবাইলে ইনস্টল'}
          </span>
        </motion.button>

        {/* Informative Step-by-Step Installation Modal/Tooltip if Direct Installation isn't triggered by browser yet (e.g., Safari/iOS or delay) */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              id="pwaInstallInstructionsPanel"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="w-72 bg-white border border-gray-150 rounded-2xl p-4 shadow-xl text-gray-800 text-xs flex flex-col gap-3"
            >
              {/* Header */}
              <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-sm">অ্যাপ ইনস্টলেশন গাইড</span>
                </div>
                <button 
                  onClick={() => setShowTooltip(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Instructions dynamic based on platform */}
              <div className="flex flex-col gap-2.5 text-[11px] leading-relaxed text-gray-600">
                {platform === 'ios' ? (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-gray-800">আইফোন/আইপ্যাড (Safari) ব্যবহারকারীদের জন্য:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>সফারি ব্রাউজারের নিচে থাকা <span className="font-bold text-blue-600">Share (শেয়ার)</span> বুটনে ক্লিক করুন।</li>
                      <li>মেনুটি স্ক্রোল করে নিচের দিকে যান এবং <span className="font-bold text-emerald-700">Add to Home Screen</span> অপশনটি বেছে নিন।</li>
                      <li>উপরে ডান কোণায় <span className="font-bold text-emerald-700">Add</span> বাটনে চাপ দিন।</li>
                    </ol>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-gray-800">অ্যান্ড্রয়েড/ক্রোম ব্যবহারকারীদের জন্য:</p>
                    <p>সরাসরি ইনস্টল প্রম্পটটি সচল হতে কিছু মুহূর্ত সময় লাগতে পারে। আপনি নিচের পদ্ধতিতে ইনস্টল করতে পারেন:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>ব্রাউজারের উপরের ডানদিকের <span className="font-bold">৩ ডট (মেনু)</span>-এ প্রেস করুন।</li>
                      <li><span className="font-bold text-emerald-700">Install app</span> অথবা <span className="font-bold text-emerald-700">Add to Home screen</span>-এ ক্লিক করুন।</li>
                    </ol>
                  </div>
                )}

                <div className="p-2.5 bg-emerald-50 border border-emerald-100/80 rounded-xl text-emerald-800 text-[10.5px]">
                  ইনস্টল করার পর আপনার মোবাইলের হোম স্ক্রিন থেকে কোনো ক্রোম/ব্রাউজার ওপেন করা ছাড়াই সরাসরি অ্যাপ হিসেবে যেকোনো সময় ব্যবহার করতে পারবেন।
                </div>
              </div>

              {/* Action Close */}
              <button
                onClick={() => setShowTooltip(false)}
                className="w-full bg-gray-800 hover:bg-gray-950 text-white font-bold py-1.5 rounded-lg text-xs tracking-wide transition cursor-pointer border-none shadow-md mt-1"
              >
                বুঝেছি
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
