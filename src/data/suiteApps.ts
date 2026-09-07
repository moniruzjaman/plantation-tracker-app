// Quick-access links to the wider DAE / KrishiAI AgriTech tool suite.
// Shown in the "More Apps" tab of the mobile control center drawer.

export interface SuiteApp {
  id: string;
  nameBn: string;
  nameEn: string;
  url: string;
  descriptionBn: string;
  descriptionEn: string;
}

export const SUITE_APPS: SuiteApp[] = [
  {
    id: 'krishi-ai',
    nameBn: 'কৃষি এআই',
    nameEn: 'Krishi AI',
    url: 'https://krishiai.live/',
    descriptionBn: 'কৃষক সহায়ক এআই অ্যাসিস্ট্যান্ট',
    descriptionEn: 'AI assistant for farmers',
  },
  {
    id: 'krishi-ai-web',
    nameBn: 'কৃষি এআই ওয়েব প্ল্যাটফর্ম',
    nameEn: 'KrishiAI Web Platform',
    url: 'https://web.krishiai.live/',
    descriptionBn: 'কৃষি এআই এর ওয়েব সংস্করণ',
    descriptionEn: 'Web version of Krishi AI',
  },
  {
    id: 'plant-detective',
    nameBn: 'উদ্ভিদ গোয়েন্দা',
    nameEn: 'Plant Detective',
    url: 'https://cabi.krishiai.live/',
    descriptionBn: 'ফসলের রোগ নির্ণয় সরঞ্জাম',
    descriptionEn: 'Crop disease diagnosis tool',
  },
  {
    id: 'plantation-tracker',
    nameBn: 'বৃক্ষরোপণ ট্র্যাকার',
    nameEn: 'Plantation Tracker',
    url: 'https://plantation.krishiai.live/',
    descriptionBn: 'বৃক্ষরোপণ পর্যবেক্ষণ ড্যাশবোর্ড',
    descriptionEn: 'Tree plantation monitoring dashboard',
  },
  {
    id: 'kurigram-nursery-2026',
    nameBn: 'কুড়িগ্রাম নার্সারি ২০২৬',
    nameEn: 'Kurigram Nursery 2026',
    url: 'https://kurigram-nursery-2026.vercel.app/',
    descriptionBn: 'নার্সারি রিপোর্টিং সিস্টেম',
    descriptionEn: 'Nursery reporting system',
  },
  {
    id: 'producer-register',
    nameBn: 'কৃষক নিবন্ধন',
    nameEn: 'Producer Register',
    url: 'https://producer-register.vercel.app/',
    descriptionBn: 'কৃষক নিবন্ধন সিস্টেম',
    descriptionEn: 'Farmer registration system',
  },
  {
    id: 'krishak-card',
    nameBn: 'কৃষক কার্ড',
    nameEn: 'Krishak Card',
    url: 'https://krishak-card.vercel.app/',
    descriptionBn: 'কৃষক পরিচিতি কার্ড সিস্টেম',
    descriptionEn: 'Farmer ID card system',
  },
  {
    id: 'kurigram-nursery-registry',
    nameBn: 'কুড়িগ্রাম নার্সারি রেজিস্ট্রি',
    nameEn: 'Kurigram Nursery Registry',
    url: 'https://kurigram-nursery-registry.vercel.app/',
    descriptionBn: 'নার্সারি নিবন্ধন তালিকা',
    descriptionEn: 'Nursery registration registry',
  },
  {
    id: 'shared-drive',
    nameBn: 'শেয়ার্ড ড্রাইভ',
    nameEn: 'Shared Drive',
    url: 'https://drive.google.com/drive/folders/19H6X9JbmS83XhyJVHdxn_pvfwTH64_QR',
    descriptionBn: 'রিসোর্স ও নথিপত্র',
    descriptionEn: 'Resources and documents',
  },
];
