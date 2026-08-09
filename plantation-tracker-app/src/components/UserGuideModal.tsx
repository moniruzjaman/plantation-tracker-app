/**
 * In-app User Guide modal — comprehensive Bengali guide for every tab.
 *
 * Renders as a full-screen overlay (mobile) / large centered modal (desktop)
 * with a sticky chapter index, collapsible accordion sections, and the
 * project's emerald/teal theme. Source content mirrors USER_GUIDE.md.
 *
 * Opened from ProfilePage via the "টিউটোরিয়াল" button.
 */

import React, { useState, useMemo, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Search,
  Smartphone,
  Map as MapIcon,
  ClipboardList,
  LayoutDashboard,
  UserCircle,
  Sparkles,
  Cloud,
  Shield,
  Coins,
  Wrench,
  Sprout,
  Satellite,
  Database,
  CloudOff,
} from 'lucide-react';

// ---------- Chapter definitions ----------

interface GuideSection {
  id: string;
  title: string;
  body: JSX.Element;
}

interface GuideChapter {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
  sections: GuideSection[];
}

// ---------- Reusable sub-components ----------

function Pill({ children, tone = 'emerald' }: { children: React.ReactNode; tone?: 'emerald' | 'sky' | 'amber' | 'rose' }) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Callout({ tone, title, children }: { tone: 'emerald' | 'sky' | 'amber'; title: string; children: React.ReactNode }) {
  const tones: Record<string, { bg: string; border: string; title: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', title: 'text-sky-800' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-800' },
  };
  const t = tones[tone];
  return (
    <div className={`rounded-lg ${t.bg} border ${t.border} p-2.5 my-2`}>
      <div className={`text-[11px] font-bold ${t.title} mb-1`}>{title}</div>
      <div className="text-[11px] text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

function GuideTable({ headers, rows }: { headers: string[]; rows: (string | JSX.Element)[][] }) {
  return (
    <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="bg-emerald-700 text-white">
            {headers.map((h, i) => (
              <th key={i} className="text-left p-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              {row.map((cell, j) => (
                <td key={j} className="p-2 border-t border-slate-100 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-slate-100 text-pink-700 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>;
}

// ---------- Chapter content ----------

const CHAPTERS: GuideChapter[] = [
  {
    id: 'install',
    number: '০১',
    title: 'প্রথম ইনস্টল ও অ্যাকাউন্ট',
    icon: <Smartphone size={14} />,
    sections: [
      {
        id: 'install-app',
        title: 'অ্যাপ ইনস্টল',
        body: (
          <p>অ্যাপটি একটি PWA (Progressive Web App) এবং Android অ্যাপ হিসেবে উপলব্ধ। ব্রাউজার থেকে সরাসরি ব্যবহার করা যায়, অথবা হোম স্ক্রিনে ইনস্টল করা যায়। প্রথমবার খোলার সময় একটি ওয়েলকাম মডাল দেখায় যা অ্যাপের উদ্দেশ্য ও মূল ফিচার পরিচয় করিয়ে দেয়। অ্যাপটি অফলাইন-ফার্স্ট, তাই ইন্টারনেট ছাড়াই ফর্ম পূরণ ও সংরক্ষণ করা যায় — সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হয়।</p>
        ),
      },
      {
        id: 'install-bootstrap',
        title: 'ইমেল ভিত্তিক অটো-বুটস্ট্র্যাপ',
        body: (
          <>
            <p>অ্যাপ ইনস্টল হওয়ার পর প্রথমবার, এটি সার্ভারের <Code>seed/admins.json</Code> allow-list ফেচ করে। যদি আপনার ইমেল allow-list-এ থাকে (অর্থাৎ আপনি অ্যাডমিন, ক্যাডার, বা SAAO হিসেবে পূর্ব-নির্ধারিত), তাহলে অ্যাপ স্বয়ংক্রিয়ভাবে আপনার প্রোফাইল তৈরি করবে — নাম, মোবাইল, পদবি, জেলা, ও উপজেলা allow-list থেকে পূর্ব-পূরণ করা হবে। এই ক্ষেত্রে কোনো ম্যানুয়াল ফর্ম পূরণের প্রয়োজন নেই।</p>
            <Callout tone="emerald" title="💡 বিল্ট-ইন ইমেল">
              allow-list-এ প্রথম <code>admin</code> রোলের ইমেলটি "বিল্ট-ইন" ইমেল হিসেবে কাজ করে। প্রথম ইনস্টলে যদি কোনো ইমেল মনে না থাকে, অ্যাপ এই বিল্ট-ইন ইমেল ব্যবহার করে অ্যাপ এক্সপ্লোর করার অনুমতি দেয় — কিন্তু ফর্ম জমা দেওয়ার আগে নাম ও মোবাইল পূরণ বাধ্যতামূলক।
            </Callout>
          </>
        ),
      },
      {
        id: 'install-citizen',
        title: 'নাগরিক ব্যবহারকারী রেজিস্ট্রেশন',
        body: (
          <>
            <p>যদি আপনার ইমেল allow-list-ে না থাকে, তাহলে আপনি নাগরিক (citizen) হিসেবে রেজিস্টার করবেন। নাম ও মোবাইল বাধ্যতামূলক, এবং ঐচ্ছিক ফিল্ডগুলো পূরণ করলে আপনার টোকেন বৃদ্ধি পায়।</p>
            <GuideTable
              headers={['ফিল্ড', 'বাধ্যতামূলক', 'টোকেন']}
              rows={[
                ['নাম', 'হ্যাঁ', '+৫'],
                ['মোবাইল নম্বর', 'হ্যাঁ', '+৫'],
                ['NID (জাতীয় পরিচয়পত্র)', 'ঐচ্ছিক', '+১০'],
                ['Job ID (অফিসার রোলের জন্য)', 'ঐচ্ছিক', '+১০'],
                ['পদবি', 'ঐচ্ছিক', '+৫'],
                ['জেলা', 'ঐচ্ছিক', '+৩'],
                ['উপজেলা', 'ঐচ্ছিক', '+২'],
                [<b>সম্পূর্ণতা বোনাস</b>, '—', <b>+২৫ (এককালীন)</b>],
              ]}
            />
          </>
        ),
      },
      {
        id: 'install-roles',
        title: 'রোল হায়ারার্কি',
        body: (
          <GuideTable
            headers={['রোল', 'ক্লিয়ারেন্স', 'অনুমতি']}
            rows={[
              ['নাগরিক (Citizen)', '০', 'নিজের সাবমিশন জমা, ম্যাপ দেখা, প্রোফাইল ম্যানেজ'],
              ['ফিল্ড অফিসার (SAAO)', '১', 'নিজের ব্লকের সাবমিশন দেখা, ফর্ম পূরণ'],
              ['ক্যাডার (UAO/AEO/AAO)', '১', 'নিজের উপজেলার সকল সাবমিশন দেখা, হেলথ ট্যাব'],
              ['জেলা প্রশাসক', '২', 'জেলার সকল ডেটা ও ইউজার দেখা'],
              ['জাতীয় পরিচালক', '৩', 'পূর্ণ সিস্টেম অ্যাক্সেস, সিড সিঙ্ক, ইউজার ম্যানেজমেন্ট'],
            ]}
          />
        ),
      },
    ],
  },
  {
    id: 'form',
    number: '০২',
    title: 'ফর্ম ট্যাব',
    icon: <ClipboardList size={14} />,
    sections: [
      {
        id: 'form-overview',
        title: 'ফর্ম ট্যাব — বৃক্ষরোপণ তথ্য সংগ্রহ',
        body: <p>ফর্ম ট্যাব হলো অ্যাপের প্রধান ডাটা এন্ট্রি পয়েন্ট। এখানে একটি সাইট ভিজিটে রোপণ করা প্রতিটি চারাগাছের তথ্য ১৭-কলাম সরকারি প্রোফর্মা অনুযায়ী সংগ্রহ করা হয়। ফর্মটি অফলাইনে পূরণ করা যায় এবং ইন্টারনেট সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সার্ভারে সিঙ্ক হয়।</p>,
      },
      {
        id: 'form-mode',
        title: 'এন্ট্রি মোড নির্বাচন',
        body: <p>ফর্মের শীর্ষে দুটি বাটন: <b>DAE অফিসার</b> এবং <b>নাগরিক</b>। আপনার প্রোফাইল রোল অনুযায়ী অ্যাপ স্বয়ংক্রিয়ভাবে সঠিক মোড নির্বাচন করে। DAE অফিসার মোডে SAAO ও মনিটরিং অফিসার ডিরেক্টরি লুকআপ সক্রিয় থাকে; নাগরিক মোডে এই ফিল্ডগুলো ম্যানুয়াল টেক্সট ইনপুট হিসেবে থাকে।</p>,
      },
      {
        id: 'form-location',
        title: 'লোকেশন ক্যাসকেড',
        body: <p>একটি ক্যাসকেডিং ড্রপডাউন সিস্টেমে অঞ্চল → জেলা → উপজেলা → ইউনিয়ন → ব্লক → গ্রাম নির্বাচন করতে হয়। প্রতিটি স্তরের নির্বাচন পরবর্তী স্তরের অপশন ফিল্টার করে। ইউনিয়ন ও ব্লক ফিল্ডে EditableCombobox ব্যবহার করা হয়েছে — অর্থাৎ আপনি টাইপ করে সাজেশন থেকে বাছাই করতে পারেন, অথবা নতুন নাম টাইপ করতে পারেন (যা পেন্ডিং রিভিউ হিসেবে সংরক্ষিত হয়)।</p>,
      },
      {
        id: 'form-gps',
        title: 'GPS কো-অর্ডিনেট',
        body: (
          <>
            <p><b>রোপণ GPS</b> বাটন চাপলে ডিভাইসের বর্তমান লোকেশন স্বয়ংক্রিয়ভাবে ফর্মে পূরণ হয়। স্যাটেলাইট সংকেত গ্রহণে কয়েক সেকেন্ড সময় লাগতে পারে, বিশেষত ভবনের ভেতরে থাকলে। সঠিক ফলাফলের জন্য খোলা আকাশের নিচে দাঁড়িয়ে বাটন চাপুন। সাথে সাথে Nominatim রিভার্স-জিওকোডিং ব্যবহার করে গ্রাম/ইউনিয়ন/জেলা স্বয়ংক্রিয়ভাবে পূরণের চেষ্টা করা হয়।</p>
            <Callout tone="amber" title="⚠ ভেরিফিকেশন GPS">
              <b>ভেরিফিকেশন GPS</b> হলো একটি আলাদা পয়েন্ট যা মনিটরিং অফিসাররা রেকর্ড করেন। এটি রোপণ লোকেশন থেকে কত দূরে তা স্বয়ংক্রিয়ভাবে গণনা করা হয় — ১৫ মিটারের বেশি হলে একটি অ্যাম্বার ফ্ল্যাগ দেখানো হয়।
            </Callout>
          </>
        ),
      },
      {
        id: 'form-species',
        title: 'চারাগাছের প্রজাতি ও সংখ্যা',
        body: <p>প্রতিটি প্রজাতির জন্য একটি রিপিটেবল রো যোগ করা যায়। প্রতিটি রোতে: উদ্ভিদের ধরন (ফলদ/বনজ/ঔষধি), প্রজাতির নাম (ড্রপডাউন বা "+ new entry"), এবং সংখ্যা। যদি এলাকা (বর্গমিটার) পূরণ করা থাকে, অ্যাপ DAE-র স্ট্যান্ডার্ড প্লান্টিং ডিস্ট্যান্স নর্মের সাথে তুলনা করে একটি <Code>spacingFlag</Code> সফট-ফ্ল্যাগ দেখায় — কিন্তু কাউন্ট স্বয়ংক্রিয়ভাবে পরিবর্তন করা হয় না।</p>,
      },
      {
        id: 'form-photo',
        title: 'ফটো প্রমাণ',
        body: <p>প্রতিটি সাবমিশনের সাথে ফটো প্রমাণ যোগ করা যায়। ফটো ক্লায়েন্ট-সাইডে কম্প্রেস করা হয় (~1280px, JPEG 0.65–0.7 কোয়ালিটি, ~80–150KB প্রতি ফটো)। প্রতিটি ফটোর সাথে GPS কো-অর্ডিনেট ও মূল পয়েন্ট থেকে দূরত্ব রেকর্ড করা হয়। একটি SHA-256 হ্যাশ ট্যাম্পার-প্রুফিং নিশ্চিত করে — ফটো পরে অদলবদল করা হলে হ্যাশ পরিবর্তিত হবে।</p>,
      },
      {
        id: 'form-submit',
        title: 'জমা দেওয়া',
        body: <p>সাবমিট বাটন ততক্ষণ পর্যন্ত ডিসেবল থাকে যতক্ষণ না <Code>village</Code>, <Code>upazila</Code>, এবং অন্তত একটি চারা রো পূরণ করা হয়। জমা দেওয়ার পর একটি রিওয়ার্ড টোস্ট দেখানো হয় — XP ও গ্রিন টোকেন সাবমিশনের ডেটা সমৃদ্ধি অনুযায়ী প্রদান করা হয়।</p>,
      },
    ],
  },
  {
    id: 'map',
    number: '০৩',
    title: 'ম্যাপ ট্যাব',
    icon: <MapIcon size={14} />,
    sections: [
      {
        id: 'map-overview',
        title: 'ম্যাপ ট্যাব — NDVI সিমুলেটর ও স্যাটেলাইট ট্র্যাকিং',
        body: <p>ম্যাপ ট্যাব একটি ইন্টারেক্টিভ Leaflet ম্যাপ যা NDVI স্যাটেলাইট ইমেজারি, স্যাটেলাইট ভিউ, ও OpenStreetMap লেয়ার স্যুইচ করতে দেয়। এখানে ৩৬টি সিড প্লান্টেশন সাইট সবুজ সার্কেল মার্কার হিসেবে দেখানো হয় — প্রতিটির উপর হোভার করলে প্রজাতি ও সংখ্যা টুলটিপ দেখায়, ক্লিক করলে সম্পূর্ণ বিস্তারিত পপআপ খোলে।</p>,
      },
      {
        id: 'map-layers',
        title: 'লেয়ার সুইচার',
        body: <p>ম্যাপের উপর-বাম কোণায় একটি পিল-আকৃতির লেয়ার সুইচার: NDVI, EVI, স্যাটেলাইট, ও মানচিত্র। NDVI ও EVI লেয়ার NASA GIBS থেকে আসে (MODIS Terra 8-day composite, ~250m resolution, প্রতি ৮ দিনে আপডেট)। স্যাটেলাইট লেয়ার Esri World Imagery ব্যবহার করে।</p>,
      },
      {
        id: 'map-simulator',
        title: 'NDVI সিমুলেটর প্যানেল',
        body: <p>নিচ-বাম কোণায় "NDVI সিমুলেটর" বাটন চাপলে একটি সাইড প্যানেল খোলে। এই প্যানেলে বছর নির্বাচন (২০২৬ চারা → ২০৩১ পরিপক্ক), গড় NDVI সূচক, ক্যানোপি স্টেজ, প্রাক্কলিত কার্বন শোষণ, কার্বন অফসেট মাত্রা, GEE ক্লাউড ব্যাজ, Sentinel-2 ডেটাসেট কার্ড, ব্যান্ড কম্বিনেশন সিলেক্টর, ক্লাউড ফিল্টার স্লাইডার, GEE কোড এডিটর, লাইভ প্ল্যাটফর্ম লগস, ও ৪-ব্যান্ড NDVI স্কেল লিজেন্ড রয়েছে।</p>,
      },
      {
        id: 'map-realtime',
        title: 'ফ্রি রিয়েলটাইম NDVI',
        body: (
          <>
            <p>"🚀 GEE লাইভ অ্যানালিসিস রান করুন" বাটন চাপলে অ্যাপ <b>NASA GIBS MODIS Terra NDVI 8-Day</b> রাস্টার টাইল ফেচ করে প্রতিটি সিড প্লান্টেশন কো-অর্ডিনেটে। প্রতিটি ২৫৬×২৫৬ পিক্সেল PNG টাইল ডাউনলোড হয়ে ক্যানভাসে ডিকোড করা হয়, সঠিক পিক্সেল স্যাম্পল করে greenness ratio (G−R)/(G+R) গণনা করা হয়, এবং সকল সাইটের গড় NDVI তৈরি হয়।</p>
            <Callout tone="emerald" title="✓ সম্পূর্ণ ফ্রি">
              এই ফিচারটি সম্পূর্ণ ফ্রি — কোনো API কী, অথ, বা বিলিং প্রয়োজন নেই। NASA GIBS একটি পাবলিক, CORS-সক্ষম WMTS এন্ডপয়েন্ট। স্যাম্পলিং সম্পন্ন হলে একটি <b>LIVE · NASA GIBS · FREE</b> ব্যাজ দেখানো হয়।
            </Callout>
          </>
        ),
      },
    ],
  },
  {
    id: 'profile',
    number: '০৪',
    title: 'প্রোফাইল ট্যাব',
    icon: <UserCircle size={14} />,
    sections: [
      {
        id: 'profile-overview',
        title: 'প্রোফাইল ট্যাব — ব্যবহারকারী পরিচয় ও টোকেন',
        body: <p>প্রোফাইল ট্যাবে আপনার পরিচয়, রোল, XP, টোকেন, ও নেটওয়ার্ক স্ট্যাটাস দেখা যায়। এখানে একটি গ্রেডিয়েন্ট এমেরাল্ড ফার্মার্স কার্ড (নাম, রোল ব্যাজ, ID, NID, JobID সহ), রেজিস্ট্রেশন ফর্ম, টোকেন ইকোনমি কার্ড, অ্যাডমিন লিংক (অ্যাডমিন রোলের জন্য), নেটওয়ার্ক ও GPS স্ট্যাটাস, ও রিসেন্ট অ্যাক্টিভিটি রয়েছে।</p>,
      },
      {
        id: 'profile-card',
        title: 'ফার্মার্স কার্ড',
        body: <p>একটি গ্রেডিয়েন্ট এমেরাল্ড কার্ড যা আপনার নাম, রোল ব্যাজ, ID, NID, ও JobID দেখায়। রোল অনুযায়ী ব্যাজ: "নাগরিক কার্ড" বা "SAAO কার্ড"। এখান থেকে এডিট/রেজিস্টার বাটনে ক্লিক করে প্রোফাইল আপডেট করা যায়।</p>,
      },
      {
        id: 'profile-form',
        title: 'রেজিস্ট্রেশন ফর্ম',
        body: <p>নতুন ব্যবহারকারীদের জন্য: নাম + মোবাইল (বাধ্যতামূলক), NID (ঐচ্ছিক +১০ টোকেন), অফিসার হলে Job ID + পদবি, জেলা + উপজেলা। একটি লাইভ প্রিভিউ কার্ড দেখায় যে বর্তমানে কত টোকেন পাবেন। সেভ করলে প্রোফাইল IndexedDB-তে সংরক্ষিত হয় এবং সার্ভারে সিঙ্ক হয়।</p>,
      },
      {
        id: 'profile-network',
        title: 'নেটওয়ার্ক ও GPS',
        body: <p>অনলাইন স্ট্যাটাস, স্টোরেজ এস্টিমেট, বর্তমান GPS কো-অর্ডিনেট (কপি-টু-ক্লিপবোর্ড সহ), ও রুরাল ডেটা সেভার টগল। রুরাল ডেটা সেভার চালু থাকলে অ্যাপ টাইল লোডিং কমিয়ে ডেটা সাশ্রয় করে।</p>,
      },
    ],
  },
  {
    id: 'dashboard',
    number: '০৫',
    title: 'ড্যাশবোর্ড ট্যাব',
    icon: <LayoutDashboard size={14} />,
    sections: [
      {
        id: 'dash-metrics',
        title: 'পরিসংখ্যান ট্যাব',
        body: (
          <>
            <p>আপনার IndexedDB সাবমিশন থেকে সমষ্টিগত পরিসংখ্যান: মোট এন্ট্রি, মোট চারা, বার্ষিক CO₂ শোষণ, এন্ট্রি মোড ব্রেকডাউন, প্রজাতি ও জেলা বিতরণ, ও জাতীয় লক্ষ্যমাত্রা প্রগ্রেস।</p>
            <Callout tone="sky" title="🌱 সিড ডেটা ব্লক">
              Tree Plantation Workbook থেকে এক্সট্র্যাক্ট করা ৩৬টি প্লান্টেশন এন্ট্রির পরিসংখ্যান আলাদা স্কাই-থিম ব্লকে দেখানো হয় — মোট এন্ট্রি (৩৬), মোট চারা (৩,৭৩২), শীর্ষ প্রজাতি, ও জেলা বিতরণ।
            </Callout>
            <Callout tone="emerald" title="💾 ডেটাবেস সিঙ্ক ব্লক">
              অ্যাডমিন হলে একটি "সিড ডেটা ডেটাবেসে পাঠান" বাটন দেখানো হয়। এটি চাপলে ৩৬টি সিড রেকর্ড সার্ভারের Prisma ডেটাবেসে বাল্ক-আপসার্ট হয় (idempotent)।
            </Callout>
          </>
        ),
      },
      {
        id: 'dash-health',
        title: 'স্বাস্থ্য ট্যাব',
        body: (
          <>
            <p>প্রতিটি প্লান্টেশন এন্ট্রির জন্য বৃদ্ধি প্রোগনোসিস: প্রত্যাশিত উচ্চতা, ক্যানোপি রেডিয়াস, সারভাইভাল প্রবাবিলিটি, হেলথ স্টেটাস, রিজিওনাল বেঞ্চমার্ক, পারফরম্যান্স ইনডেক্স, ও সিলভিকালচার অ্যাডভাইজরি।</p>
            <Callout tone="sky" title="🌱 সিড এন্ট্রি ইন্টিগ্রেশন">
              এন্ট্রি সিলেক্টর এখন তিনটি গ্রুপে বিভক্ত: <b>💡 ক্যালকুলেটর</b> (ম্যানুয়াল), <b>🌱 সিড ডেটা</b> (৩৬ টি), <b>📋 আমার এন্ট্রি</b>। একটি সিড এন্ট্রি নির্বাচন করলে একটি সামারি কার্ড দেখায় এবং নিচের গ্রোথ প্রোগনোসিস স্বয়ংক্রিয়ভাবে আপডেট হয়।
            </Callout>
          </>
        ),
      },
      {
        id: 'dash-wealth',
        title: 'পুরস্কার ট্যাব',
        body: <p>লেভেল ও XP কার্ড, কিউমুলেটিভ সাবমিশন রিওয়ার্ড, টোকেন আর্নিং গাইড (১০-সারি রিওয়ার্ড টেবিল), ও ডেটা রিচনেস টিপ।</p>,
      },
    ],
  },
  {
    id: 'ai',
    number: '০৬',
    title: 'AI কো-পাইলট',
    icon: <Sparkles size={14} />,
    sections: [
      {
        id: 'ai-chat',
        title: 'চ্যাট',
        body: <p>বাংলাদেশী বনায়ন, উদ্ভিদ রোগ, নার্সারি ম্যানেজমেন্ট, সার প্রয়োগ, ও চারা রোপণ গাইডলাইন সম্পর্কে প্রশ্ন জিজ্ঞাসা করুন। AI সহজ ও প্রাঞ্জল বাংলায় উত্তর দেয়। মাল্টি-টার্ন কনভার্সেশন সাপোর্টেড।</p>,
      },
      {
        id: 'ai-diagnose',
        title: 'রোগ নির্ণয়',
        body: <p>একটি চারা বা পাতার ছবি আপলোড করুন। AI প্রজাতি চিহ্নিত করে, দৃশ্যমান রোগ/পেস্ট বিশ্লেষণ করে, জৈব/রাসায়নিক সমাধান প্রস্তাব করে, সারের সিডিউল দেয়, ও সাধারণ যত্নের পরামর্শ দেয়।</p>,
      },
    ],
  },
  {
    id: 'offline',
    number: '০৭',
    title: 'অফলাইন মোড ও সিঙ্ক',
    icon: <CloudOff size={14} />,
    sections: [
      {
        id: 'offline-overview',
        title: 'অফলাইন-ফার্স্ট আর্কিটেকচার',
        body: <p>অ্যাপটি অফলাইন-ফার্স্ট। সকল সাবমিশন IndexedDB-তে সংরক্ষিত হয়। ইন্টারনেট সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সার্ভারে সিঙ্ক হয়। নেটওয়ার্ক পুনঃসংযোগ হলে একটি টোস্ট দেখায়: "সিঙ্ক হচ্ছে..." → "Xটি সিঙ্ক সম্পন্ন"। সিঙ্ক ব্যর্থ হলে একটি রিট্রাই বাটন থাকে।</p>,
      },
      {
        id: 'offline-manual',
        title: 'ম্যানুয়াল সিঙ্ক',
        body: <p>ড্যাশবোর্ডে "সিঙ্ক করুন" বাটন চাপলে সকল আনসিঙ্কড সাবমিশন সার্ভারে পাঠানো হয়। প্রতিটি সাবমিশন <Code>clientUid</Code> দ্বারা idempotent — ডুপ্লিকেট সিঙ্ক নিরাপদ।</p>,
      },
    ],
  },
  {
    id: 'admin',
    number: '০৮',
    title: 'অ্যাডমিন গাইড',
    icon: <Shield size={14} />,
    sections: [
      {
        id: 'admin-seed',
        title: 'সিড ডেটা আপডেট',
        body: (
          <>
            <p><Code>seed/Tree_Plantation_Reporting_Workbook.xlsx</Code> ফাইলটি প্রতিস্থাপন করুন (একই নামে) এবং রান করুন:</p>
            <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] font-mono overflow-x-auto my-2">python3 scripts/build_seed_data.py</pre>
            <p>এটি <Code>src/data/seedPlantations.ts</Code> ও <Code>src/data/seedPlantations.json</Code> রিজেনারেট করবে। তিনটি ফাইল কমিট করুন।</p>
          </>
        ),
      },
      {
        id: 'admin-allowlist',
        title: 'অ্যাডমিন allow-list আপডেট',
        body: (
          <>
            <p><Code>seed/admins.json</Code> ফাইলে নতুন ইউজার যোগ করুন:</p>
            <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] font-mono overflow-x-auto my-2">{`{
  "email": "new.officer@dae.gov.bd",
  "role": "cadre",
  "name": "নতুন অফিসার",
  "mobile": "017XXXXXXXX",
  "designation": "UAO",
  "district": "কুড়িগ্রাম",
  "upazila": "উলিপুর"
}`}</pre>
            <p>সার্ভার রিস্টার্ট হলে allow-list রিলোড হয়। ইউজার অ্যাপ খুললে স্বয়ংক্রিয়ভাবে তার প্রোফাইল তৈরি হবে।</p>
          </>
        ),
      },
      {
        id: 'admin-api',
        title: 'API এন্ডপয়েন্ট',
        body: (
          <GuideTable
            headers={['এন্ডপয়েন্ট', 'মেথড', 'বর্ণনা']}
            rows={[
              [<Code>/api/auth/bootstrap</Code>, 'GET', 'পাবলিক allow-list ফেচ'],
              [<Code>/api/auth/profile</Code>, 'POST', 'প্রোফাইল আপসার্ট (টোকেন বোনাস সহ)'],
              [<Code>/api/auth/me</Code>, 'GET', 'ইমেল দিয়ে প্রোফাইল ফেচ'],
              [<Code>/api/users</Code>, 'GET', 'ইউজার লিস্ট (অ্যাডমিন/ক্যাডার)'],
              [<Code>/api/seed/sync-status</Code>, 'GET', 'সর্বশেষ সিড সিঙ্ক স্ট্যাটাস'],
              [<Code>/api/seed/sync</Code>, 'POST', 'সিড বাল্ক-আপসার্ট (অ্যাডমিন)'],
              [<Code>/api/sync</Code>, 'POST', 'সাবমিশন সিঙ্ক'],
              [<Code>/api/ai/chat</Code>, 'POST', 'Gemini AI চ্যাট'],
              [<Code>/api/ai/diagnose</Code>, 'POST', 'Gemini AI ইমেজ নির্ণয়'],
            ]}
          />
        ),
      },
    ],
  },
  {
    id: 'tokens',
    number: '০৯',
    title: 'টোকেন ও XP পুরস্কার',
    icon: <Coins size={14} />,
    sections: [
      {
        id: 'tokens-profile',
        title: 'প্রোফাইল পুরস্কার',
        body: (
          <GuideTable
            headers={['ফিল্ড', 'টোকেন']}
            rows={[
              ['নাম', '+৫'],
              ['মোবাইল', '+৫'],
              ['NID', '+১০'],
              ['Job ID', '+১০'],
              ['পদবি', '+৫'],
              ['জেলা', '+৩'],
              ['উপজেলা', '+২'],
              [<b>সম্পূর্ণতা বোনাস</b>, <b>+২৫ (এককালীন)</b>],
            ]}
          />
        ),
      },
      {
        id: 'tokens-submission',
        title: 'সাবমিশন পুরস্কার',
        body: (
          <GuideTable
            headers={['ফিল্ড', 'XP', 'টোকেন']}
            rows={[
              ['ফর্ম বেস', '১০', '২'],
              ['সম্পূর্ণ লোকেশন', '৫', '৩'],
              ['সুনির্দিষ্ট GPS', '৫', '২'],
              ['ভেরিফিকেশন GPS', '৮', '৩'],
              ['প্রতি প্রজাতি', '৩', '১'],
              ['প্রতি ফটো', '৫', '২'],
              ['পরিচর্যাকারী', '৩', '১'],
              ['SAAO', '৫', '২'],
              ['মনিটরিং অফিসার', '৫', '২'],
            ]}
          />
        ),
      },
      {
        id: 'tokens-seed',
        title: 'সিড সিঙ্ক পুরস্কার',
        body: (
          <GuideTable
            headers={['অ্যাকশন', 'XP', 'টোকেন']}
            rows={[
              ['প্রতি সিড রেকর্ড সিঙ্ক', '+২', 'প্রতি ৫টিতে +১'],
            ]}
          />
        ),
      },
      {
        id: 'tokens-level',
        title: 'লেভেল সিস্টেম',
        body: <p>প্রতি ১০০ XP = ১ লেভেল। লেভেল প্রোগ্রেস বার প্রোফাইল ও ড্যাশবোর্ডে দেখানো হয়।</p>,
      },
    ],
  },
  {
    id: 'troubleshoot',
    number: '১০',
    title: 'সমস্যা সমাধান',
    icon: <Wrench size={14} />,
    sections: [
      {
        id: 'troubleshoot-map',
        title: 'ম্যাপ টাইল লোড হচ্ছে না',
        body: (
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>ইন্টারনেট সংযোগ চেক করুন</li>
            <li>রুরাল ডেটা সেভার বন্ধ করে দেখুন (প্রোফাইল ট্যাব)</li>
            <li>লেয়ার সুইচ করে OSM-এ চলে যান — যদি OSM লোড হয় কিন্তু NDVI না হয়, তাহলে NASA GIBS সার্ভার সমস্যা</li>
          </ul>
        ),
      },
      {
        id: 'troubleshoot-gps',
        title: 'GPS কাজ করছে না',
        body: (
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>ব্রাউজার লোকেশন পারমিশন চেক করুন</li>
            <li>খোলা আকাশের নিচে যান</li>
            <li>ডিভাইস রিস্টার্ট করুন</li>
          </ul>
        ),
      },
      {
        id: 'troubleshoot-sync',
        title: 'সিঙ্ক ব্যর্থ হচ্ছে',
        body: (
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>সার্ভার চালু আছে কিনা চেক করুন (<Code>/api/health</Code>)</li>
            <li>নেটওয়ার্ক স্ট্যাটাস ইন্ডিকেটর দেখুন</li>
            <li>ম্যানুয়াল রিট্রাই বাটন চাপুন</li>
          </ul>
        ),
      },
      {
        id: 'troubleshoot-ndvi',
        title: 'NDVI সিমুলেটর রিয়েলটাইম স্যাম্পল ব্যর্থ',
        body: (
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>NASA GIBS সার্ভার সময়ে সময়ে ডাউন থাকে — কয়েক মিনিট পরে আবার চেষ্টা করুন</li>
            <li>CORS এরর হলে ব্রাউজার আপডেট করুন</li>
            <li>ফায়ারওয়ালে <Code>gibs.earthdata.nasa.gov</Code> ব্লক করা আছে কিনা চেক করুন</li>
          </ul>
        ),
      },
    ],
  },
];

// ---------- Accordion chapter ----------

function AccordionChapter({ chapter, defaultOpen }: { chapter: GuideChapter; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold">
          {chapter.number}
        </span>
        <span className="flex-shrink-0 text-emerald-600">{chapter.icon}</span>
        <span className="flex-1 text-[12.5px] font-bold text-slate-800">{chapter.title}</span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0.5 space-y-3">
              {chapter.sections.map((s) => (
                <div key={s.id}>
                  <h4 className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    {s.title}
                  </h4>
                  <div className="text-[11.5px] text-slate-700 leading-relaxed pl-3">
                    {s.body}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Main modal ----------

interface UserGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UserGuideModal({ open, onClose }: UserGuideModalProps) {
  const [search, setSearch] = useState('');

  const filteredChapters = useMemo(() => {
    if (!search.trim()) return CHAPTERS;
    const q = search.toLowerCase().trim();
    return CHAPTERS.map((ch) => ({
      ...ch,
      sections: ch.sections.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        ch.title.toLowerCase().includes(q)
      ),
    })).filter((ch) => ch.sections.length > 0);
  }, [search]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000]"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 md:inset-y-0 md:left-auto md:right-0 z-[2001]
                       h-[90vh] md:h-full w-full md:w-[520px] lg:w-[580px]
                       bg-white rounded-t-2xl md:rounded-none shadow-2xl
                       flex flex-col overflow-hidden border-t md:border-l border-slate-200"
          >
            {/* Handle (mobile) */}
            <div className="md:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
              <span className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-800 to-teal-850 text-white">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="bg-emerald-700/60 rounded-lg p-1.5 flex-shrink-0 mt-0.5">
                    <BookOpen size={16} className="text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-tight">ব্যবহারকারী গাইড</h3>
                    <p className="text-[10px] text-emerald-200/90 mt-0.5 leading-tight">
                      প্রতিটি ট্যাব ও ফিচারের বিস্তারিত নির্দেশিকা
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-emerald-700/60 transition-colors flex-shrink-0"
                  aria-label="বন্ধ করুন"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-200/70" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="অধ্যায় বা বিভাগ খুঁজুন..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-600/40 text-white text-[11px] placeholder-emerald-200/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Chapter quick-jump chips */}
            <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
              <div className="flex gap-1.5">
                {CHAPTERS.map((ch) => (
                  <a
                    key={ch.id}
                    href={`#guide-ch-${ch.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(`guide-ch-${ch.id}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 text-[10px] font-semibold text-slate-600 transition-colors"
                  >
                    <span className="text-emerald-500">{ch.icon}</span>
                    <span>{ch.title}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Body — scrollable chapters */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 form-scroll-area">
              {filteredChapters.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Search size={24} className="mx-auto mb-2 opacity-40" />
                  <p>কোনো ফলাফল পাওয়া যায়নি</p>
                  <p className="text-[10px] mt-1">অন্য শব্দ দিয়ে চেষ্টা করুন</p>
                </div>
              ) : (
                filteredChapters.map((ch, i) => (
                  <div key={ch.id} id={`guide-ch-${ch.id}`}>
                    <AccordionChapter chapter={ch} defaultOpen={i === 0 && !search} />
                  </div>
                ))
              )}

              {/* Footer */}
              <div className="pt-3 pb-2 text-center">
                <p className="text-[9px] text-slate-400 leading-relaxed">
                  সংস্করণ ২.১.০ · জুলাই ২০২৬<br />
                  বাংলাদেশ কৃষি সম্প্রসারণ অধিদপ্তর (DAE)
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
