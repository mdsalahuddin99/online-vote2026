// নির্বাচন ও ডেমো ভোটার এবং প্রার্থী ডেটা
export const ELECTION_SETTINGS = {
  title: "মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন",
  term: "২০২৬-২০২৮ সেশন",
  organizer: "কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি",
  startTime: "2026-10-11T08:00:00",
  endTime: "2026-10-15T20:00:00",
  status: "ongoing", // "upcoming", "ongoing", "ended"
  totalRegisteredVoters: 0,
  hotline: "০১৭১২-৩৪৫৬৭৮",
  email: "election@modelmosque-imams.org"
};

// নির্বাচনের ৫টি গুরুত্বপূর্ণ পদ
export const POSTS = [
  {
    id: "president",
    title: "সভাপতি",
    subtitle: "কেন্দ্রীয় কার্যনির্বাহী কমিটি",
    icon: "Crown",
    description: "সংগঠনের সামগ্রিক নেতৃত্ব, সমন্বয় ও অভিভাবকত্ব প্রদান।"
  },
  {
    id: "secretary",
    title: "মহাসচিব (সেক্রেটারি)",
    subtitle: "কেন্দ্রীয় কার্যনির্বাহী কমিটি",
    icon: "FileText",
    description: "সংগঠনের প্রশাসনিক কার্যক্রম, সিদ্ধান্ত বাস্তবায়ন ও যোগাযোগ পরিচালনা।"
  },
  {
    id: "org_secretary",
    title: "সাংগঠনিক সম্পাদক",
    subtitle: "কেন্দ্রীয় কার্যনির্বাহী কমিটি",
    icon: "Users",
    description: "৮ বিভাগের সকল মডেল মসজিদের সাংগঠনিক শৃঙ্খলা ও নেটওয়ার্কিং বিস্তার।"
  },
  {
    id: "treasurer",
    title: "অর্থ সম্পাদক",
    subtitle: "কেন্দ্রীয় কার্যনির্বাহী কমিটি",
    icon: "Wallet",
    description: "সংগঠনের আর্থিক হিসাব-নিকাশ, তহবিল ব্যবস্থাপনা ও স্বচ্ছতা বজায় রাখা।"
  },
  {
    id: "office_secretary",
    title: "দপ্তর সম্পাদক",
    subtitle: "কেন্দ্রীয় কার্যনির্বাহী কমিটি",
    icon: "Building",
    description: "কেন্দ্রীয় কার্যালয় ব্যবস্থাপনা, নথিপত্র সংরক্ষণ ও দাপ্তরিক চিঠিপত্র প্রদান।"
  }
];

// পদভিত্তিক ১২ জন সম্মানিত প্রার্থীর তালিকা
export const CANDIDATES = [
  // ১. সভাপতি পদ (২ জন)
  {
    id: "c_pres_1",
    postId: "president",
    name: "মুফতি আহমদ মাসরুর",
    mosque: "ভাঙ্গা মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "ফরিদপুর (ভাঙ্গা)",
    division: "ঢাকা",
    votesCount: 0
  },
  {
    id: "c_pres_2",
    postId: "president",
    name: "মুফতি মুখলেসুর রহমান",
    mosque: "ব্রাহ্মণবাড়িয়া জেলা মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "ব্রাহ্মণবাড়িয়া",
    division: "চট্টগ্রাম",
    votesCount: 0
  },

  // ২. মহাসচিব (সেক্রেটারি) পদ (২ জন)
  {
    id: "c_sec_1",
    postId: "secretary",
    name: "মুফতি তরিকুল ইসলাম",
    mosque: "সিরাজগঞ্জ জেলা মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "সিরাজগঞ্জ",
    division: "রাজশাহী",
    votesCount: 0
  },
  {
    id: "c_sec_2",
    postId: "secretary",
    name: "মুফতি আহসানুল্লাহ কাসেমী",
    mosque: "ঈশ্বরগঞ্জ মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "ময়মনসিংহ (ঈশ্বরগঞ্জ)",
    division: "ময়মনসিংহ",
    votesCount: 0
  },

  // ৩. সাংগঠনিক সম্পাদক পদ (২ জন)
  {
    id: "c_org_1",
    postId: "org_secretary",
    name: "মুফতি রেজাউল করিম",
    mosque: "ভোলা জেলা মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "ভোলা",
    division: "বরিশাল",
    votesCount: 0
  },
  {
    id: "c_org_2",
    postId: "org_secretary",
    name: "মুফতি ওয়াহিদুজ্জামান",
    mosque: "কালিয়া মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "নড়াইল (কালিয়া)",
    division: "খুলনা",
    votesCount: 0
  },

  // ৪. অর্থ সম্পাদক পদ (৩ জন)
  {
    id: "c_tres_1",
    postId: "treasurer",
    name: "মুফতি নাঈমুল ইসলাম",
    mosque: "বরিশাল বিভাগীয় মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "বরিশাল",
    division: "বরিশাল",
    votesCount: 0
  },
  {
    id: "c_tres_2",
    postId: "treasurer",
    name: "মুফতি ইব্রাহিম আজহারী",
    mosque: "গাইবান্ধা জেলা মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "গাইবান্ধা",
    division: "রংপুর",
    votesCount: 0
  },
  {
    id: "c_tres_3",
    postId: "treasurer",
    name: "মুফতি মফিজুর রহমান",
    mosque: "সিলেট বিভাগীয় মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "সিলেট",
    division: "সিলেট",
    votesCount: 0
  },

  // ৫. দপ্তর সম্পাদক পদ (৩ জন)
  {
    id: "c_off_1",
    postId: "office_secretary",
    name: "মাওলানা মাকসুদুল আমিন",
    mosque: "ফরিদগঞ্জ মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "চাঁদপুর (ফরিদগঞ্জ)",
    division: "চট্টগ্রাম",
    votesCount: 0
  },
  {
    id: "c_off_2",
    postId: "office_secretary",
    name: "মুফতি আবু বকর সিদ্দিক",
    mosque: "নাটোর জেলা মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "নাটোর",
    division: "রাজশাহী",
    votesCount: 0
  },
  {
    id: "c_off_3",
    postId: "office_secretary",
    name: "হাফেজ মাওলানা মহিউদ্দিন",
    mosque: "আগৈলঝাড়া মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র",
    district: "বরিশাল (আগৈলঝাড়া)",
    division: "বরিশাল",
    votesCount: 0
  }
];

// ভোটার ডেটাবেজ (অ্যাডমিন প্যানেল থেকে CSV আপলোড বা ডাটাবেজের মাধ্যমে যুক্ত হবে)
export const INITIAL_VOTERS = [];

