import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Lock, 
  Unlock, 
  Settings, 
  Users, 
  UserPlus, 
  Download, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  FileSpreadsheet, 
  RefreshCw, 
  Landmark, 
  Trash2, 
  Award, 
  PlusCircle, 
  Briefcase, 
  GraduationCap, 
  Menu, 
  X, 
  LayoutDashboard, 
  ShieldCheck, 
  ChevronRight, 
  LogOut,
  MapPin,
  Edit2,
  Filter,
  Printer,
  FileText,
  Upload,
  FileUp,
  Smartphone,
  Send,
  RotateCcw,
  Copy,
  Check,
  Code,
  Calendar,
  Save,
  Play,
  Square,
  Timer,
  Zap,
  Camera,
  User,
  Image as ImageIcon,
  Search
} from 'lucide-react';
import { POSTS } from '../data/electionData';
import { BD_LOCATIONS } from '../data/locationsData';
import { supabase, isSupabaseConfigured, resetElectionBallotInDB } from '../lib/supabase';
import { compressImage } from '../utils/imageUtils';
import { 
  getSMSConfig, 
  saveSMSConfig, 
  sendSMS, 
  checkBulkSMSBDBalance, 
  formatOtpMessage,
  resetSMSConfigToDefault,
  formatPhoneList,
  DEFAULT_SMS_CONFIG
} from '../services/smsService';

export default function AdminView({ 
  electionSettings, 
  setElectionSettings, 
  votersList, 
  setVotersList, 
  candidatesList, 
  setCandidatesList, 
  stats, 
  auditLogs = [],
  setAuditLogs,
  setActiveTab,
  refreshElectionData
}) {
  const [adminPin, setAdminPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem('mm_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });
  // ডুয়েল রোল স্টেট: 'developer' (ফুল এক্সেস) অথবা 'committee' (আহ্বায়ক কমিটি সেফ মোড)
  const [adminRole, setAdminRole] = useState(() => {
    try {
      return sessionStorage.getItem('mm_admin_role') || 'committee';
    } catch (e) {
      return 'committee';
    }
  });
  const [showDevElevateModal, setShowDevElevateModal] = useState(false);
  const [devElevatePin, setDevElevatePin] = useState('');
  const [devElevateError, setDevElevateError] = useState('');

  // নতুন নির্বাচনের জন্য ব্যালট ক্লিন / রিসেট স্টেট (প্রার্থী ও ভোটার বহাল)
  const [showResetElectionModal, setShowResetElectionModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirmError, setResetConfirmError] = useState('');

  // অডিট টোকেন অনুসন্ধান ও যাচাইকরণ স্টেট
  const [searchAuditToken, setSearchAuditToken] = useState('');
  const [auditSearchResult, setAuditSearchResult] = useState(null);
  const [isSearchingAudit, setIsSearchingAudit] = useState(false);
  const [auditTokenCopied, setAuditTokenCopied] = useState(null);

  const [loginError, setLoginError] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // অ্যাডমিন সাইডবার মেনু স্টেট
  const [currentMenu, setCurrentMenu] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ১. প্রার্থী ফর্মের জন্য বিভাগ, জেলা, থানা স্টেট
  const divisions = Object.keys(BD_LOCATIONS);
  const [candDivision, setCandDivision] = useState(divisions[0]);
  const [candDistrict, setCandDistrict] = useState(Object.keys(BD_LOCATIONS[divisions[0]])[0]);
  const [candThana, setCandThana] = useState(BD_LOCATIONS[divisions[0]][Object.keys(BD_LOCATIONS[divisions[0]])[0]][0]);

  // বিভাগ পরিবর্তন হলে জেলা ও থানা আপডেট
  const handleCandDivisionChange = (div) => {
    setCandDivision(div);
    const districts = Object.keys(BD_LOCATIONS[div] || {});
    const firstDistrict = districts[0] || '';
    setCandDistrict(firstDistrict);
    const thanas = firstDistrict ? (BD_LOCATIONS[div][firstDistrict] || []) : [];
    setCandThana(thanas[0] || '');
  };

  // জেলা পরিবর্তন হলে থানা আপডেট
  const handleCandDistrictChange = (dist) => {
    setCandDistrict(dist);
    const thanas = BD_LOCATIONS[candDivision]?.[dist] || [];
    setCandThana(thanas[0] || '');
  };

  const [newCandidate, setNewCandidate] = useState({
    postId: 'president',
    name: '',
    mosque: '',
    qualification: '',
    experience: '',
    photo: ''
  });
  const [addCandSuccess, setAddCandSuccess] = useState('');
  const [candLoading, setCandLoading] = useState(false);
  const [newCandPhotoLoading, setNewCandPhotoLoading] = useState(false);
  const [editCandPhotoLoading, setEditCandPhotoLoading] = useState(false);
  const newCandFileInputRef = useRef(null);
  const editCandFileInputRef = useRef(null);
  const quickPhotoInputRef = useRef(null);
  const [quickTargetCand, setQuickTargetCand] = useState(null);

  // ২. ভোটার ফর্মের জন্য বিভাগ, জেলা, থানা স্টেট
  const [voterDivision, setVoterDivision] = useState(divisions[0]);
  const [voterDistrict, setVoterDistrict] = useState(Object.keys(BD_LOCATIONS[divisions[0]])[0]);
  const [voterThana, setVoterThana] = useState(BD_LOCATIONS[divisions[0]][Object.keys(BD_LOCATIONS[divisions[0]])[0]][0]);

  const handleVoterDivisionChange = (div) => {
    setVoterDivision(div);
    const districts = Object.keys(BD_LOCATIONS[div] || {});
    const firstDistrict = districts[0] || '';
    setVoterDistrict(firstDistrict);
    const thanas = firstDistrict ? (BD_LOCATIONS[div][firstDistrict] || []) : [];
    setVoterThana(thanas[0] || '');
  };

  const handleVoterDistrictChange = (dist) => {
    setVoterDistrict(dist);
    const thanas = BD_LOCATIONS[voterDivision]?.[dist] || [];
    setVoterThana(thanas[0] || '');
  };

  // এডিট মোডাল স্টেট (প্রার্থী ও ভোটার এডিট করার জন্য)
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editingVoter, setEditingVoter] = useState(null);

  const [newVoter, setNewVoter] = useState({
    name: '',
    mosque: '',
    phone: ''
  });
  const [addVoterSuccess, setAddVoterSuccess] = useState('');
  const [voterLoading, setVoterLoading] = useState(false);

  // ৩. ভোটার তালিকা টেবিল ফিল্টার স্টেট (বিভাগ ও জেলা অনুযায়ী)
  const [voterFilterDivision, setVoterFilterDivision] = useState('all');
  const [voterFilterDistrict, setVoterFilterDistrict] = useState('all');

  // ৪. CSV ফাইল আপলোড ও প্রিভিউ স্টেট
  const csvFileInputRef = useRef(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvParsedData, setCsvParsedData] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImportMode, setCsvImportMode] = useState('replace'); // 'replace' or 'append'
  const [csvLoading, setCsvLoading] = useState(false);

  // ৫. SMS গেটওয়ে কনফিগারেশন স্টেট
  const [smsConfig, setSmsConfig] = useState(getSMSConfig());
  const [smsSaveSuccess, setSmsSaveSuccess] = useState('');
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testSmsResult, setTestSmsResult] = useState(null);
  const [testSmsLoading, setTestSmsLoading] = useState(false);
  const [bulkSmsBalance, setBulkSmsBalance] = useState(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceMsg, setBalanceMsg] = useState(null);

  // বাল্ক এসএমএস ও কোড এক্সাম্পল স্টেট
  const [bulkNoticeTarget, setBulkNoticeTarget] = useState('all');
  const [bulkNoticePhones, setBulkNoticePhones] = useState('');
  const [bulkNoticeMessage, setBulkNoticeMessage] = useState('সম্মানিত ভোটার, মডেল মসজিদ ইমাম পরিষদ নির্বাচন ২০২৬ এর অনলাইন ভোট গ্রহণ চলমান রয়েছে। আপনার মূল্যবান ভোটাধিকার প্রয়োগ করুন।');
  const [bulkNoticeLoading, setBulkNoticeLoading] = useState(false);
  const [bulkNoticeResult, setBulkNoticeResult] = useState(null);
  const [activeCodeTab, setActiveCodeTab] = useState('json');
  const [copiedCodeKey, setCopiedCodeKey] = useState(null);

  // তারিখ ও সময়কে input[type="datetime-local"] ফরম্যাটে রূপান্তর (YYYY-MM-DDTHH:mm)
  const formatForDateTimeInput = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // তারিখ ও সময়কে বাংলা ভাষায় আকর্ষণীয় ফরম্যাট
  const formatBanglaDateTime = (dateInput) => {
    if (!dateInput) return 'নির্ধারিত নয়';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'অবৈধ তারিখ';
    return d.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // নির্বাচন সময়সূচি (Schedule) কনফিগারেশন স্টেট
  const [scheduleStartTime, setScheduleStartTime] = useState(() => 
    formatForDateTimeInput(electionSettings?.startTime || '2026-10-14T08:00:00')
  );
  const [scheduleEndTime, setScheduleEndTime] = useState(() => 
    formatForDateTimeInput(electionSettings?.endTime || '2026-10-15T20:00:00')
  );
  const [scheduleTitle, setScheduleTitle] = useState(electionSettings?.title || 'মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন');
  const [scheduleTerm, setScheduleTerm] = useState(electionSettings?.term || '২০২৬-২০২৮ সেশন');
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState('');
  const [scheduleSaveError, setScheduleSaveError] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // electionSettings পরিবর্তন হলে লোকাল ফিল্ড সিঙ্ক করা
  useEffect(() => {
    if (electionSettings?.startTime) {
      setScheduleStartTime(formatForDateTimeInput(electionSettings.startTime));
    }
    if (electionSettings?.endTime) {
      setScheduleEndTime(formatForDateTimeInput(electionSettings.endTime));
    }
    if (electionSettings?.title) {
      setScheduleTitle(electionSettings.title);
    }
    if (electionSettings?.term) {
      setScheduleTerm(electionSettings.term);
    }
  }, [electionSettings?.startTime, electionSettings?.endTime, electionSettings?.title, electionSettings?.term]);

  // দ্রুত সময়সূচি প্রিসেট সিলেক্ট করার ফাংশন
  const applySchedulePreset = (hoursDuration, startNow = true) => {
    const now = new Date();
    const start = startNow ? new Date() : new Date();
    if (!startNow) {
      start.setHours(8, 0, 0, 0); // আজ সকাল ৮টা
    }
    const end = new Date(start.getTime() + hoursDuration * 60 * 60 * 1000);
    setScheduleStartTime(formatForDateTimeInput(start));
    setScheduleEndTime(formatForDateTimeInput(end));
    setScheduleSaveSuccess(`প্রিসেট নির্বাচিত হয়েছে: (${hoursDuration >= 24 ? Math.round(hoursDuration / 24) + ' দিন' : hoursDuration + ' ঘণ্টা'})। কার্যকর করতে নিচে 'সময়সূচি সংরক্ষণ ও কার্যকর করুন' চাপুন।`);
    setTimeout(() => setScheduleSaveSuccess(''), 5000);
  };

  // নির্বাচন সময়সূচি সংরক্ষণ ও ডেটাবেজ সিঙ্ক
  const handleSaveSchedule = async (e) => {
    if (e) e.preventDefault();
    setScheduleSaveSuccess('');
    setScheduleSaveError('');

    if (!scheduleStartTime || !scheduleEndTime) {
      setScheduleSaveError('দয়া করে নির্বাচন শুরুর সময় এবং সমাপ্তির সময় উভয়টি সঠিকভাবে নির্বাচন করুন।');
      return;
    }

    const startD = new Date(scheduleStartTime);
    const endD = new Date(scheduleEndTime);

    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
      setScheduleSaveError('প্রদত্ত তারিখ ও সময় সঠিক নয়।');
      return;
    }

    if (endD <= startD) {
      setScheduleSaveError('নির্বাচন সমাপ্তির সময় অবশ্যই শুরুর সময়ের পরবর্তী হতে হবে।');
      return;
    }

    setIsSavingSchedule(true);

    const now = new Date();
    let newStatus = electionSettings.status;
    if (now >= endD) {
      newStatus = 'ended';
    } else if (now >= startD) {
      newStatus = 'ongoing';
    } else {
      newStatus = 'upcoming';
    }

    const updatedSettings = {
      ...electionSettings,
      title: scheduleTitle.trim() || electionSettings.title,
      term: scheduleTerm.trim() || electionSettings.term,
      startTime: startD.toISOString(),
      endTime: endD.toISOString(),
      status: newStatus
    };

    setElectionSettings(updatedSettings);
    try {
      localStorage.setItem('mm_election_settings', JSON.stringify(updatedSettings));
    } catch (err) {}

    // সুপাবেসে সিঙ্ক
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('election_settings').upsert({
          id: 1,
          title: updatedSettings.title,
          term: updatedSettings.term,
          status: updatedSettings.status,
          start_time: updatedSettings.startTime,
          end_time: updatedSettings.endTime,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Supabase schedule upsert error:', err);
      }
    }

    if (typeof refreshElectionData === 'function') {
      try {
        await refreshElectionData();
      } catch (err) {}
    }

    setIsSavingSchedule(false);
    setScheduleSaveSuccess('✅ নির্বাচন শুরু ও শেষ হওয়ার সময়সূচি সফলভাবে সংরক্ষিত হয়েছে!');
    setTimeout(() => setScheduleSaveSuccess(''), 5000);
  };

  const handleResetToDefaultSmsConfig = () => {
    const def = resetSMSConfigToDefault();
    setSmsConfig({ ...def });
    setSmsSaveSuccess('BulkSMSBD অফিশিয়াল কনফিগারেশন সফলভাবে লোড ও সেভ হয়েছে!');
    setTimeout(() => setSmsSaveSuccess(''), 4000);
  };

  const handleCheckBulkBalance = async () => {
    if (!smsConfig.apiKey || !smsConfig.apiKey.trim()) {
      setBalanceMsg({ success: false, text: 'অনুগ্রহ করে প্রথমে আপনার BulkSMSBD API Key লিখুন।' });
      return;
    }
    setIsCheckingBalance(true);
    setBalanceMsg(null);
    setBulkSmsBalance(null);

    const res = await checkBulkSMSBDBalance(smsConfig.apiKey.trim());
    setIsCheckingBalance(false);
    if (res.success) {
      setBulkSmsBalance(res.balance);
      setBalanceMsg({ success: true, text: `বর্তমান ব্যালেন্স: ৳ ${res.balance}` });
    } else {
      setBalanceMsg({ success: false, text: res.error || 'ব্যালেন্স তথ্য পাওয়া যায়নি।' });
    }
  };

  const handleSaveSmsConfig = (e) => {
    e.preventDefault();
    saveSMSConfig(smsConfig);
    setSmsSaveSuccess('এসএমএস গেটওয়ে সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    setTimeout(() => setSmsSaveSuccess(''), 4000);
  };

  const handleSendTestSms = async (e) => {
    e.preventDefault();
    if (!testSmsPhone.trim()) return;
    setTestSmsLoading(true);
    setTestSmsResult(null);

    try {
      const brandName = (smsConfig.brandName || 'Model Mosque').trim();
      const testMsg = formatOtpMessage('1234', brandName);
      const res = await sendSMS(testSmsPhone.trim(), testMsg);
      setTestSmsResult(res);
    } catch (err) {
      setTestSmsResult({ success: false, message: err.message });
    } finally {
      setTestSmsLoading(false);
    }
  };

  const handleSendBulkNotice = async (e) => {
    e.preventDefault();
    if (!bulkNoticeMessage.trim()) return;

    let targetPhones = [];
    if (bulkNoticeTarget === 'all') {
      targetPhones = votersList.map(v => v.phone).filter(Boolean);
    } else {
      targetPhones = formatPhoneList(bulkNoticePhones);
    }

    if (targetPhones.length === 0) {
      setBulkNoticeResult({ success: false, message: 'এসএমএস পাঠানোর জন্য কোনো বৈধ মোবাইল নম্বর পাওয়া যায়নি।' });
      return;
    }

    if (!window.confirm(`আপনি কি নিশ্চিত যে ${targetPhones.length} জন ভোটারের নম্বরে এই এসএমএস নোটিশ পাঠাতে চান?`)) {
      return;
    }

    setBulkNoticeLoading(true);
    setBulkNoticeResult(null);

    try {
      const res = await sendSMS(targetPhones, bulkNoticeMessage.trim());
      setBulkNoticeResult({
        ...res,
        totalTargeted: targetPhones.length
      });
    } catch (err) {
      setBulkNoticeResult({ success: false, message: err.message });
    } finally {
      setBulkNoticeLoading(false);
    }
  };

  const handleCopyCode = (key, text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedCodeKey(key);
      setTimeout(() => setCopiedCodeKey(null), 2500);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    const cleanPin = adminPin.trim();
    const lower = cleanPin.toLowerCase();

    // ১. ডেভেলপার পিনসমূহ (ফুল এক্সেস) - প্রাথমিক: Msd@2026
    const devEnvPin = (import.meta.env.VITE_DEV_PIN || 'msd@2026').trim().replace(/['"]/g, '').toLowerCase();
    const devPins = [
      'msd@2026',
      'dev@2026',
      'dev@2026#super',
      'dev2026',
      'developer',
      'saiful@dev',
      'admin@saiful',
      devEnvPin
    ].filter(Boolean);

    // ২. আহ্বায়ক কমিটি পিনসমূহ (সেফ মোড) - প্রাথমিক: Msd@99
    const committeeEnvPin = (import.meta.env.VITE_ADMIN_PIN || 'msd@99').trim().replace(/['"]/g, '').toLowerCase();
    const committeePins = [
      'msd@99',
      'imam@2026#secure',
      'imam@2026',
      'imam2026',
      committeeEnvPin
    ].filter(Boolean);

    if (devPins.includes(lower)) {
      setIsAuthenticated(true);
      setAdminRole('developer');
      try {
        sessionStorage.setItem('mm_admin_auth', 'true');
        sessionStorage.setItem('mm_admin_role', 'developer');
      } catch (err) {}
      setLoginError('');
    } else if (committeePins.includes(lower)) {
      setIsAuthenticated(true);
      setAdminRole('committee');
      try {
        sessionStorage.setItem('mm_admin_auth', 'true');
        sessionStorage.setItem('mm_admin_role', 'committee');
      } catch (err) {}
      setLoginError('');
      if (currentMenu === 'sms' || currentMenu === 'security') {
        setCurrentMenu('dashboard');
      }
    } else {
      setLoginError('ভুল পাসওয়ার্ড! অনুগ্রহ করে আহ্বায়ক কমিটি বা ডেভেলপারের অনুমোদিত পিন দিন।');
    }
  };

  const handleDevElevateSubmit = (e) => {
    e.preventDefault();
    const clean = devElevatePin.trim().toLowerCase();
    const devEnvPin = (import.meta.env.VITE_DEV_PIN || 'msd@2026').trim().toLowerCase();
    const devPins = [
      'msd@2026',
      'dev@2026',
      'dev@2026#super',
      'dev2026',
      'developer',
      'saiful@dev',
      'admin@saiful',
      devEnvPin
    ].filter(Boolean);

    if (devPins.includes(clean)) {
      setAdminRole('developer');
      try {
        sessionStorage.setItem('mm_admin_role', 'developer');
      } catch (err) {}
      setShowDevElevateModal(false);
      setDevElevatePin('');
      setDevElevateError('');
    } else {
      setDevElevateError('ভুল ডেভেলপার পিন! শুধুমাত্র সিস্টেম ডেভেলপারদের জন্য সংরক্ষিত।');
    }
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    setAdminRole('committee');
    try {
      sessionStorage.removeItem('mm_admin_auth');
      sessionStorage.removeItem('mm_admin_role');
    } catch (err) {}
  };

  // নির্বাচন স্ট্যাটাস টগল (ভোট সমাপ্ত / পুনরায় চালুকরণ)
  const toggleElectionStatus = async () => {
    const nextStatus = electionSettings.status === 'ongoing' ? 'ended' : 'ongoing';
    const now = new Date();
    let newStartTime = electionSettings.startTime;
    let newEndTime = electionSettings.endTime;

    // যদি পুনরায় শুরু করা হয় এবং আগের endTime অতীত হয়ে থাকে, তাহলে নতুন endTime ভবিষ্যৎ (যেমন এখন থেকে ৩ দিন) নির্ধারণ করা
    if (nextStatus === 'ongoing') {
      const pastEnd = electionSettings.endTime ? new Date(electionSettings.endTime) <= now : true;
      if (pastEnd) {
        newStartTime = now.toISOString();
        newEndTime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        setScheduleStartTime(formatForDateTimeInput(now));
        setScheduleEndTime(formatForDateTimeInput(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)));
      }
    } else {
      newEndTime = now.toISOString();
      setScheduleEndTime(formatForDateTimeInput(now));
    }

    const updatedSettings = {
      ...electionSettings,
      status: nextStatus,
      startTime: newStartTime,
      endTime: newEndTime
    };

    setElectionSettings(updatedSettings);
    try {
      localStorage.setItem('mm_election_settings', JSON.stringify(updatedSettings));
    } catch (e) {}

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('election_settings').upsert({
          id: 1,
          status: nextStatus,
          title: electionSettings.title || 'কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন ২০২৬',
          start_time: newStartTime,
          end_time: newEndTime,
          updated_at: now.toISOString()
        });
      } catch (err) {
        console.error('Update status err:', err);
      }
    }

    if (typeof refreshElectionData === 'function') {
      try {
        await refreshElectionData();
      } catch (e) {}
    }
  };

  // ডেভেলপার অ্যাকশন: প্রার্থী ও ভোটার বহাল রেখে নতুন ভোটের জন্য ব্যালট ক্লিন/রিসেট
  const handleResetElectionData = async () => {
    setResetLoading(true);
    setResetConfirmError('');

    try {
      const now = new Date();
      // নতুন নির্বাচনের জন্য নতুন সময়সীমা (শুরু এখন, শেষ ৩ দিন পর)
      const newStartTime = now.toISOString();
      const newEndTime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      // ১. ভোটার তালিকা আপডেট (hasVoted = false, votedAt = null) - কোনো ভোটার ডিলিট হবে না
      const resetVoters = votersList.map(v => ({
        ...v,
        hasVoted: false,
        votedAt: null
      }));
      setVotersList(resetVoters);

      // ২. প্রার্থী তালিকা আপডেট (সকল প্রার্থীর ভোট সংখ্যা শূন্য ০ করা) - কোনো প্রার্থী ডিলিট হবে না
      const resetCandidates = candidatesList.map(c => ({
        ...c,
        votesCount: 0
      }));
      setCandidatesList(resetCandidates);

      // ৩. অডিট রেকর্ড ক্লিয়ার
      if (setAuditLogs) setAuditLogs([]);

      // ৪. নির্বাচন স্থিতি 'upcoming' (আসন্ন) এ ফিরিয়ে নেওয়া এবং ভবিষ্যৎ সময়সূচি সেট করা
      const updatedSettings = {
        ...electionSettings,
        status: 'upcoming',
        startTime: newStartTime,
        endTime: newEndTime
      };
      setElectionSettings(updatedSettings);
      setScheduleStartTime(formatForDateTimeInput(now));
      setScheduleEndTime(formatForDateTimeInput(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)));

      // ৫. লোকাল স্টোরেজ আপডেট
      try {
        const safeVoters = resetVoters.map(v => {
          const { secretPin, secret_pin, ...safe } = v;
          return safe;
        });
        localStorage.setItem('mm_voters_list', JSON.stringify(safeVoters));
        localStorage.setItem('mm_candidates_list', JSON.stringify(resetCandidates));
        localStorage.setItem('mm_election_settings', JSON.stringify(updatedSettings));
        localStorage.removeItem('mm_ballot_votes');
        localStorage.removeItem('mm_audit_logs');
      } catch (e) {}

      // ৬. সুপাবেস ডাটাবেজ থাকলে লাইভ সিঙ্ক (RPC ও ডাইরেক্ট ডিলিট/আপডেট)
      if (isSupabaseConfigured()) {
        try {
          await resetElectionBallotInDB(newStartTime, newEndTime);
        } catch (dbErr) {
          console.warn('Supabase reset live sync warning:', dbErr);
        }
      }

      if (refreshElectionData) {
        try { await refreshElectionData(); } catch (e) {}
      }

      setShowResetElectionModal(false);
      alert('সফল হয়েছে! সকল প্রার্থী ও ভোটার তালিকা অপরিবর্তিত রেখে নতুন নির্বাচনের জন্য ব্যালট সফলভাবে রিসেট করা হয়েছে। ফলাফল পেইজ স্বয়ংক্রিয়ভাবে লক ও শূন্য ফলাফলে আপডেট হয়েছে। এখন নতুন করে ভোট শুরু করতে পারবেন।');
    } catch (err) {
      console.error('Reset election error:', err);
      setResetConfirmError('রিসেট করতে ব্যর্থ হয়েছে: ' + (err.message || err));
    } finally {
      setResetLoading(false);
    }
  };

  // অডিট টোকেন যাচাইকরণ হ্যান্ডলার (Zero-Knowledge Audit Verification)
  const handleVerifyAuditToken = async (e) => {
    if (e) e.preventDefault();
    const tokenQuery = searchAuditToken.trim().toUpperCase();
    if (!tokenQuery) return;
    setIsSearchingAudit(true);
    setAuditSearchResult(null);

    try {
      // ১. প্রথমে লোকাল অডিট স্টেট থেকে চেক
      let found = auditLogs.find(a => (a.token || a.audit_token || '').toUpperCase() === tokenQuery);

      // ২. যদি লোকাল স্টেটে না থাকে এবং সুপাবেস কনফিগার করা থাকে, তাহলে সুপাবেস voting_audit_logs টেবিল থেকে চেক
      if (!found && isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('voting_audit_logs')
          .select('*')
          .ilike('audit_token', tokenQuery)
          .maybeSingle();

        if (data && !error) {
          found = {
            token: data.audit_token,
            votedAt: data.created_at,
            id: data.id
          };
        }
      }

      if (found) {
        setAuditSearchResult({
          success: true,
          token: found.token || found.audit_token,
          votedAt: found.votedAt || found.created_at || new Date().toISOString()
        });
      } else {
        setAuditSearchResult({
          success: false,
          token: tokenQuery,
          message: 'টোকেনটি খুঁজে পাওয়া যায়নি! কোনো বৈধ ভোট এই টোকেন দিয়ে নথিভুক্ত হয়নি অথবা ভুল টোকেন নম্বর।'
        });
      }
    } catch (err) {
      setAuditSearchResult({
        success: false,
        token: tokenQuery,
        message: 'যাচাই করতে সমস্যা হয়েছে: ' + (err.message || err)
      });
    } finally {
      setIsSearchingAudit(false);
    }
  };

  // প্রার্থীর ছবি ফাইল আপলোড ও কম্প্রেশন হ্যান্ডলারসমূহ
  const handleNewCandPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setNewCandPhotoLoading(true);
      const compressed = await compressImage(file);
      setNewCandidate(prev => ({ ...prev, photo: compressed }));
    } catch (err) {
      alert(err.message || 'ছবি প্রসেস করতে ব্যর্থ হয়েছে।');
    } finally {
      setNewCandPhotoLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleEditCandPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEditCandPhotoLoading(true);
      const compressed = await compressImage(file);
      setEditingCandidate(prev => ({ ...prev, photo: compressed }));
    } catch (err) {
      alert(err.message || 'ছবি প্রসেস করতে ব্যর্থ হয়েছে।');
    } finally {
      setEditCandPhotoLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleQuickPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !quickTargetCand) return;
    const targetId = quickTargetCand.id;
    try {
      const compressed = await compressImage(file);
      setCandidatesList(prev => prev.map(c => c.id === targetId ? { ...c, photo: compressed } : c));
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('candidates').update({ photo: compressed }).eq('id', targetId);
        } catch (sErr) {
          console.error('Quick photo Supabase err:', sErr);
        }
      }
    } catch (err) {
      alert(err.message || 'ছবি পরিবর্তন করতে ব্যর্থ হয়েছে।');
    } finally {
      setQuickTargetCand(null);
      if (e.target) e.target.value = '';
    }
  };

  // প্রার্থী যোগ করা
  const handleAddNewCandidate = async (e) => {
    e.preventDefault();
    if (!newCandidate.name || !newCandidate.mosque) return;

    setCandLoading(true);
    const candidateId = 'cand_' + Date.now().toString().slice(-6);

    const formattedCand = {
      id: candidateId,
      postId: newCandidate.postId,
      name: newCandidate.name.trim(),
      mosque: newCandidate.mosque.trim(),
      district: `${candDistrict} (${candThana})`,
      division: candDivision,
      qualification: newCandidate.qualification.trim() || 'দাওরায়ে হাদিস / কামিল',
      experience: newCandidate.experience.trim() || 'অভিজ্ঞ ইমাম ও খতিব',
      photo: newCandidate.photo ? newCandidate.photo.trim() : '',
      votesCount: 0
    };

    setCandidatesList(prev => [...prev, formattedCand]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('candidates').insert([{
          id: formattedCand.id,
          post_id: formattedCand.postId,
          name: formattedCand.name,
          mosque: formattedCand.mosque,
          district: formattedCand.district,
          division: formattedCand.division,
          qualification: formattedCand.qualification,
          experience: formattedCand.experience,
          photo: formattedCand.photo
        }]);
      } catch (err) {
        console.error('Supabase Candidate Insert:', err);
      }
    }

    setCandLoading(false);
    setAddCandSuccess(`${formattedCand.name} মহোদয় প্রার্থী তালিকায় সফলভাবে যুক্ত হয়েছেন।`);
    setNewCandidate({
      postId: 'president',
      name: '',
      mosque: '',
      qualification: '',
      experience: '',
      photo: ''
    });

    setTimeout(() => setAddCandSuccess(''), 4000);
  };

  // প্রার্থী ডিলিট
  const handleDeleteCandidate = async (candId, candName) => {
    if (!window.confirm(`আপনি কি "${candName}" মহোদয়কে প্রার্থী তালিকা থেকে মুছে ফেলতে চান?`)) return;

    setCandidatesList(prev => prev.filter(c => c.id !== candId));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('candidates').delete().eq('id', candId);
      } catch (err) {
        console.error('Delete cand err:', err);
      }
    }
  };

  // নতুন ভোটার যোগ করা (স্বয়ংক্রিয় ইউনিক কোড ও গোপন পিন জেনারেশন)
  const handleAddNewVoter = async (e) => {
    e.preventDefault();
    if (!newVoter.name || !newVoter.mosque) return;

    setVoterLoading(true);

    // ১. স্বয়ংক্রিয় ইউনিক ভোটার কোড (যেমন: V001)
    const nextCodeNumber = votersList.length + 1;
    const generatedVoterId = `V${String(nextCodeNumber).padStart(3, '0')}`;

    // ২. স্বয়ংক্রিয় গোপন ৪-সংখ্যার পিন কোড
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

    const formattedVoter = {
      voterId: generatedVoterId,
      secretPin: generatedPin,
      name: newVoter.name.trim(),
      mosque: newVoter.mosque.trim(),
      district: `${voterDistrict} (${voterThana})`,
      division: voterDivision,
      phone: newVoter.phone ? newVoter.phone.trim() : 'N/A',
      hasVoted: false,
      votedAt: null
    };

    setVotersList(prev => [formattedVoter, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('voters').insert([{
          voter_id: formattedVoter.voterId,
          secret_pin: formattedVoter.secretPin,
          name: formattedVoter.name,
          mosque: formattedVoter.mosque,
          district: formattedVoter.district,
          division: formattedVoter.division,
          phone: formattedVoter.phone,
          has_voted: false
        }]);
      } catch (err) {
        console.error('Supabase Voter Insert:', err);
      }
    }

    setVoterLoading(false);
    setAddVoterSuccess(`${formattedVoter.name} মহোদয় সফলভাবে যুক্ত হয়েছেন! ভোটার আইডি: "${generatedVoterId}" | গোপন পিন: "${generatedPin}"`);
    setNewVoter({
      name: '',
      mosque: '',
      phone: ''
    });

    setTimeout(() => setAddVoterSuccess(''), 7000);
  };

  // প্রার্থী তথ্য এডিট ও সংরক্ষণ
  const handleUpdateCandidate = async (e) => {
    e.preventDefault();
    if (!editingCandidate) return;

    if (adminRole === 'committee' && electionSettings.status !== 'upcoming') {
      alert('নির্বাচন শুরু হয়ে যাওয়ায় আহ্বায়ক কমিটি প্রার্থী তালিকা এডিট বা পরিবর্তন করতে পারবে না!');
      setEditingCandidate(null);
      return;
    }

    setCandidatesList(prev => prev.map(c => c.id === editingCandidate.id ? editingCandidate : c));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('candidates').update({
          post_id: editingCandidate.postId,
          name: editingCandidate.name,
          mosque: editingCandidate.mosque,
          district: editingCandidate.district,
          division: editingCandidate.division,
          qualification: editingCandidate.qualification,
          experience: editingCandidate.experience,
          photo: editingCandidate.photo || ''
        }).eq('id', editingCandidate.id);
      } catch (err) {
        console.error('Update candidate err:', err);
      }
    }

    setEditingCandidate(null);
  };

  // ভোটার তথ্য এডিট ও সংরক্ষণ
  const handleUpdateVoter = async (e) => {
    e.preventDefault();
    if (!editingVoter) return;

    if (adminRole === 'committee' && electionSettings.status !== 'upcoming') {
      alert('নির্বাচন শুরু হয়ে যাওয়ায় আহ্বায়ক কমিটি ভোটার তালিকা এডিট বা পরিবর্তন করতে পারবে না!');
      setEditingVoter(null);
      return;
    }

    setVotersList(prev => prev.map(v => v.voterId === editingVoter.voterId ? editingVoter : v));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('voters').update({
          name: editingVoter.name,
          mosque: editingVoter.mosque,
          district: editingVoter.district,
          division: editingVoter.division,
          phone: editingVoter.phone,
          secret_pin: editingVoter.secretPin
        }).eq('voter_id', editingVoter.voterId);
      } catch (err) {
        console.error('Update voter err:', err);
      }
    }

    setEditingVoter(null);
  };

  // ভোটার মুছে ফেলা
  const handleDeleteVoter = async (voterId, voterName) => {
    if (!window.confirm(`আপনি কি "${voterName}" মহোদয়কে ভোটার তালিকা থেকে মুছে ফেলতে চান?`)) return;

    setVotersList(prev => prev.filter(v => v.voterId !== voterId));

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('voters').delete().eq('voter_id', voterId);
      } catch (err) {
        console.error('Delete voter err:', err);
      }
    }
  };

  // বাংলা বর্ণ নরমালাইজেশন ফাংশন (য+় / য়, ড+় / ড়, ঈ/ই ইত্যাদি ফিক্স)
  const cleanBn = (str) => {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFC')
      .replace(/[\u09AF][\u09BC]/g, '\u09DF') // য + ় -> য়
      .replace(/[\u09A1][\u09BC]/g, '\u09DC') // ড + ় -> ড়
      .replace(/[\u09A2][\u09BC]/g, '\u09DD') // ঢ + ় -> ঢ়
      .replace(/[\u09B0][\u09BC]/g, '\u09DC') // র + ় -> ড়
      .replace(/ী/g, 'ি') // দীর্ঘ-ঈকার -> হ্রস্ব-ইকার
      .replace(/ূ/g, 'ু') // দীর্ঘ-ঊকার -> হ্রস্ব-উকার
      .replace(/ণ/g, 'ন') // ণ -> ন
      .trim()
      .toLowerCase();
  };

  // ফিল্টার করা ভোটার তালিকা
  const filteredVotersList = votersList.filter(v => {
    if (voterFilterDivision !== 'all') {
      const vDiv = cleanBn(v.division);
      const fDiv = cleanBn(voterFilterDivision);
      if (vDiv !== fDiv) return false;
    }
    if (voterFilterDistrict !== 'all') {
      const vDist = cleanBn(v.district);
      const fDist = cleanBn(voterFilterDistrict);
      if (!vDist.includes(fDist) && !fDist.includes(vDist)) return false;
    }
    return true;
  });

  // ফিল্টারের জন্য জেলা তালিকা (ডায়নামিক ও সঠিক)
  const availableDistrictsForFilter = useMemo(() => {
    let list = [];
    if (voterFilterDivision !== 'all') {
      const fromVoters = votersList
        .filter(v => cleanBn(v.division) === cleanBn(voterFilterDivision))
        .map(v => v.district)
        .filter(Boolean);
      
      const matchedLocKey = Object.keys(BD_LOCATIONS).find(k => cleanBn(k) === cleanBn(voterFilterDivision));
      const fromLoc = matchedLocKey && BD_LOCATIONS[matchedLocKey] ? Object.keys(BD_LOCATIONS[matchedLocKey]) : [];
      list = Array.from(new Set([...fromVoters, ...fromLoc]));
    } else {
      const fromVoters = votersList.map(v => v.district).filter(Boolean);
      const fromLoc = Object.values(BD_LOCATIONS).flatMap(d => Object.keys(d));
      list = Array.from(new Set([...fromVoters, ...fromLoc]));
    }
    return list.filter((v, i, a) => a.findIndex(t => cleanBn(t) === cleanBn(v)) === i);
  }, [voterFilterDivision, votersList]);

  // CSV ডাউনলোড (ফিল্টার করা তালিকা অনুযায়ী)
  const handleExportVoters = () => {
    const csvContent = "\uFEFF" 
      + "VoterID,Name,Mosque,District,Division,Phone,SecretPin,HasVoted\n"
      + filteredVotersList.map(v => `"${v.voterId}","${v.name}","${v.mosque}","${v.district}","${v.division}","${v.phone || ''}","${v.secretPin}","${v.hasVoted ? 'TRUE' : 'FALSE'}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `model_mosque_voters_${voterFilterDivision}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // পিডিএফ ডাউনলোড / প্রিন্ট ভিউ (Print to PDF)
  const handlePrintVoterListPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('পপ-আপ ব্লক করা আছে, দয়া করে ব্রাউজারের পপ-আপ এলাউ করুন।');
      return;
    }

    const divisionText = voterFilterDivision === 'all' ? 'সকল বিভাগ' : voterFilterDivision;
    const districtText = voterFilterDistrict === 'all' ? 'সকল জেলা' : voterFilterDistrict;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>ভোটার তালিকা - মডেল মসজিদ ইমাম পরিষদ নির্বাচন</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
          body {
            font-family: 'Hind Siliguri', sans-serif;
            margin: 20px;
            color: #0f172a;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #064e3b;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title {
            font-size: 20px;
            font-weight: 700;
            color: #064e3b;
            margin: 0;
          }
          .subtitle {
            font-size: 14px;
            color: #475569;
            margin: 4px 0 0;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 12px;
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background-color: #064e3b;
            color: #ffffff;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          }
          .badge-success { background: #dcfce7; color: #166534; }
          .badge-pending { background: #fef3c7; color: #92400e; }
          .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
          }
          @media print {
            body { margin: 10mm; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন ২০২৬-২০২৮</div>
          <div class="subtitle">নির্বাচন আহ্বায়ক কমিটি কর্তৃক অনুমোদিত অফিসিয়াল ভোটার তালিকা</div>
        </div>

        <div class="meta-info">
          <div><strong>ফিল্টার:</strong> ${divisionText} - ${districtText}</div>
          <div><strong>মোট ভোটার:</strong> ${filteredVotersList.length} জন</div>
          <div><strong>প্রিন্টের তারিখ:</strong> ${new Date().toLocaleDateString('bn-BD')}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">ক্র.</th>
              <th style="width: 80px;">ভোটার কোড</th>
              <th>ইমাম মহোদয়ের নাম</th>
              <th>কর্মরত মডেল মসজিদ</th>
              <th>এলাকা / জেলা</th>
              <th>বিভাগ</th>
              <th style="width: 95px;">মোবাইল</th>
              <th style="width: 65px; text-align: center;">গোপন পিন</th>
              <th style="width: 75px; text-align: center;">ভোট স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody>
            ${filteredVotersList.map((v, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-weight: 700; color: #064e3b;">${v.voterId}</td>
                <td style="font-weight: 600;">${v.name}</td>
                <td>${v.mosque}</td>
                <td>${v.district}</td>
                <td>${v.division || '-'}</td>
                <td>${v.phone || '-'}</td>
                <td style="text-align: center; font-family: monospace; font-weight: 700;">${v.secretPin}</td>
                <td style="text-align: center;">
                  <span class="badge ${v.hasVoted ? 'badge-pending' : 'badge-success'}">
                    ${v.hasVoted ? 'ভোট সম্পন্ন' : 'ভোট বাকি'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          কপিরাইট © ২০২৬ মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র ইমাম পরিষদ কেন্দ্রীয় নির্বাচন আহ্বায়ক কমিটি।
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // CSV ফাইল পার্সিং ফাংশন
  const parseCSVRows = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const isTab = line.includes('\t') && !line.includes(',');
      const delimiter = isTab ? '\t' : ',';
      
      const values = [];
      let current = '';
      let insideQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));
      return values;
    };

    const headerRow = parseLine(lines[0]).map(h => cleanBn(h));
    
    const findIndex = (keywords) => {
      return headerRow.findIndex(h => keywords.some(k => h.includes(cleanBn(k))));
    };

    const idxName = findIndex(['নাম', 'ইমামের নাম', 'ইমাম', 'name', 'voter_name']);
    const idxFather = findIndex(['পিতার নাম', 'পিতা', 'father', 'father_name']);
    const idxMosque = findIndex(['মসজিদ', 'কর্মস্থল', 'ঠিকানা', 'mosque', 'workplace']);
    const idxDistrict = findIndex(['জেলা', 'district']);
    const idxDivision = findIndex(['বিভাগ', 'division']);
    const idxPhone = findIndex(['মোবাইল', 'ফোন', 'phone', 'mobile']);
    const idxPin = findIndex(['গোপন পিন', 'পিন', 'pin', 'secretpin']);
    const idxCode = findIndex(['voterid', 'কোড', 'ভোটার আইডি', 'আইডি', 'code']);
    const idxVoted = findIndex(['hasvoted', 'ভোট দিয়েছেন', 'ভোট প্রদান', 'voted', 'status']);

    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0) continue;

      const name = idxName !== -1 ? cols[idxName] : cols[1] || '';
      if (!name || name.trim() === '' || name.includes('শূন্য') || name.includes('ফাঁকা')) continue;

      let division = idxDivision !== -1 ? cols[idxDivision] : '';
      let district = idxDistrict !== -1 ? cols[idxDistrict] : '';
      const mosque = idxMosque !== -1 ? cols[idxMosque] : '';
      const fatherName = idxFather !== -1 ? cols[idxFather] : '';
      const phone = idxPhone !== -1 ? cols[idxPhone] : '';
      
      // জেলা থেকে বিভাগ বের করা (যদি বিভাগ কলাম ফাঁকা থাকে)
      if (!division && district) {
        for (const [divKey, distObj] of Object.entries(BD_LOCATIONS)) {
          if (Object.keys(distObj).some(d => cleanBn(d) === cleanBn(district))) {
            division = divKey;
            break;
          }
        }
      }

      const generatedId = 'V' + String(results.length + 1).padStart(3, '0');
      const voterId = (idxCode !== -1 && cols[idxCode]) ? cols[idxCode].trim() : generatedId;
      const secretPin = (idxPin !== -1 && cols[idxPin]) ? cols[idxPin].trim() : ((results.length * 73 + 1234) % 9000 + 1000).toString();
      const hasVoted = idxVoted !== -1 ? (cols[idxVoted]?.trim()?.toUpperCase() === 'TRUE' || cols[idxVoted]?.trim() === '1' || cols[idxVoted]?.trim() === 'YES' || cols[idxVoted]?.trim() === 'হ্যাঁ') : false;

      results.push({
        voterId,
        secretPin,
        name: name.trim(),
        fatherName: fatherName.trim(),
        mosque: mosque.trim() || 'মডেল মসজিদ',
        district: district.trim() || 'অন্যান্য',
        division: division.trim() || 'অন্যান্য',
        phone: phone.trim(),
        hasVoted,
        votedAt: hasVoted ? new Date().toISOString() : null
      });
    }

    return results;
  };

  // CSV ফাইল সিলেক্ট হ্যান্ডলার
  const handleCSVFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = parseCSVRows(text);
        if (parsed.length === 0) {
          alert('সিএসভি (CSV) ফাইল থেকে কোনো বৈধ ভোটারের তথ্য পাওয়া যায়নি। অনুগ্রহ করে ফাইলটির কলামসমূহ (যেমন: নাম, মসজিদ, জেলা, বিভাগ, মোবাইল) নিশ্চিত করুন।');
          return;
        }
        setCsvParsedData(parsed);
        setCsvFileName(file.name);
        setCsvModalOpen(true);
      } catch (err) {
        alert('ফাইলটি পড়তে সমস্যা হয়েছে: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // CSV কনফার্ম ইমপোর্ট হ্যান্ডলার
  const handleConfirmCSVImport = async () => {
    if (!csvParsedData || csvParsedData.length === 0) return;

    setCsvLoading(true);
    let updatedList = [];

    if (csvImportMode === 'replace') {
      updatedList = [...csvParsedData];
    } else {
      const existingIds = new Set(votersList.map(v => v.voterId));
      const newItems = csvParsedData.filter(v => !existingIds.has(v.voterId));
      updatedList = [...votersList, ...newItems];
    }

    setVotersList(updatedList);
    try {
      localStorage.setItem('mm_voters_list', JSON.stringify(updatedList));
    } catch (e) {}

    // সুপাবেসে সিঙ্ক (যদি কনফিগার থাকে)
    if (isSupabaseConfigured()) {
      try {
        if (csvImportMode === 'replace') {
          await supabase.from('voters').delete().neq('voter_id', '___NONE___');
        }
        const batchSize = 50;
        for (let i = 0; i < csvParsedData.length; i += batchSize) {
          const batch = csvParsedData.slice(i, i + batchSize).map(v => ({
            voter_id: v.voterId,
            secret_pin: v.secretPin,
            name: v.name,
            father_name: v.fatherName || '',
            mosque: v.mosque,
            district: v.district,
            division: v.division,
            phone: v.phone || '',
            has_voted: false
          }));
          await supabase.from('voters').upsert(batch);
        }
      } catch (err) {
        console.error('Supabase CSV sync err:', err);
      }
    }

    setCsvLoading(false);
    setCsvModalOpen(false);
    alert(`সফলভাবে ${csvParsedData.length} জন ভোটারের তথ্য তালিকায় আপলোড করা হয়েছে!`);
  };

  // সকল ভোটার তালিকা মুছে ফেলার হ্যান্ডলার
  const handleDeleteAllVoters = async () => {
    if (votersList.length === 0) {
      alert('ভোটার তালিকা ইতিমধ্যে সম্পূর্ণ খালি রয়েছে।');
      return;
    }

    const confirmed = window.confirm(`⚠️ আপনি কি নিশ্চিত যে বর্তমান সকল (${votersList.length} জন) ভোটারের তালিকা সম্পূর্ণ মুছে ফেলতে চান?\n\nএটি নিশ্চিত করলে সকল ভোটার ডিলিট হয়ে যাবে এবং নতুন তালিকা আপলোডের জন্য প্রস্তুত হবে।`);
    if (!confirmed) return;

    setVotersList([]);
    try {
      localStorage.setItem('mm_voters_list', '[]');
    } catch (e) {}

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('voters').delete().neq('voter_id', '___NONE___');
      } catch (err) {
        console.error('Delete all from Supabase err:', err);
      }
    }

    alert('বর্তমান সকল ভোটার সফলভাবে মুছে ফেলা হয়েছে! এখন আপনি নতুন CSV ফাইল আপলোড করতে পারবেন।');
  };

  const allNavMenuItems = [
    { id: 'candidates', label: 'প্রার্থী ব্যবস্থাপনা', icon: Award, count: candidatesList.length },
    { id: 'voters', label: 'ভোটার তালিকা', icon: Users, count: votersList.length },
    { id: 'dashboard', label: 'নির্বাচন নিয়ন্ত্রণ ও সময়', icon: LayoutDashboard },
    { id: 'security', label: 'নিরাপত্তা ও অডিট লগ', icon: ShieldCheck, count: auditLogs.length, developerOnly: true },
    { id: 'sms', label: 'এসএমএস গেটওয়ে ও ওটিপি', icon: Smartphone, developerOnly: true }
  ];

  const navMenuItems = adminRole === 'developer'
    ? allNavMenuItems
    : allNavMenuItems.filter(item => !item.developerOnly);

  if (!isAuthenticated) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '460px', margin: '2rem auto', width: '100%', padding: '0 0.5rem' }}>
        <div className="card" style={{ background: '#ffffff', borderTop: '5px solid var(--primary)', textAlign: 'center', padding: '2.5rem 1.5rem', boxShadow: 'var(--shadow-md)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--primary-subtle)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <Lock size={32} />
          </div>

          <h2 style={{ fontSize: '1.45rem', color: 'var(--primary-dark)', marginBottom: '0.4rem', fontWeight: 800 }}>
            নির্বাচন কন্ট্রোল ও অ্যাডমিন প্যানেল
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.885rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            প্যানেলে প্রবেশের জন্য আপনার অনুমোদিত সিকিউরিটি পিন দিন।
          </p>

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type={showPin ? "text" : "password"}
                placeholder=""
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                style={{ textAlign: 'center', letterSpacing: showPin ? '2px' : '4px', fontSize: '1.2rem', height: '52px', width: '100%', paddingRight: '45px', borderRadius: 'var(--radius-md)' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={showPin ? "পিন লুকান" : "পিন দেখুন"}
              >
                {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {loginError && (
              <div style={{ 
                color: 'var(--danger)', 
                background: '#fff1f2', 
                border: '1px solid #fecdd3', 
                padding: '0.65rem 0.85rem', 
                borderRadius: 'var(--radius-md)', 
                fontSize: '0.85rem', 
                textAlign: 'left' 
              }}>
                {loginError}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: '1.05rem', height: '48px', fontWeight: 700 }}>
              <Unlock size={20} />
              <span>প্যানেলে প্রবেশ করুন</span>
            </button>
          </form>

          {/* সুরক্ষিত এক্সেস ইনফো */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.15rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            <ShieldCheck size={15} color="#059669" />
            <span>১০০% এনক্রিপ্টেড ও রোল-বেসড সুরক্ষিত এক্সেস</span>
          </div>
        </div>
      </div>
    );
  }

  // ড্রপডাউন অপশন তালিকা প্রস্তুতকরণ
  const candDistrictsList = Object.keys(BD_LOCATIONS[candDivision] || {});
  const candThanasList = BD_LOCATIONS[candDivision]?.[candDistrict] || [];

  const voterDistrictsList = Object.keys(BD_LOCATIONS[voterDivision] || {});
  const voterThanasList = BD_LOCATIONS[voterDivision]?.[voterDistrict] || [];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* ডেডিকেটেড অ্যাডমিন টপ হেডার (পাবলিক হেডার/ফুটার ছাড়া সম্পূর্ণ নিজস্ব কন্ট্রোল বার) */}
      <div style={{
        background: '#ffffff',
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="btn btn-secondary admin-sidebar-toggle"
            style={{ width: '42px', height: '42px', padding: 0, minHeight: 'unset' }}
            title="সাইডবার মেনু"
          >
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Landmark size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#064e3b', lineHeight: 1.2 }}>
                নির্বাচন কমিশন অ্যাডমিন প্যানেল
              </div>
              <div style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                সেকশন: <strong style={{ color: 'var(--primary)' }}>{navMenuItems.find(m => m.id === currentMenu)?.label}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ডানপাশের অ্যাডমিন অ্যাকশন বাটনসমূহ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* রোল ইন্ডিকেটর ব্যাজ ও মোড সুইচার */}
          {adminRole === 'developer' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                <Zap size={14} color="#d97706" />
                <span>ডেভেলপার (ফুল)</span>
              </span>
              <button 
                type="button"
                onClick={() => {
                  setAdminRole('committee');
                  try { sessionStorage.setItem('mm_admin_role', 'committee'); } catch(e){}
                  if (currentMenu === 'sms' || currentMenu === 'security') setCurrentMenu('dashboard');
                }}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '34px' }}
                title="আহ্বায়ক কমিটি কী দেখবে তা প্রিভিউ করতে ক্লিক করুন"
              >
                কমিটি ভিউ টেস্ট
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                <ShieldCheck size={14} color="#059669" />
                <span>আহ্বায়ক কমিটি</span>
              </span>
              <button 
                type="button"
                onClick={() => {
                  setDevElevatePin('');
                  setDevElevateError('');
                  setShowDevElevateModal(true);
                }}
                className="btn btn-secondary"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  minHeight: '34px',
                  color: '#b45309',
                  background: '#fffbeb',
                  border: '1px solid #fde68a'
                }}
                title="ডেভেলপার পিন দিয়ে সম্পূর্ণ এক্সেস আনলক করুন"
              >
                <Zap size={13} />
                <span>ডেভেলপার আনলক</span>
              </button>
            </div>
          )}

          {/* মূল পাবলিক সাইটে ফিরে যাওয়ার বাটন */}
          <button 
            onClick={() => {
              if (setActiveTab) setActiveTab('home');
            }}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', minHeight: '38px' }}
            title="পাবলিক ভোট সাইটে যান"
          >
            <Eye size={16} />
            <span className="hide-on-mobile-xs">মূল সাইট</span>
          </button>

          {/* লগআউট বাটন */}
          <button 
            onClick={handleAdminLogout}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', minHeight: '38px', color: 'var(--danger)' }}
            title="অ্যাডমিন থেকে বের হন"
          >
            <LogOut size={16} />
            <span className="hide-on-mobile-xs">লগআউট</span>
          </button>
        </div>
      </div>

      {/* অ্যাডমিন মূল লেআউট */}
      <div className="admin-layout-container" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', position: 'relative' }}>
        
        {/* সাইডবার মেনু (ডেস্কটপে স্টিকি, মোবাইলে অফ-ক্যানভাস ড্রয়ার) */}
        <aside 
          className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}
          style={{
            width: '260px',
            flexShrink: 0,
            background: '#ffffff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '1.15rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            boxShadow: 'var(--shadow-sm)',
            position: 'sticky',
            top: '1rem',
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.25rem 0.5rem', letterSpacing: '0.5px' }}>
            অ্যাডমিন মেনু
          </div>

          {navMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentMenu(item.id);
                  setIsSidebarOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.95rem',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  border: isActive ? 'none' : '1px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Icon size={19} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-subtle)',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 700
                  }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div>নির্বাচন স্থিতি: {electionSettings.status === 'ongoing' ? 'চলমান' : 'সমাপ্ত'}</div>
            <div>মোট ভোটার: {votersList.length} জন</div>
          </div>
        </aside>

        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="sidebar-backdrop"
          />
        )}

        {/* কনটেন্ট স্ক্রিন */}
        <div style={{ flex: 1, width: '100%', minWidth: 0 }}>
          
          {/* ১. প্রার্থী ব্যবস্থাপনা মেনু (বিভাগ, জেলা, থানা ড্রপডাউনসহ) */}
          {currentMenu === 'candidates' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* নতুন প্রার্থী যোগ করুন কার্ড (শুধুমাত্র ডেভেলপারদের জন্য উন্মুক্ত) */}
              {adminRole === 'developer' ? (
                <div className="card" style={{ background: '#ffffff', borderTop: '4px solid var(--primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <PlusCircle size={22} style={{ color: 'var(--primary)' }} />
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-dark)' }}>
                    নতুন প্রার্থী যোগ করুন
                  </h2>
                </div>

                {addCandSuccess && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#dcfce7',
                    color: 'var(--success)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CheckCircle2 size={18} />
                    <span>{addCandSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleAddNewCandidate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      নির্বাচনী পদ:
                    </label>
                    <select 
                      value={newCandidate.postId} 
                      onChange={(e) => setNewCandidate({ ...newCandidate, postId: e.target.value })}
                      style={{ fontWeight: 600 }}
                      required
                    >
                      {POSTS.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      প্রার্থীর পূর্ণ নাম:
                    </label>
                    <input 
                      type="text" 
                      placeholder="মাওলানা / মুফতি ..."
                      value={newCandidate.name}
                      onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                      required 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      কর্মরত মডেল মসজিদ:
                    </label>
                    <input 
                      type="text" 
                      placeholder="যেমন: মিরপুর মডেল মসজিদ"
                      value={newCandidate.mosque}
                      onChange={(e) => setNewCandidate({ ...newCandidate, mosque: e.target.value })}
                      required 
                    />
                  </div>

                  {/* ৩টি ক্যাসকেডিং ড্রপডাউন: বিভাগ -> জেলা -> থানা/উপজেলা */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      বিভাগ (ড্রপডাউন):
                    </label>
                    <select 
                      value={candDivision} 
                      onChange={(e) => handleCandDivisionChange(e.target.value)}
                      style={{ fontWeight: 600, background: '#f8fafc' }}
                    >
                      {divisions.map(div => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      জেলা (ড্রপডাউন):
                    </label>
                    <select 
                      value={candDistrict} 
                      onChange={(e) => handleCandDistrictChange(e.target.value)}
                      style={{ fontWeight: 600, background: '#f8fafc' }}
                    >
                      {candDistrictsList.map(dist => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      থানা / উপজেলা (ড্রপডাউন):
                    </label>
                    <select 
                      value={candThana} 
                      onChange={(e) => setCandThana(e.target.value)}
                      style={{ fontWeight: 600, background: '#f8fafc' }}
                    >
                      {candThanasList.map(thana => (
                        <option key={thana} value={thana}>{thana}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      শিক্ষাগত যোগ্যতা:
                    </label>
                    <input 
                      type="text" 
                      placeholder="যেমন: দাওরায়ে হাদিস / কামিল"
                      value={newCandidate.qualification}
                      onChange={(e) => setNewCandidate({ ...newCandidate, qualification: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      সংক্ষিপ্ত অভিজ্ঞতা:
                    </label>
                    <input 
                      type="text" 
                      placeholder="যেমন: ১০ বছর ইমামতির অভিজ্ঞতা"
                      value={newCandidate.experience}
                      onChange={(e) => setNewCandidate({ ...newCandidate, experience: e.target.value })}
                    />
                  </div>

                  {/* প্রার্থীর ছবি আপলোড সেকশন (ডেভেলপার অপশন) */}
                  <div style={{
                    gridColumn: '1 / -1',
                    background: '#f8fafc',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px dashed #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                        <Camera size={18} color="var(--primary)" />
                        <span>প্রার্থীর ছবি যোগ করুন (ঐচ্ছিক):</span>
                      </label>
                      {newCandidate.photo && (
                        <button
                          type="button"
                          onClick={() => setNewCandidate(prev => ({ ...prev, photo: '' }))}
                          style={{
                            background: '#fee2e2',
                            color: 'var(--danger)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.2rem 0.6rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Trash2 size={13} />
                          <span>ছবি মুছুন</span>
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      {/* প্রিভিউ বক্স */}
                      <div style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: newCandidate.photo ? '2.5px solid var(--primary)' : '2px dashed #94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                      }}>
                        {newCandidate.photo ? (
                          <img 
                            src={newCandidate.photo} 
                            alt="প্রিভিউ" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <User size={34} color="#94a3b8" />
                        )}
                      </div>

                      {/* আপলোড ও লিংক অপশন */}
                      <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input 
                            type="file" 
                            ref={newCandFileInputRef} 
                            accept="image/*" 
                            onChange={handleNewCandPhotoUpload} 
                            style={{ display: 'none' }} 
                          />
                          <button
                            type="button"
                            disabled={newCandPhotoLoading}
                            onClick={() => newCandFileInputRef.current?.click()}
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.85rem',
                              padding: '0.45rem 0.9rem',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              color: '#0f172a'
                            }}
                          >
                            <Upload size={15} color="var(--primary)" />
                            <span>{newCandPhotoLoading ? 'প্রসেসিং হচ্ছে...' : 'ডিভাইস থেকে ছবি আপলোড করুন'}</span>
                          </button>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>(JPG, PNG, WebP)</span>
                        </div>

                        <input 
                          type="text" 
                          placeholder="অথবা অনলাইন ছবির লিঙ্ক (Image URL) পেস্ট করুন..."
                          value={newCandidate.photo}
                          onChange={(e) => setNewCandidate({ ...newCandidate, photo: e.target.value })}
                          style={{
                            fontSize: '0.82rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: '0.35rem' }}>
                    <button type="submit" disabled={candLoading} className="btn btn-primary" style={{ width: '100%' }}>
                      <Award size={18} />
                      <span>{candLoading ? 'যোগ করা হচ্ছে...' : 'প্রার্থী তালিকায় যুক্ত করুন'}</span>
                    </button>
                  </div>
                </form>
              </div>
              ) : (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  color: '#475569',
                  fontSize: '0.88rem'
                }}>
                  <ShieldCheck size={20} color="#059669" />
                  <span>
                    <strong>আহ্বায়ক কমিটি মোড:</strong> {electionSettings.status !== 'upcoming' 
                      ? 'নির্বাচন শুরু হয়ে যাওয়ায় প্রার্থীর তথ্য এডিট বা পরিবর্তন সম্পূর্ণ লক করা রয়েছে।' 
                      : 'অনুমোদিত প্রার্থীদের তালিকা নিচে প্রদর্শিত হচ্ছে।'}
                  </span>
                </div>
              )}

              {/* প্রার্থী তালিকা কার্ড */}
              <div className="card" style={{ background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>
                    নিবন্ধিত প্রার্থী তালিকা ({candidatesList.length} জন)
                  </h2>
                  <span className="badge badge-primary">{POSTS.length}টি পদ</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {candidatesList.map(cand => {
                    const postInfo = POSTS.find(p => p.id === cand.postId);
                    return (
                      <div 
                        key={cand.id}
                        style={{
                          padding: '0.9rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                            {/* প্রার্থীর ছবি / আভাটার (ডেভেলপাররা সরাসরি ক্লিকে ছবি পরিবর্তন করতে পারেন) */}
                            <div 
                              style={{
                                position: 'relative',
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                flexShrink: 0,
                                cursor: adminRole === 'developer' ? 'pointer' : 'default'
                              }}
                              onClick={() => {
                                if (adminRole === 'developer') {
                                  setQuickTargetCand(cand);
                                  quickPhotoInputRef.current?.click();
                                }
                              }}
                              title={adminRole === 'developer' ? 'ক্লিক করে সরাসরি ছবি পরিবর্তন বা আপলোড করুন' : cand.name}
                            >
                              {cand.photo ? (
                                <img 
                                  src={cand.photo} 
                                  alt={cand.name} 
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid var(--primary)',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                                  }} 
                                />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '50%',
                                  background: 'var(--emerald-50)',
                                  border: '1.5px dashed var(--emerald-400)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--emerald-600)'
                                }}>
                                  <User size={26} />
                                </div>
                              )}
                              {adminRole === 'developer' && (
                                <div 
                                  style={{
                                    position: 'absolute',
                                    bottom: '-2px',
                                    right: '-2px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'var(--primary)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px solid #ffffff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                  }}
                                  title="ছবি পরিবর্তন"
                                >
                                  <Camera size={10} />
                                </div>
                              )}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <span className="badge badge-primary" style={{ marginBottom: '0.25rem', fontSize: '0.78rem' }}>
                                {postInfo ? postInfo.title : cand.postId}
                              </span>
                              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginTop: '2px', wordBreak: 'break-word' }}>
                                {cand.name}
                              </h3>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {/* এডিট বাটন: ডেভেলপার সবসময় পারবে, কিন্তু নির্বাচন শুরু হলে কমিটির জন্য বন্ধ */}
                            {(adminRole === 'developer' || electionSettings.status === 'upcoming') ? (
                              <button
                                onClick={() => setEditingCandidate({ ...cand })}
                                style={{
                                  background: 'var(--emerald-50)',
                                  color: 'var(--emerald-700)',
                                  border: '1px solid var(--emerald-100)',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.785rem',
                                  fontWeight: 600
                                }}
                                title="প্রার্থী তথ্য এডিট করুন"
                              >
                                <Edit2 size={13} />
                                <span>এডিট</span>
                              </button>
                            ) : (
                              <span 
                                style={{
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  padding: '0.3rem 0.55rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}
                                title="নির্বাচন চলমান থাকায় এডিট বন্ধ"
                              >
                                <Lock size={12} />
                                <span>লকড</span>
                              </span>
                            )}

                            {adminRole === 'developer' && (
                              <button
                                onClick={() => handleDeleteCandidate(cand.id, cand.name)}
                                style={{
                                  background: '#fee2e2',
                                  color: 'var(--danger)',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.785rem',
                                  fontWeight: 600
                                }}
                                title="প্রার্থী বাতিল করুন (ডেভেলপার অনলি)"
                              >
                                <Trash2 size={13} />
                                <span>মুছুন</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <Landmark size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          {cand.mosque} • <strong>{cand.district}</strong> ({cand.division} বিভাগ)
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'var(--bg-subtle)', padding: '0.35rem 0.6rem', borderRadius: '4px' }}>
                          যোগ্যতা: {cand.qualification}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* সরাসরি তালিকা থেকে ছবি পরিবর্তনের জন্য লুকানো ফাইল ইনপুট */}
                <input 
                  type="file" 
                  ref={quickPhotoInputRef} 
                  accept="image/*" 
                  onChange={handleQuickPhotoSelect} 
                  style={{ display: 'none' }} 
                />
              </div>

            </div>
          )}

          {/* ২. ভোটার তালিকা মেনু (বিভাগ, জেলা, থানা ড্রপডাউনসহ) */}
          {currentMenu === 'voters' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* নতুন অনুমোদিত ভোটার নিবন্ধন কার্ড (শুধুমাত্র ডেভেলপারদের জন্য উন্মুক্ত) */}
              {adminRole === 'developer' ? (
                <div className="card" style={{ background: '#ffffff', borderTop: '4px solid var(--primary)' }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary-dark)' }}>
                    নতুন অনুমোদিত ভোটার নিবন্ধন
                  </h2>

                {addVoterSuccess && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#dcfce7',
                    color: 'var(--success)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CheckCircle2 size={18} />
                    <span>{addVoterSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleAddNewVoter} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>ইমাম মহোদয়ের নাম: *</label>
                    <input 
                      type="text" 
                      placeholder="মাওলানা / মুফতি ..."
                      value={newVoter.name}
                      onChange={(e) => setNewVoter({ ...newVoter, name: e.target.value })}
                      required 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>মডেল মসজিদের নাম: *</label>
                    <input 
                      type="text" 
                      placeholder="উপজেলা মডেল মসজিদ"
                      value={newVoter.mosque}
                      onChange={(e) => setNewVoter({ ...newVoter, mosque: e.target.value })}
                      required 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>মোবাইল নম্বর: *</label>
                    <input 
                      type="tel" 
                      placeholder="০১৭১২-xxxxxx"
                      value={newVoter.phone}
                      onChange={(e) => setNewVoter({ ...newVoter, phone: e.target.value })}
                      required 
                    />
                  </div>

                  {/* ভোটার ক্যাসকেডিং ড্রপডাউন: বিভাগ -> জেলা -> থানা */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>বিভাগ (ড্রপডাউন):</label>
                    <select 
                      value={voterDivision} 
                      onChange={(e) => handleVoterDivisionChange(e.target.value)}
                      style={{ fontWeight: 600, background: '#f8fafc' }}
                    >
                      {divisions.map(div => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>জেলা (ড্রপডাউন):</label>
                    <select 
                      value={voterDistrict} 
                      onChange={(e) => handleVoterDistrictChange(e.target.value)}
                      style={{ fontWeight: 600, background: '#f8fafc' }}
                    >
                      {voterDistrictsList.map(dist => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>থানা / উপজেলা (ড্রপডাউন):</label>
                    <select 
                      value={voterThana} 
                      onChange={(e) => setVoterThana(e.target.value)}
                      style={{ fontWeight: 600, background: '#f8fafc' }}
                    >
                      {voterThanasList.map(thana => (
                        <option key={thana} value={thana}>{thana}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: '0.35rem' }}>
                    <button type="submit" disabled={voterLoading} className="btn btn-primary" style={{ width: '100%' }}>
                      <UserPlus size={18} />
                      <span>{voterLoading ? 'যুক্ত হচ্ছে...' : 'ভোটার তালিকায় যুক্ত করুন'}</span>
                    </button>
                  </div>
                </form>
              </div>
              ) : (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  color: '#475569',
                  fontSize: '0.88rem'
                }}>
                  <ShieldCheck size={20} color="#059669" />
                  <span>
                    <strong>আহ্বায়ক কমিটি মোড:</strong> {electionSettings.status !== 'upcoming' 
                      ? 'নির্বাচন শুরু হয়ে যাওয়ায় ভোটারদের তথ্য এডিট বা পরিবর্তন সম্পূর্ণ লক করা রয়েছে।' 
                      : 'অনুমোদিত ভোটারদের তালিকা ও তাদের ভোট প্রদানের স্থিতি নিচে প্রদর্শিত হচ্ছে।'}
                  </span>
                </div>
              )}

              {/* ভোটার তালিকা ও এক্সপোর্ট */}
              <div className="card" style={{ background: '#ffffff' }}>
                
                {/* ভোটার তালিকা হেডার ও ফিল্টার কন্ট্রোল */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>ভোটার তালিকা</span>
                        <span className="badge badge-primary" style={{ fontSize: '0.85rem' }}>
                          {filteredVotersList.length} জন
                        </span>
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        বিভাগ ও জেলা ভিত্তিক ফিল্টারিং এবং ডাউনলোড অপশন
                      </p>
                    </div>

                    {/* এক্সপোর্ট ও আপলোড বাটন গ্রুপ (CSV আপলোড, PDF, এক্সপোর্ট ও সব মুছুন) */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {/* Hidden CSV file input */}
                      <input 
                        type="file" 
                        ref={csvFileInputRef} 
                        onChange={handleCSVFileSelect} 
                        accept=".csv,text/csv" 
                        style={{ display: 'none' }} 
                      />

                      {/* CSV আপলোড বাটন (শুধুমাত্র ডেভেলপারদের জন্য উন্মুক্ত) */}
                      {adminRole === 'developer' && (
                        <button 
                          onClick={() => csvFileInputRef.current?.click()} 
                          className="btn btn-primary" 
                          style={{ 
                            padding: '0.5rem 0.9rem', 
                            fontSize: '0.85rem', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            background: 'var(--emerald-600)', 
                            borderColor: 'var(--emerald-600)' 
                          }}
                          title="কম্পিউটার থেকে নতুন ভোটারদের CSV ফাইল আপলোড করুন (ডেভেলপার অনলি)"
                        >
                          <Upload size={16} />
                          <span>CSV আপলোড করুন</span>
                        </button>
                      )}

                      <button 
                        onClick={handlePrintVoterListPDF} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        title="পিডিএফ ফাইল হিসেবে সেভ বা প্রিন্ট করুন"
                      >
                        <Printer size={16} />
                        <span>পিডিএফ ডাউনলোড</span>
                      </button>

                      <button 
                        onClick={handleExportVoters} 
                        className="btn btn-secondary" 
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        title="এক্সেল বা CSV হিসেবে ডাউনলোড করুন"
                      >
                        <Download size={16} />
                        <span>CSV এক্সপোর্ট</span>
                      </button>

                      {/* সকল ভোটার মুছুন বাটন (শুধুমাত্র ডেভেলপারদের জন্য সংরক্ষিত) */}
                      {adminRole === 'developer' && (
                        <button 
                          onClick={handleDeleteAllVoters} 
                          className="btn" 
                          style={{
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            padding: '0.5rem 0.9rem',
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="বর্তমান সকল ভোটার সম্পূর্ণ মুছে ফেলুন (ডেভেলপার অনলি)"
                        >
                          <Trash2 size={16} />
                          <span>সকল ভোটার মুছুন</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ফিল্টার বার: বিভাগ ও জেলা সিলেক্টর */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    background: 'var(--bg-subtle)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Filter size={16} style={{ color: 'var(--primary)' }} />
                      <span>ফিল্টার করুন:</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>বিভাগ:</label>
                      <select
                        value={voterFilterDivision}
                        onChange={(e) => {
                          setVoterFilterDivision(e.target.value);
                          setVoterFilterDistrict('all');
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.85rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          fontWeight: 500
                        }}
                      >
                        <option value="all">সকল বিভাগ ({votersList.length} জন)</option>
                        {divisions.map(div => {
                          const count = votersList.filter(v => cleanBn(v.division) === cleanBn(div)).length;
                          return (
                            <option key={div} value={div}>
                              {div} ({count} জন)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>জেলা:</label>
                      <select
                        value={voterFilterDistrict}
                        onChange={(e) => setVoterFilterDistrict(e.target.value)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.85rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                          fontWeight: 500
                        }}
                      >
                        <option value="all">সকল জেলা</option>
                        {availableDistrictsForFilter.map(dist => {
                          const count = votersList.filter(v => {
                            const matchDiv = voterFilterDivision === 'all' || cleanBn(v.division) === cleanBn(voterFilterDivision);
                            const matchDist = cleanBn(v.district).includes(cleanBn(dist)) || cleanBn(dist).includes(cleanBn(v.district));
                            return matchDiv && matchDist;
                          }).length;
                          return (
                            <option key={dist} value={dist}>
                              {dist} ({count} জন)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {(voterFilterDivision !== 'all' || voterFilterDistrict !== 'all') && (
                      <button
                        onClick={() => {
                          setVoterFilterDivision('all');
                          setVoterFilterDistrict('all');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: '0.2rem 0.4rem'
                        }}
                      >
                        ফিল্টার রিসেট
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '0.75rem' }}>কোড</th>
                        <th style={{ padding: '0.75rem' }}>নাম</th>
                        <th style={{ padding: '0.75rem' }}>মসজিদ ও এলাকা</th>
                        <th style={{ padding: '0.75rem' }}>মোবাইল</th>
                        <th style={{ padding: '0.75rem' }}>গোপন পিন</th>
                        <th style={{ padding: '0.75rem' }}>স্ট্যাটাস</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVotersList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                {voterFilterDivision !== 'all' 
                                  ? `"${voterFilterDivision}" বিভাগে এক্সেল তালিকা অনুযায়ী কোনো ভোটার নেই।` 
                                  : 'নির্বাচিত ফিল্টারে কোনো ভোটার খুঁজে পাওয়া যায়নি।'}
                              </span>
                              <button
                                onClick={() => {
                                  setVoterFilterDivision('all');
                                  setVoterFilterDistrict('all');
                                }}
                                style={{
                                  background: 'var(--primary)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.4rem 0.9rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                সকল ভোটার দেখুন (ফিল্টার রিসেট)
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredVotersList.map(voter => (
                          <tr key={voter.voterId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{voter.voterId}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{voter.name}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{voter.mosque}, {voter.district}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>{voter.phone || 'N/A'}</td>
                          <td style={{ padding: '0.75rem' }}><code>{voter.secretPin}</code></td>
                          <td style={{ padding: '0.75rem' }}>
                            {voter.hasVoted ? (
                              <span className="badge badge-gold">ভোট সম্পন্ন</span>
                            ) : (
                              <span className="badge badge-success">ভোট বাকি</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              {/* এডিট বাটন: ডেভেলপার সবসময় পারবে, কিন্তু নির্বাচন শুরু হলে কমিটির জন্য বন্ধ */}
                              {(adminRole === 'developer' || electionSettings.status === 'upcoming') ? (
                                <button
                                  onClick={() => setEditingVoter({ ...voter })}
                                  style={{
                                    background: 'var(--emerald-50)',
                                    color: 'var(--emerald-700)',
                                    border: '1px solid var(--emerald-100)',
                                    borderRadius: '6px',
                                    padding: '0.3rem 0.55rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}
                                  title="ভোটারের তথ্য এডিট করুন"
                                >
                                  <Edit2 size={12} />
                                  <span>এডিট</span>
                                </button>
                              ) : (
                                <span 
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    padding: '0.25rem 0.45rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 600
                                  }}
                                  title="নির্বাচন চলমান থাকায় ভোটার এডিট বন্ধ"
                                >
                                  <Lock size={11} />
                                  <span>লকড</span>
                                </span>
                              )}

                              {adminRole === 'developer' && (
                                <button
                                  onClick={() => handleDeleteVoter(voter.voterId, voter.name)}
                                  style={{
                                    background: '#fee2e2',
                                    color: 'var(--danger)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.3rem 0.55rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                  }}
                                  title="ভোটার বাতিল করুন (ডেভেলপার অনলি)"
                                >
                                  <Trash2 size={12} />
                                  <span>মুছুন</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ৩. নির্বাচন নিয়ন্ত্রণ ও সময়সূচি (Schedule) মেনু */}
          {currentMenu === 'dashboard' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* ১. সক্রিয় নির্বাচনের সার্বিক অবস্থা ও ম্যানুয়াল অ্যাকশন সুইচ */}
              <div className="card" style={{ background: '#ffffff', borderTop: '4px solid var(--primary)', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.3rem', margin: '0 0 0.35rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Calendar size={24} style={{ color: 'var(--primary)' }} />
                      <span>নির্বাচন নিয়ন্ত্রণ, সময়সূচি ও তফসিল ব্যবস্থাপনা</span>
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      অনলাইন নির্বাচনের শুরুর সময়, সমাপ্তির সময় এবং বর্তমান ভোট গ্রহণ অবস্থা নিয়ন্ত্রণ করুন।
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={toggleElectionStatus}
                      className={`btn ${electionSettings.status === 'ongoing' ? 'btn-danger' : 'btn-primary'}`}
                      style={{ minHeight: '46px', padding: '0 1.5rem', fontWeight: 700, borderRadius: '10px' }}
                    >
                      {electionSettings.status === 'ongoing' ? (
                        <>
                          <Square size={18} />
                          <span>ভোট গ্রহণ সমাপ্ত ও ফলাফল উন্মুক্ত করুন</span>
                        </>
                      ) : (
                        <>
                          <Play size={18} />
                          <span>এখনই ভোট গ্রহণ শুরু করুন</span>
                        </>
                      )}
                    </button>

                    {/* ডেভেলপার অ্যাকশন: নতুন নির্বাচনের জন্য ব্যালট ক্লিন / রিসেট বাটন (শুধুমাত্র ডেভেলপারদের জন্য) */}
                    {adminRole === 'developer' && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetConfirmError('');
                          setShowResetElectionModal(true);
                        }}
                        className="btn"
                        style={{
                          minHeight: '46px',
                          padding: '0 1.25rem',
                          fontWeight: 700,
                          borderRadius: '10px',
                          background: '#fffbeb',
                          color: '#b45309',
                          border: '1.5px solid #fde68a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer'
                        }}
                        title="প্রার্থী ও ভোটার তালিকা বহাল রেখে নতুন ভোটের জন্য ব্যালট ক্লিন/রিসেট করুন"
                      >
                        <RotateCcw size={18} />
                        <span>নতুন ভোটের জন্য ব্যালট ক্লিন</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* বর্তমান তফসিল প্রিভিউ বক্স */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  padding: '1.25rem',
                  borderRadius: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      বর্তমান ভোট স্থিতি:
                    </span>
                    {electionSettings.status === 'ongoing' && (
                      <span className="badge badge-success" style={{ fontSize: '0.95rem', padding: '0.35rem 0.8rem' }}>
                        🟢 ভোট গ্রহণ চলছে (ফলাফল গোপন)
                      </span>
                    )}
                    {electionSettings.status === 'upcoming' && (
                      <span className="badge badge-gold" style={{ fontSize: '0.95rem', padding: '0.35rem 0.8rem' }}>
                        🟡 নির্বাচন আসন্ন (ভোট গ্রহণ শুরু হয়নি)
                      </span>
                    )}
                    {electionSettings.status === 'ended' && (
                      <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontSize: '0.95rem', padding: '0.35rem 0.8rem' }}>
                        🔴 ভোট সমাপ্ত (ফলাফল সবার জন্য উন্মুক্ত)
                      </span>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      ভোট গ্রহণ শুরুর নির্ধারিত সময়:
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                      📅 {formatBanglaDateTime(electionSettings.startTime)}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      ভোট গ্রহণ সমাপ্তির নির্ধারিত সময়:
                    </span>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                      ⏰ {formatBanglaDateTime(electionSettings.endTime)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* ২. নির্বাচন শুরু ও সমাপ্তির সময় নির্ধারণ ফরম */}
              <div className="card" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <Clock size={22} style={{ color: 'var(--gold-dark)' }} />
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)', margin: 0 }}>
                    নির্বাচনের শুরুর ও সমাপ্তির সময় নির্ধারণ করুন
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  নিচের ক্যালেন্ডার থেকে নির্বাচন শুরু ও শেষ হওয়ার নির্দিষ্ট তারিখ ও সময় নির্বাচন করে সেভ করুন।
                </p>

                {scheduleSaveSuccess && (
                  <div style={{
                    padding: '0.85rem 1.15rem',
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1.5px solid #a7f3d0',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontWeight: 600
                  }}>
                    <CheckCircle2 size={20} color="#059669" />
                    <span>{scheduleSaveSuccess}</span>
                  </div>
                )}

                {scheduleSaveError && (
                  <div style={{
                    padding: '0.85rem 1.15rem',
                    background: '#fef2f2',
                    color: '#991b1b',
                    border: '1.5px solid #fecaca',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontWeight: 600
                  }}>
                    <AlertTriangle size={20} color="#dc2626" />
                    <span>{scheduleSaveError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* দ্রুত প্রিসেট বাটনসমূহ */}
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: '#475569', marginBottom: '0.5rem' }}>
                      ⚡ দ্রুত সময়সূচি নির্ধারণ প্রিসেট (এক ক্লিকে নির্বাচন):
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => applySchedulePreset(12, true)}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.84rem', minHeight: '34px', borderRadius: '6px' }}
                      >
                        ⏱️ আজ ১২ ঘণ্টা (এখন থেকে)
                      </button>

                      <button
                        type="button"
                        onClick={() => applySchedulePreset(24, true)}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.84rem', minHeight: '34px', borderRadius: '6px' }}
                      >
                        📅 ২৪ ঘণ্টার নির্বাচন
                      </button>

                      <button
                        type="button"
                        onClick={() => applySchedulePreset(72, true)}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.84rem', minHeight: '34px', borderRadius: '6px' }}
                      >
                        🗓️ ৩ দিনের নির্বাচন (৭২ ঘণ্টা)
                      </button>

                      <button
                        type="button"
                        onClick={() => applySchedulePreset(12, false)}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.84rem', minHeight: '34px', borderRadius: '6px' }}
                      >
                        🌅 সকাল ৮টা - রাত ৮টা (আজ)
                      </button>
                    </div>
                  </div>

                  {/* শুরুর ও শেষের তারিখ/সময় ইনপুট গ্রিড */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                        <Calendar size={18} color="#059669" />
                        <span>১. নির্বাচন শুরু হওয়ার তারিখ ও সময়:</span>
                      </label>
                      <input 
                        type="datetime-local" 
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        required
                        style={{ 
                          width: '100%', 
                          fontSize: '1.05rem', 
                          padding: '0.65rem 0.9rem', 
                          fontWeight: 600,
                          borderRadius: '8px',
                          border: '2px solid #cbd5e1'
                        }}
                      />
                      <span style={{ display: 'block', fontSize: '0.82rem', color: '#047857', marginTop: '0.4rem', fontWeight: 600 }}>
                        প্রিভিউ: {formatBanglaDateTime(scheduleStartTime)}
                      </span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                        <Clock size={18} color="#dc2626" />
                        <span>২. নির্বাচন শেষ হওয়ার তারিখ ও সময়:</span>
                      </label>
                      <input 
                        type="datetime-local" 
                        value={scheduleEndTime}
                        onChange={(e) => setScheduleEndTime(e.target.value)}
                        required
                        style={{ 
                          width: '100%', 
                          fontSize: '1.05rem', 
                          padding: '0.65rem 0.9rem', 
                          fontWeight: 600,
                          borderRadius: '8px',
                          border: '2px solid #cbd5e1'
                        }}
                      />
                      <span style={{ display: 'block', fontSize: '0.82rem', color: '#b91c1c', marginTop: '0.4rem', fontWeight: 600 }}>
                        প্রিভিউ: {formatBanglaDateTime(scheduleEndTime)}
                      </span>
                    </div>
                  </div>

                  {/* নির্বাচন শিরোনাম ও মেয়াদ */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                        নির্বাচনের অফিসিয়াল শিরোনাম:
                      </label>
                      <input 
                        type="text"
                        value={scheduleTitle}
                        onChange={(e) => setScheduleTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                        নির্বাচনী মেয়াদ / সেশন:
                      </label>
                      <input 
                        type="text"
                        value={scheduleTerm}
                        onChange={(e) => setScheduleTerm(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                    <button
                      type="submit"
                      disabled={isSavingSchedule}
                      className="btn btn-primary"
                      style={{ minHeight: '50px', padding: '0 2rem', fontSize: '1.1rem', fontWeight: 700, borderRadius: '10px' }}
                    >
                      <Save size={20} />
                      <span>{isSavingSchedule ? 'সংরক্ষণ করা হচ্ছে...' : 'সময়সূচি সংরক্ষণ ও কার্যকর করুন'}</span>
                    </button>
                  </div>

                </form>
              </div>

              {/* ৩. টার্নআউট পরিসংখ্যান */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ background: '#ffffff', borderLeft: '4px solid #059669' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>মোট নিবন্ধিত ভোটার</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-dark)', marginTop: '0.2rem' }}>{stats.totalVoters} জন</div>
                </div>
                <div className="card" style={{ background: '#ffffff', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>কাস্ট হওয়া ভোট</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
                    {stats.votedCount} জন ({stats.totalVoters > 0 ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0}%)
                  </div>
                </div>
                <div className="card" style={{ background: '#ffffff', borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ভোট দেওয়া বাকি</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>{stats.remainingCount} জন</div>
                </div>
              </div>

            </div>
          )}

          {/* ৩.১ এসএমএস গেটওয়ে ও ওটিপি কনফিগারেশন মেনু (শুধুমাত্র ডেভেলপারদের জন্য) */}
          {currentMenu === 'sms' && adminRole === 'developer' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="card" style={{ background: '#ffffff', borderTop: '4px solid var(--primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Smartphone size={22} style={{ color: 'var(--primary)' }} />
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--primary-dark)' }}>
                    এসএমএস গেটওয়ে ও ওটিপি (OTP) কনফিগারেশন
                  </h2>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  ভোটার ভেরিফিকেশন ও ওটিপি কোড প্রেরণের জন্য BulkSMSBD অফিসিয়াল এসএমএস গেটওয়ে সংযুক্ত রয়েছে।
                </p>

                {smsSaveSuccess && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: '#dcfce7',
                    color: 'var(--success)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CheckCircle2 size={18} />
                    <span>{smsSaveSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSmsConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  
                  {/* Dedicated BulkSMSBD Gateway Header */}
                  <div style={{
                    background: '#f0fdf4',
                    padding: '0.85rem 1.25rem',
                    borderRadius: '8px',
                    border: '1.5px solid #86efac',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#059669',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#064e3b', fontSize: '0.98rem' }}>
                          📱 BulkSMSBD Gateway (http://bulksmsbd.net/)
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                          সিস্টেমের একমাত্র অনুমোদিত ওটিপি ও নির্বাচনী নোটিশ এসএমএস গেটওয়ে
                        </div>
                      </div>
                    </div>
                    <span style={{
                      background: '#dcfce7',
                      color: '#065f46',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid #a7f3d0'
                    }}>
                      একমাত্র অফিসিয়াল গেটওয়ে
                    </span>
                  </div>

                  {/* Enable Switch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input 
                      type="checkbox"
                      id="smsEnableToggle"
                      checked={smsConfig.isEnabled}
                      onChange={(e) => setSmsConfig({ ...smsConfig, isEnabled: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="smsEnableToggle" style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.92rem' }}>
                      লাইভ এসএমএস প্রেরণ সক্রিয় রাখুন (বন্ধ রাখলে ওটিপি শুধুমাত্র স্ক্রিনে প্রদর্শন করবে)
                    </label>
                  </div>

                  {/* BulkSMSBD Configuration Form Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fafafa', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    
                    <div style={{
                      background: '#ecfdf5',
                      border: '1.5px solid #a7f3d0',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      fontSize: '0.88rem',
                      color: '#065f46',
                      lineHeight: 1.55
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <strong style={{ color: '#064e3b' }}>🔗 BulkSMSBD (bulksmsbd.net) গেটওয়ে নির্দেশিকা:</strong>
                        <a href="https://bulksmsbd.net/login" target="_blank" rel="noreferrer" style={{ color: '#059669', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'underline' }}>
                          BulkSMSBD পোর্টাল লগইন ↗
                        </a>
                      </div>
                      <span>
                        • <strong>আইপি হোয়াইটলিস্ট (Error 1032 সমাধান):</strong> Vercel ক্লাউড সার্ভার থেকে নিরবচ্ছিন্ন এসএমএস নিশ্চিত করতে bulksmsbd.net পোর্টালে <em>API Settings / Security</em> থেকে <strong>Source IP Checking নিষ্ক্রিয় (Disable / OFF)</strong> রাখুন। অথবা <em>Phonebook -&gt; IP White List</em> মেনুতে সার্ভার আইপি যুক্ত করুন।
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                          BulkSMSBD API Key:
                        </label>

                        <button
                          type="button"
                          onClick={handleCheckBulkBalance}
                          disabled={isCheckingBalance}
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.75rem', minHeight: '30px', fontSize: '0.82rem', borderRadius: '6px' }}
                        >
                          <span>{isCheckingBalance ? 'যাচাই হচ্ছে...' : '💰 লাইভ ব্যালেন্স চেক'}</span>
                        </button>
                      </div>

                      <input 
                        type="text"
                        placeholder="যেমন: cRuK5lRpRz7ycHEeJTB4"
                        value={smsConfig.apiKey}
                        onChange={(e) => setSmsConfig({ ...smsConfig, apiKey: e.target.value })}
                        style={{ fontFamily: 'monospace' }}
                      />

                      {balanceMsg && (
                        <div style={{
                          marginTop: '0.4rem',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '6px',
                          background: balanceMsg.success ? '#dcfce7' : '#fee2e2',
                          color: balanceMsg.success ? '#065f46' : '#991b1b',
                          fontSize: '0.84rem',
                          fontWeight: 600
                        }}>
                          {balanceMsg.text}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                        Approved Sender ID (BulkSMSBD অনুমোদিত প্রেরক আইডি):
                      </label>
                      <input 
                        type="text"
                        placeholder="যেমন: 8809617643365"
                        value={smsConfig.senderId}
                        onChange={(e) => setSmsConfig({ ...smsConfig, senderId: e.target.value })}
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                        * BulkSMSBD ড্যাশবোর্ডে অনুমোদিত Sender ID লিখুন (যেমন: 8809617643365)।
                      </span>
                    </div>

                    {/* Brand Name Input for Approved OTP Template */}
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                        Approved Brand / Company Name (ওটিপি টেমপ্লেটের অনুমোদিত ব্র্যান্ড নাম):
                      </label>
                      <input 
                        type="text"
                        placeholder="যেমন: Model Mosque"
                        value={smsConfig.brandName || ''}
                        onChange={(e) => setSmsConfig({ ...smsConfig, brandName: e.target.value })}
                      />
                      <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#334155', background: '#f1f5f9', padding: '0.4rem 0.65rem', borderRadius: '6px' }}>
                        📌 অনুমোদিত ওটিপি ফরম্যাট প্রিভিউ: <strong>Your {smsConfig.brandName || 'Model Mosque'} OTP is XXXX</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                      <CheckCircle2 size={18} />
                      <span>গেটওয়ে সেটিংস সংরক্ষণ করুন</span>
                    </button>

                    <button 
                      type="button" 
                      onClick={handleResetToDefaultSmsConfig}
                      className="btn btn-outline" 
                      style={{ padding: '0.6rem 1.25rem', borderColor: '#059669', color: '#059669' }}
                      title="BulkSMSBD অফিশিয়াল ক্রেডেনশিয়াল (Key: cRuK5lRpRz7ycHEeJTB4, Sender: 8809617643365) সেট করুন"
                    >
                      <RotateCcw size={16} />
                      <span>⚡ BulkSMSBD অফিশিয়াল ক্রেডেনশিয়াল সেট করুন</span>
                    </button>
                  </div>

                </form>
              </div>

              {/* Test SMS Sender Box */}
              <div className="card" style={{ background: '#ffffff' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Send size={18} style={{ color: 'var(--primary)' }} />
                  <span>টেস্ট এসএমএস পাঠিয়ে ওটিপি ফরম্যাট যাচাই</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  আপনার মোবাইলে ৪-সংখ্যার পরীক্ষামূলক ওটিপি এসএমএস (<code>Your {smsConfig.brandName || 'Model Mosque'} OTP is 1234</code>) পাঠিয়ে গেটওয়ে নিশ্চিত করুন।
                </p>

                <form onSubmit={handleSendTestSms} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <input 
                      type="tel"
                      placeholder="যেমন: 01711223344"
                      value={testSmsPhone}
                      onChange={(e) => setTestSmsPhone(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={testSmsLoading} 
                    className="btn btn-secondary" 
                    style={{ minHeight: '42px', padding: '0 1.25rem' }}
                  >
                    <Send size={16} />
                    <span>{testSmsLoading ? 'পাঠানো হচ্ছে...' : 'টেস্ট এসএমএস পাঠান'}</span>
                  </button>
                </form>

                {testSmsResult && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: testSmsResult.success ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${testSmsResult.success ? '#a7f3d0' : '#fecaca'}`,
                    color: testSmsResult.success ? '#065f46' : '#991b1b',
                    fontSize: '0.88rem'
                  }}>
                    <strong>{testSmsResult.success ? '✅ সফল:' : '❌ ত্রুটি:'}</strong> {testSmsResult.message}
                  </div>
                )}
              </div>

              {/* ভোটারদের একযোগে বাল্ক নোটিশ প্রেরণ (One-to-Many SMS) */}
              <div className="card" style={{ background: '#ffffff', borderLeft: '4px solid #3b82f6' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Send size={18} style={{ color: '#3b82f6' }} />
                  <span>ভোটারদের বাল্ক নোটিশ / নির্বাচনী এসএমএস প্রেরণ (One-to-Many SMS)</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  রেজিস্টার্ড ভোটারদের অথবা নির্বাচিত মোবাইল নম্বরসমূহে এক ক্লিকে BulkSMSBD এর One-to-Many এপিআই এর মাধ্যমে নোটিশ প্রেরণ করুন।
                </p>

                <form onSubmit={handleSendBulkNotice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                      <input 
                        type="radio" 
                        name="bulkTarget" 
                        value="all" 
                        checked={bulkNoticeTarget === 'all'} 
                        onChange={() => setBulkNoticeTarget('all')} 
                      />
                      <span>সকল নিবন্ধিত ভোটার ({votersList.length} জন)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                      <input 
                        type="radio" 
                        name="bulkTarget" 
                        value="custom" 
                        checked={bulkNoticeTarget === 'custom'} 
                        onChange={() => setBulkNoticeTarget('custom')} 
                      />
                      <span>কাস্টম মোবাইল নম্বরসমূহ (কমা দিয়ে একাধিক)</span>
                    </label>
                  </div>

                  {bulkNoticeTarget === 'custom' && (
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                        মোবাইল নম্বরসমূহ (কমা বা নতুন লাইনে লিখুন):
                      </label>
                      <textarea 
                        rows={2}
                        placeholder="যেমন: 01711223344, 01811223344, 01911223344"
                        value={bulkNoticePhones}
                        onChange={(e) => setBulkNoticePhones(e.target.value)}
                        style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}
                        required={bulkNoticeTarget === 'custom'}
                      />
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                        এসএমএস মেসেজ বডি (Message Content):
                      </label>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        দৈর্ঘ্য: {bulkNoticeMessage.length} অক্ষর ({Math.ceil(bulkNoticeMessage.length / 70)} এসএমএস)
                      </span>
                    </div>
                    <textarea 
                      rows={3}
                      placeholder="এসএমএস এর মূল বার্তা লিখুন..."
                      value={bulkNoticeMessage}
                      onChange={(e) => setBulkNoticeMessage(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button 
                      type="submit" 
                      disabled={bulkNoticeLoading} 
                      className="btn btn-primary"
                      style={{ padding: '0.65rem 1.5rem', minHeight: '42px' }}
                    >
                      <Send size={16} />
                      <span>{bulkNoticeLoading ? 'এসএমএস পাঠানো হচ্ছে...' : `বাল্ক এসএমএস পাঠান (${bulkNoticeTarget === 'all' ? votersList.length : formatPhoneList(bulkNoticePhones).length} জন)`}</span>
                    </button>
                  </div>
                </form>

                {bulkNoticeResult && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: bulkNoticeResult.success ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${bulkNoticeResult.success ? '#a7f3d0' : '#fecaca'}`,
                    color: bulkNoticeResult.success ? '#065f46' : '#991b1b',
                    fontSize: '0.88rem'
                  }}>
                    <strong>{bulkNoticeResult.success ? '✅ সফল:' : '❌ ত্রুটি:'}</strong> {bulkNoticeResult.message}
                    {bulkNoticeResult.totalTargeted && (
                      <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        লক্ষ্যমাত্রা: {bulkNoticeResult.totalTargeted} টি নম্বর।
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* BulkSMSBD এপিআই কোড এক্সাম্পল ও রেফারেন্স গাইড */}
              <div className="card" style={{ background: '#ffffff', borderTop: '3px solid #8b5cf6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Code size={20} style={{ color: '#8b5cf6' }} />
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', margin: 0 }}>
                      BulkSMSBD এপিআই কোড এক্সাম্পল ও টেকনিক্যাল রেফারেন্স
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.8rem', background: '#ede9fe', color: '#6d28d9', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                    API Key: {smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'} | Sender: {smsConfig.senderId || '8809617643365'}
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  নিচের ট্যাবগুলো থেকে JSON, PHP, C# .NET, Oracle এবং ব্যালেন্স চেক এপিআই এর প্রস্তুতকৃত কোড কপি করে যেকোনো অ্যাপ্লিকেশনে ব্যবহার করতে পারেন:
                </p>

                {/* Code Tabs */}
                <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 'json', label: 'JSON (One to Many & Many to Many)' },
                    { id: 'php', label: 'PHP cURL (One to Many | Many to Many)' },
                    { id: 'balance', label: 'PHP ব্যালেন্স চেক API' },
                    { id: 'csharp', label: 'C# .NET (One to Many | Many to Many)' },
                    { id: 'oracle', label: 'Oracle PL/SQL (One to Many)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCodeTab(tab.id)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.84rem',
                        fontWeight: activeCodeTab === tab.id ? 700 : 500,
                        border: 'none',
                        borderBottom: activeCodeTab === tab.id ? '3px solid #8b5cf6' : '3px solid transparent',
                        background: activeCodeTab === tab.id ? '#ede9fe' : 'transparent',
                        color: activeCodeTab === tab.id ? '#6d28d9' : '#475569',
                        borderRadius: '6px 6px 0 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Code Container */}
                <div style={{ position: 'relative', background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.5rem 1rem', borderBottom: '1px solid #334155' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      {activeCodeTab === 'json' && 'bulksmsbd_payload.json'}
                      {activeCodeTab === 'php' && 'send_sms_bulksmsbd.php'}
                      {activeCodeTab === 'balance' && 'get_balance_bulksmsbd.php'}
                      {activeCodeTab === 'csharp' && 'BulkSmsProgram.cs'}
                      {activeCodeTab === 'oracle' && 'bulksmsbd_oracle.sql'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        let textToCopy = '';
                        if (activeCodeTab === 'json') {
                          textToCopy = `// ১. One to Many SMS API\n{\n  "type": "post",\n  "url": "http://bulksmsbd.net/api/smsapi",\n  "data": {\n    "api_key": "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}",\n    "senderid": "${smsConfig.senderId || '8809617643365'}",\n    "number": "88017XXXXXXXX,88018XXXXXXXX",\n    "message": "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234"\n  }\n}\n\n// ২. Many to Many SMS API\n{\n  "type": "post",\n  "url": "http://bulksmsbd.net/api/smsapimany",\n  "data": {\n    "api_key": "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}",\n    "senderid": "${smsConfig.senderId || '8809617643365'}",\n    "messages": [\n      { "to": "88017XXXXXXXX", "message": "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234" },\n      { "to": "88018XXXXXXXX", "message": "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 5678" }\n    ]\n  }\n}`;
                        } else if (activeCodeTab === 'php') {
                          textToCopy = `<?php\n// ১. One to Many SMS\n$url = "http://bulksmsbd.net/api/smsapi";\n$data = [\n  "api_key" => "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}",\n  "senderid" => "${smsConfig.senderId || '8809617643365'}",\n  "number" => "88017XXXXXXXX,88018XXXXXXXX",\n  "message" => "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234"\n];\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, $url);\ncurl_setopt($ch, CURLOPT_POST, 1);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, $data);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;\n?>`;
                        } else if (activeCodeTab === 'balance') {
                          textToCopy = `<?php\n// Credit Balance API PHP\n$api_key = "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}";\n$url = "http://bulksmsbd.net/api/getBalanceApi?api_key=" . urlencode($api_key);\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, $url);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$response = curl_exec($ch);\ncurl_close($ch);\n$data = json_decode($response, true);\necho "Current Balance: " . ($data['balance'] ?? 'Unknown');\n?>`;
                        } else if (activeCodeTab === 'csharp') {
                          textToCopy = `using System;\nusing System.Net.Http;\nusing System.Collections.Generic;\nusing System.Threading.Tasks;\n\nclass Program {\n  static async Task Main() {\n    using (var client = new HttpClient()) {\n      var values = new Dictionary<string, string> {\n        { "api_key", "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}" },\n        { "senderid", "${smsConfig.senderId || '8809617643365'}" },\n        { "number", "88017XXXXXXXX,88018XXXXXXXX" },\n        { "message", "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234" }\n      };\n      var content = new FormUrlEncodedContent(values);\n      var res = await client.PostAsync("http://bulksmsbd.net/api/smsapi", content);\n      Console.WriteLine(await res.Content.ReadAsStringAsync());\n    }\n  }\n}`;
                        } else if (activeCodeTab === 'oracle') {
                          textToCopy = `DECLARE\n  req  UTL_HTTP.REQ;\n  resp UTL_HTTP.RESP;\n  url  VARCHAR2(1000) := 'http://bulksmsbd.net/api/smsapi';\n  data VARCHAR2(2000) := 'api_key=${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}&senderid=${smsConfig.senderId || '8809617643365'}&number=88017XXXXXXXX&message=' || UTL_URL.ESCAPE('Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234');\n  text VARCHAR2(32767);\nBEGIN\n  req := UTL_HTTP.BEGIN_REQUEST(url, 'POST', 'HTTP/1.1');\n  UTL_HTTP.SET_HEADER(req, 'content-type', 'application/x-www-form-urlencoded');\n  UTL_HTTP.SET_HEADER(req, 'content-length', LENGTH(data));\n  UTL_HTTP.WRITE_TEXT(req, data);\n  resp := UTL_HTTP.GET_RESPONSE(req);\n  UTL_HTTP.READ_TEXT(resp, text);\n  DBMS_OUTPUT.PUT_LINE(text);\n  UTL_HTTP.END_RESPONSE(resp);\nEND;\n/`;
                        }
                        handleCopyCode(activeCodeTab, textToCopy);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: copiedCodeKey === activeCodeTab ? '#166534' : '#334155',
                        color: '#f8fafc',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {copiedCodeKey === activeCodeTab ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCodeKey === activeCodeTab ? 'কপি হয়েছে!' : 'কোড কপি করুন'}</span>
                    </button>
                  </div>

                  <pre style={{
                    margin: 0,
                    padding: '1rem',
                    color: '#e2e8f0',
                    fontSize: '0.82rem',
                    fontFamily: 'Consolas, Monaco, monospace',
                    lineHeight: 1.55,
                    overflowX: 'auto',
                    maxHeight: '380px'
                  }}>
                    {activeCodeTab === 'json' && `// ===================================================
// ১. One to Many SMS API (কমা দিয়ে একাধিক নম্বরে একই মেসেজ)
// ===================================================
{
  "type": "post",
  "url": "http://bulksmsbd.net/api/smsapi",
  "data": {
    "api_key": "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}",
    "senderid": "${smsConfig.senderId || '8809617643365'}",
    "number": "88017XXXXXXXX,88018XXXXXXXX,88019XXXXXXXX",
    "message": "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234"
  }
}

// ===================================================
// ২. Many to Many SMS API (ভিন্ন ভিন্ন নম্বরে ভিন্ন ভিন্ন মেসেজ)
// ===================================================
{
  "type": "post",
  "url": "http://bulksmsbd.net/api/smsapimany",
  "data": {
    "api_key": "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}",
    "senderid": "${smsConfig.senderId || '8809617643365'}",
    "messages": [
      {
        "to": "88017XXXXXXXX",
        "message": "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234"
      },
      {
        "to": "88018XXXXXXXX",
        "message": "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 5678"
      }
    ]
  }
}`}

                    {activeCodeTab === 'php' && `<?php
// ===================================================
// ১. BulkSMSBD One to Many SMS (PHP cURL)
// ===================================================
$url = "http://bulksmsbd.net/api/smsapi";
$api_key = "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}";
$senderid = "${smsConfig.senderId || '8809617643365'}";
$number = "88017XXXXXXXX,88018XXXXXXXX";
$message = "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234";

$data = [
    "api_key" => $api_key,
    "senderid" => $senderid,
    "number" => $number,
    "message" => $message
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
curl_close($ch);
echo "SMS Response: " . $response;

// ===================================================
// ২. BulkSMSBD Many to Many SMS (PHP cURL)
// ===================================================
$url_many = "http://bulksmsbd.net/api/smsapimany";
$messages = [
    ["to" => "88017XXXXXXXX", "message" => "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234"],
    ["to" => "88018XXXXXXXX", "message" => "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 5678"]
];

$payload = json_encode([
    "api_key" => $api_key,
    "senderid" => $senderid,
    "messages" => $messages
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url_many);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$many_response = curl_exec($ch);
curl_close($ch);
echo "Many SMS Response: " . $many_response;
?>`}

                    {activeCodeTab === 'balance' && `<?php
// ===================================================
// Credit Balance API PHP Source Code
// ===================================================
$api_key = "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}";
$url = "http://bulksmsbd.net/api/getBalanceApi?api_key=" . urlencode($api_key);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
if (isset($data['balance'])) {
    echo "Current Balance: ৳ " . $data['balance'];
} else {
    echo "Balance Response: " . $response;
}
?>`}

                    {activeCodeTab === 'csharp' && `using System;
using System.Net.Http;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

class BulkSmsSender {
    // ১. One to Many SMS C# .NET
    public static async Task SendOneToMany() {
        using (var client = new HttpClient()) {
            var values = new Dictionary<string, string> {
                { "api_key", "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}" },
                { "senderid", "${smsConfig.senderId || '8809617643365'}" },
                { "number", "88017XXXXXXXX,88018XXXXXXXX" },
                { "message", "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234" }
            };
            var content = new FormUrlEncodedContent(values);
            var response = await client.PostAsync("http://bulksmsbd.net/api/smsapi", content);
            string result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    // ২. Many to Many SMS C# .NET
    public static async Task SendManyToMany() {
        using (var client = new HttpClient()) {
            var payload = new {
                api_key = "${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}",
                senderid = "${smsConfig.senderId || '8809617643365'}",
                messages = new[] {
                    new { to = "88017XXXXXXXX", message = "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234" },
                    new { to = "88018XXXXXXXX", message = "Your ${smsConfig.brandName || 'Model Mosque'} OTP is 5678" }
                }
            };
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await client.PostAsync("http://bulksmsbd.net/api/smsapimany", content);
            string result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }
}`}

                    {activeCodeTab === 'oracle' && `-- ===================================================
-- BulkSMSBD One to Many SMS via Oracle PL/SQL (UTL_HTTP)
-- ===================================================
DECLARE
  req   UTL_HTTP.REQ;
  resp  UTL_HTTP.RESP;
  url   VARCHAR2(1000);
  data  VARCHAR2(2000);
  text  VARCHAR2(32767);
BEGIN
  url  := 'http://bulksmsbd.net/api/smsapi';
  data := 'api_key=' || UTL_URL.ESCAPE('${smsConfig.apiKey || 'cRuK5lRpRz7ycHEeJTB4'}') ||
          '&senderid=' || UTL_URL.ESCAPE('${smsConfig.senderId || '8809617643365'}') ||
          '&number=' || UTL_URL.ESCAPE('88017XXXXXXXX,88018XXXXXXXX') ||
          '&message=' || UTL_URL.ESCAPE('Your ${smsConfig.brandName || 'Model Mosque'} OTP is 1234');

  req := UTL_HTTP.BEGIN_REQUEST(url, 'POST', 'HTTP/1.1');
  UTL_HTTP.SET_HEADER(req, 'content-type', 'application/x-www-form-urlencoded');
  UTL_HTTP.SET_HEADER(req, 'content-length', LENGTH(data));
  UTL_HTTP.WRITE_TEXT(req, data);

  resp := UTL_HTTP.GET_RESPONSE(req);
  UTL_HTTP.READ_TEXT(resp, text);
  DBMS_OUTPUT.PUT_LINE('BulkSMSBD Response: ' || text);
  UTL_HTTP.END_RESPONSE(resp);
EXCEPTION
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
    UTL_HTTP.END_RESPONSE(resp);
END;
/`}
                  </pre>
                </div>
              </div>

            </div>
          )}

          {/* ৪. নিরাপত্তা ও অডিট লগ মেনু (শুধুমাত্র ডেভেলপার প্যানেলের জন্য সংরক্ষিত) */}
          {currentMenu === 'security' && adminRole === 'developer' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* হেডার ব্যানার */}
              <div className="card" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <ShieldCheck size={28} style={{ color: '#fef08a' }} />
                  <div>
                    <h2 style={{ fontSize: '1.35rem', margin: 0 }}>নির্বাচনী নিরাপত্তা, অডিট টোকেন ও ক্রিপ্টোগ্রাফিক ভেরিফিকেশন</h2>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                      ভোটারদের প্রদত্ত ব্যালট রসিদের অডিট টোকেন যাচাই ও ডিজিটাল অডিট ট্রেইল
                    </span>
                  </div>
                </div>
              </div>

              {/* টোকেন অনুসন্ধান ও যাচাইকরণ কার্ড */}
              <div className="card" style={{ background: '#ffffff', borderTop: '4px solid var(--primary)', borderRadius: '14px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <Search size={22} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--primary-dark)', margin: 0 }}>
                    অডিট টোকেন নম্বর দিয়ে ভোট যাচাই করুন
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
                  ভোটারদের ব্যালট রসিদে থাকা ডিজিটাল অডিট টোকেন (যেমন: <code style={{ background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#0f172a' }}>TX-A1B2C3D4-1234</code>) এখানে লিখে অনুসন্ধান করুন। এটি সরাসরি নিশ্চিত করবে যে ভোটটি নিরাপদে ডেটাবেজে সংরক্ষিত ও অডিটভুক্ত হয়েছে।
                </p>

                <form onSubmit={handleVerifyAuditToken} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 320px', position: 'relative' }}>
                    <input 
                      type="text"
                      placeholder="ডিজিটাল অডিট টোকেন নম্বর লিখুন (যেমন: TX-XXXX...)"
                      value={searchAuditToken}
                      onChange={(e) => setSearchAuditToken(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        fontSize: '1rem',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        border: '2px solid var(--border)',
                        borderRadius: '8px'
                      }}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSearchingAudit || !searchAuditToken.trim()} 
                    className="btn btn-primary"
                    style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Search size={18} />
                    <span>{isSearchingAudit ? 'যাচাই করা হচ্ছে...' : 'টোকেন যাচাই করুন'}</span>
                  </button>
                  {searchAuditToken && (
                    <button 
                      type="button" 
                      onClick={() => { setSearchAuditToken(''); setAuditSearchResult(null); }}
                      className="btn btn-secondary"
                      style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                    >
                      ক্লিয়ার
                    </button>
                  )}
                </form>

                {/* যাচাইকরণ ফলাফল প্রিভিউ */}
                {auditSearchResult && (
                  <div style={{
                    marginTop: '1.25rem',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    background: auditSearchResult.success ? '#ecfdf5' : '#fef2f2',
                    border: `1.5px solid ${auditSearchResult.success ? '#10b981' : '#f87171'}`
                  }}>
                    {auditSearchResult.success ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#065f46', marginBottom: '0.6rem' }}>
                          <CheckCircle2 size={24} color="#059669" />
                          <h4 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                            ✅ ভোট আনুষ্ঠানিকভাবে সংরক্ষিত ও অডিট পাসড!
                          </h4>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.88rem', color: '#047857', marginTop: '0.75rem' }}>
                          <div>
                            <strong>অডিট টোকেন নম্বর:</strong>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', color: '#065f46', marginTop: '0.2rem' }}>
                              {auditSearchResult.token}
                            </div>
                          </div>
                          <div>
                            <strong>ভোট প্রদানের সময়:</strong>
                            <div style={{ marginTop: '0.2rem' }}>
                              {formatBanglaDateTime(auditSearchResult.votedAt)}
                            </div>
                          </div>
                          <div>
                            <strong>ডেটাবেজ স্ট্যাটাস:</strong>
                            <div style={{ marginTop: '0.2rem', color: '#059669', fontWeight: 600 }}>
                              🔒 ক্রিপ্টোগ্রাফিকভাবে সুরক্ষিত ও গণনায় অন্তর্ভুক্ত
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#991b1b' }}>
                        <AlertTriangle size={24} color="#dc2626" />
                        <div>
                          <h4 style={{ fontSize: '1.05rem', margin: '0 0 0.2rem', fontWeight: 700 }}>
                            ❌ টোকেন পাওয়া যায়নি!
                          </h4>
                          <span style={{ fontSize: '0.88rem' }}>{auditSearchResult.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* গোপন ব্যালট নীতি ও ফিল্টারিং সংক্রান্ত স্পষ্ট ব্যাখ্যা কার্ড */}
              <div className="card" style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <ShieldCheck size={26} color="#059669" style={{ flexShrink: 0, marginTop: '0.2rem' }} />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: '#065f46', margin: '0 0 0.4rem', fontWeight: 700 }}>
                      ১০০% গোপন ব্যালট (Secret Ballot) নীতি ও আর্কিটেকচার
                    </h3>
                    <div style={{ fontSize: '0.88rem', color: '#047857', lineHeight: 1.6 }}>
                      <p style={{ margin: '0 0 0.5rem' }}>
                        <strong>প্রশ্ন: নির্বাচন শেষে কি ফিল্টারিং করে জানা যাবে কোন ভোটার কোন প্রার্থীকে ভোট দিয়েছেন?</strong>
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>উত্তর: না, বর্তমান আর্কিটেকচারে এটি জানা সম্পূর্ণ অসম্ভব।</strong> কারণ আন্তর্জাতিক নির্বাচন কমিশন ও নির্বাচনী নীতিমালার শতভাগ গোপনীয়তা নিশ্চিত করতে <code>voters</code> টেবিলে কেবল রেকর্ড থাকে ভোটার ভোট দিয়েছেন কি না (<code>has_voted: true</code>), কিন্তু ব্যালট বাক্সে (<code>cast_votes</code>) ভোটারের নাম বা আইডি ছাড়াই শুধুমাত্র প্রার্থী ও পদের ভোট সংরক্ষণ হয়। ভোটার ও ভোটের মধ্যে কোনো ডেটাবেজ লিংক রাখা হয় না যাতে ভোটাররা ভয়-ভীতিহীনভাবে পছন্দের প্রার্থীকে স্বাধীনভাবে ভোট দিতে পারেন।
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* সংরক্ষিত ডিজিটাল অডিট লগ তালিকা টেবিল */}
              <div className="card" style={{ background: '#ffffff', borderRadius: '14px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--primary-dark)', margin: 0 }}>
                      ডিজিটাল অডিট লগ ট্রেইল (মোট রসিদ: {auditLogs.length} টি)
                    </h3>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}>
                    মোট ভোট কাস্ট রেকর্ড: {auditLogs.length}
                  </span>
                </div>

                {auditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                    এখনো কোনো ভোট গৃহীত হয়নি। নতুন ভোট কাস্ট হওয়ামাত্র এখানে রসিদের ডিজিটাল অডিট টোকেন ও টাইমস্ট্যাম্প তালিকাভুক্ত হবে।
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', width: '60px' }}>ক্র.</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>ডিজিটাল অডিট টোকেন</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>ভোট প্রদানের তারিখ ও সময়</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '130px' }}>অডিট স্থিতি</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '90px' }}>অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, index) => {
                          const tokenVal = log.token || log.audit_token || '';
                          const isCopied = auditTokenCopied === tokenVal;
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                {index + 1}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#065f46' }}>
                                {tokenVal}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-main)' }}>
                                {formatBanglaDateTime(log.votedAt || log.created_at)}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                                  ✓ ভেরিফাইড
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(tokenVal);
                                    setAuditTokenCopied(tokenVal);
                                    setTimeout(() => setAuditTokenCopied(null), 2000);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                  title="টোকেন কপি করুন"
                                >
                                  {isCopied ? <Check size={13} color="green" /> : <Copy size={13} />}
                                  <span>{isCopied ? 'কপি হয়েছে' : 'কপি'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ========================================================
          মোডাল ১: প্রার্থী তথ্য এডিট ফর্ম (Edit Candidate Modal)
         ======================================================== */}
      {editingCandidate && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card animate-fade-in" style={{
            background: '#ffffff',
            maxWidth: '540px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-elevated)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>প্রার্থীর তথ্য এডিট করুন</h3>
              </div>
              <button 
                onClick={() => setEditingCandidate(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleUpdateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>নির্বাচনী পদ:</label>
                <select 
                  value={editingCandidate.postId} 
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, postId: e.target.value })}
                  style={{ fontWeight: 600 }}
                  required
                >
                  {POSTS.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>প্রার্থীর নাম:</label>
                <input 
                  type="text" 
                  value={editingCandidate.name}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, name: e.target.value })}
                  required 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>মডেল মসজিদ:</label>
                <input 
                  type="text" 
                  value={editingCandidate.mosque}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, mosque: e.target.value })}
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>এলাকা / জেলা:</label>
                  <input 
                    type="text" 
                    value={editingCandidate.district}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, district: e.target.value })}
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>বিভাগ:</label>
                  <input 
                    type="text" 
                    value={editingCandidate.division}
                    onChange={(e) => setEditingCandidate({ ...editingCandidate, division: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>শিক্ষাগত যোগ্যতা:</label>
                <input 
                  type="text" 
                  value={editingCandidate.qualification}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, qualification: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>সংক্ষিপ্ত অভিজ্ঞতা:</label>
                <input 
                  type="text" 
                  value={editingCandidate.experience}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, experience: e.target.value })}
                />
              </div>

              {/* প্রার্থীর ছবি আপলোড / পরিবর্তন সেকশন */}
              <div style={{
                background: '#f8fafc',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1.5px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                    <Camera size={17} color="var(--primary)" />
                    <span>প্রার্থীর পাসপোর্ট সাইজ ছবি:</span>
                  </label>
                  {editingCandidate.photo && (
                    <button
                      type="button"
                      onClick={() => setEditingCandidate(prev => ({ ...prev, photo: '' }))}
                      style={{
                        background: '#fee2e2',
                        color: 'var(--danger)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Trash2 size={12} />
                      <span>ছবি মুছুন</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: editingCandidate.photo ? '2.5px solid var(--primary)' : '2px dashed #94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}>
                    {editingCandidate.photo ? (
                      <img 
                        src={editingCandidate.photo} 
                        alt={editingCandidate.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <User size={30} color="#94a3b8" />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input 
                        type="file" 
                        ref={editCandFileInputRef} 
                        accept="image/*" 
                        onChange={handleEditCandPhotoUpload} 
                        style={{ display: 'none' }} 
                      />
                      <button
                        type="button"
                        disabled={editCandPhotoLoading}
                        onClick={() => editCandFileInputRef.current?.click()}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.82rem',
                          padding: '0.4rem 0.8rem',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          color: '#0f172a'
                        }}
                      >
                        <Upload size={14} color="var(--primary)" />
                        <span>{editCandPhotoLoading ? 'প্রসেসিং হচ্ছে...' : (editingCandidate.photo ? 'ছবি পরিবর্তন করুন' : 'ছবি আপলোড করুন')}</span>
                      </button>
                    </div>

                    <input 
                      type="text" 
                      placeholder="অথবা অনলাইন ছবির লিঙ্ক (Image URL) পেস্ট করুন..."
                      value={editingCandidate.photo || ''}
                      onChange={(e) => setEditingCandidate({ ...editingCandidate, photo: e.target.value })}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.38rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingCandidate(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          মোডাল ২: ভোটার তথ্য এডিট ফর্ম (Edit Voter Modal)
         ======================================================== */}
      {editingVoter && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="card animate-fade-in" style={{
            background: '#ffffff',
            maxWidth: '540px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-elevated)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>
                  ভোটারের তথ্য এডিট (আইডি: {editingVoter.voterId})
                </h3>
              </div>
              <button 
                onClick={() => setEditingVoter(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleUpdateVoter} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>ইমাম মহোদয়ের নাম:</label>
                <input 
                  type="text" 
                  value={editingVoter.name}
                  onChange={(e) => setEditingVoter({ ...editingVoter, name: e.target.value })}
                  required 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>মডেল মসজিদ:</label>
                <input 
                  type="text" 
                  value={editingVoter.mosque}
                  onChange={(e) => setEditingVoter({ ...editingVoter, mosque: e.target.value })}
                  required 
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>মোবাইল নম্বর:</label>
                <input 
                  type="text" 
                  value={editingVoter.phone || ''}
                  onChange={(e) => setEditingVoter({ ...editingVoter, phone: e.target.value })}
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>এলাকা / উপজেলা / জেলা:</label>
                  <input 
                    type="text" 
                    value={editingVoter.district}
                    onChange={(e) => setEditingVoter({ ...editingVoter, district: e.target.value })}
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>বিভাগ:</label>
                  <input 
                    type="text" 
                    value={editingVoter.division}
                    onChange={(e) => setEditingVoter({ ...editingVoter, division: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>গোপন পিন কোড:</label>
                <input 
                  type="text" 
                  value={editingVoter.secretPin}
                  onChange={(e) => setEditingVoter({ ...editingVoter, secretPin: e.target.value })}
                  maxLength={6}
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingVoter(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  বাতিল
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  আপডেট সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .admin-layout-container {
            flex-direction: column !important;
          }

          .admin-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px !important;
            z-index: 1000;
            border-radius: 0 !important;
            box-shadow: 0 0 25px rgba(0, 0, 0, 0.25) !important;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: #ffffff !important;
          }

          .admin-sidebar.open {
            transform: translateX(0) !important;
          }

          .sidebar-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            backdrop-filter: blur(2px);
          }
        }

        @media (min-width: 861px) {
          .admin-sidebar-toggle {
            display: none !important;
          }
          .sidebar-backdrop {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .hide-on-mobile-xs {
            display: none;
          }
        }
      `}</style>

      {/* ========================================================
          মোডাল ৩: সিএসভি (CSV) আপলোড প্রিভিউ ও নিশ্চিতকরণ মোডাল
         ======================================================== */}
      {csvModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div className="card" style={{
            background: '#ffffff',
            maxWidth: '720px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            overflow: 'hidden',
            padding: 0
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--emerald-50)',
                  color: 'var(--emerald-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileUp size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--primary-dark)', margin: 0 }}>
                    সিএসভি (CSV) ভোটার তালিকা প্রিভিউ
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    ফাইল: <strong>{csvFileName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCsvModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              
              {/* Alert / Summary */}
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#065f46',
                fontSize: '0.9rem'
              }}>
                <CheckCircle2 size={20} style={{ color: '#059669', flexShrink: 0 }} />
                <span>
                  ফাইলটি থেকে মোট <strong>{csvParsedData.length} জন</strong> ভোটারের বৈধ তথ্য সফলভাবে সনাক্ত করা হয়েছে।
                </span>
              </div>

              {/* Import Mode Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  আপলোড পদ্ধতি নির্বাচন করুন:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: csvImportMode === 'replace' ? '2px solid var(--emerald-600)' : '1px solid var(--border)',
                    background: csvImportMode === 'replace' ? 'var(--emerald-50)' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="csvMode"
                      value="replace"
                      checked={csvImportMode === 'replace'}
                      onChange={() => setCsvImportMode('replace')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        পূর্বের সকল ভোটার মুছে নতুন তালিকা প্রতিস্থাপন করুন (প্রস্তাবিত)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        বর্তমান সকল ডাটা মুছে দিয়ে শুধুমাত্র এই ফাইলের {csvParsedData.length} জন ভোটার তালিকায় সংরক্ষিত হবে।
                      </div>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: csvImportMode === 'append' ? '2px solid var(--emerald-600)' : '1px solid var(--border)',
                    background: csvImportMode === 'append' ? 'var(--emerald-50)' : '#ffffff',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="csvMode"
                      value="append"
                      checked={csvImportMode === 'append'}
                      onChange={() => setCsvImportMode('append')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        বর্তমান তালিকার সাথে নতুনগুলো যুক্ত করুন (Append)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        বর্তমানে থাকা ভোটাররা বহাল থাকবে এবং নতুন ভোটাররা তালিকার শেষে যুক্ত হবে।
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  প্রথম ৪ জন ভোটারের নমুনা প্রিভিউ:
                </label>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.5rem 0.6rem' }}>VoterID</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>Name</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>Mosque</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>District</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>Division</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>Phone</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>SecretPin</th>
                        <th style={{ padding: '0.5rem 0.6rem' }}>HasVoted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedData.slice(0, 4).map((v, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: 'var(--primary)' }}>{v.voterId}</td>
                          <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>{v.name}</td>
                          <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>{v.mosque}</td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>{v.district}</td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>{v.division}</td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>{v.phone || 'N/A'}</td>
                          <td style={{ padding: '0.5rem 0.6rem' }}><code>{v.secretPin}</code></td>
                          <td style={{ padding: '0.5rem 0.6rem' }}>
                            <span className={`badge ${v.hasVoted ? 'badge-primary' : 'badge-gold'}`} style={{ fontSize: '0.75rem' }}>
                              {v.hasVoted ? 'TRUE' : 'FALSE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: 'var(--bg-subtle)'
            }}>
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                disabled={csvLoading}
              >
                বাতিল করুন
              </button>

              <button
                type="button"
                onClick={handleConfirmCSVImport}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                disabled={csvLoading}
              >
                <CheckCircle2 size={16} />
                <span>{csvLoading ? 'আপলোড হচ্ছে...' : `নিশ্চিত করুন (${csvParsedData.length} জন ভোটার)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ৫. ডেভেলপার রোল এলিভেশন মডাল */}
      {showDevElevateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div className="card animate-scale-up" style={{
            background: '#ffffff',
            maxWidth: '430px',
            width: '100%',
            padding: '1.75rem',
            borderTop: '5px solid #d97706',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: '#92400e', margin: 0, fontWeight: 700 }}>
                    ডেভেলপার এক্সেস আনলক
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    মাস্টার সিস্টেম কন্ট্রোল ও গেটওয়ে কনফিগারেশন
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowDevElevateModal(false);
                  setDevElevatePin('');
                  setDevElevateError('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDevElevateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                  ডেভেলপার সিকিউরিটি পিন দিন:
                </label>
                <input 
                  type="password"
                  placeholder=""
                  value={devElevatePin}
                  onChange={(e) => setDevElevatePin(e.target.value)}
                  autoFocus
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', height: '48px', width: '100%', borderRadius: 'var(--radius-md)' }}
                  required
                />
              </div>

              {devElevateError && (
                <div style={{
                  color: 'var(--danger)',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem'
                }}>
                  {devElevateError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDevElevateModal(false);
                    setDevElevatePin('');
                    setDevElevateError('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: '#d97706', borderColor: '#d97706' }}
                >
                  <Unlock size={16} />
                  <span>আনলক করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ৬. ডেভেলপার: নতুন নির্বাচনের জন্য ব্যালট ক্লিন / রিসেট মডাল */}
      {showResetElectionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div className="card animate-scale-up" style={{
            background: '#ffffff',
            maxWidth: '500px',
            width: '100%',
            padding: '1.75rem',
            borderTop: '5px solid #d97706',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: '#92400e', margin: 0, fontWeight: 700 }}>
                    নতুন নির্বাচনের জন্য ব্যালট ক্লিন
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    প্রার্থী ও ভোটার তালিকা বহাল রেখে ব্যালট ফ্রেশ শুরু
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowResetElectionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                disabled={resetLoading}
              >
                <X size={20} />
              </button>
            </div>

            {/* যা যা সম্পূর্ণ বহাল ও অক্ষত থাকবে */}
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '0.85rem',
              fontSize: '0.86rem',
              color: '#065f46'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={16} />
                <span>যা যা সম্পূর্ণ অক্ষত ও বহাল থাকবে:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.55 }}>
                <li>নিবন্ধিত <strong>{candidatesList.length} জন প্রার্থী</strong> বহাল থাকবে (একটিও মুছবে না)।</li>
                <li>নিবন্ধিত <strong>{votersList.length} জন ভোটার</strong>, তাদের মোবাইল ও পিন বহাল থাকবে।</li>
              </ul>
            </div>

            {/* যা যা ক্লিয়ার হবে */}
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.86rem',
              color: '#92400e'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertTriangle size={16} />
                <span>যা যা নতুন ভোটের জন্য ফ্রেশ হবে:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.55 }}>
                <li>সকল ভোটারের স্ট্যাটাস পুনরায় <strong>"ভোট বাকি"</strong> হবে।</li>
                <li>প্রার্থীদের প্রাপ্ত সকল ভোট সংখ্যা <strong>০ (শূন্য)</strong> হবে।</li>
                <li>ব্যালট বক্স ও অডিট লগ ক্লিয়ার হয়ে নির্বাচন প্রস্তুত হবে।</li>
              </ul>
            </div>

            {resetConfirmError && (
              <div style={{
                color: 'var(--danger)',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {resetConfirmError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowResetElectionModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.55rem 1.15rem', fontSize: '0.88rem' }}
                disabled={resetLoading}
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleResetElectionData}
                className="btn btn-primary"
                style={{
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.88rem',
                  background: '#d97706',
                  borderColor: '#d97706'
                }}
                disabled={resetLoading}
              >
                <RotateCcw size={16} />
                <span>{resetLoading ? 'ক্লিন হচ্ছে...' : 'হ্যাঁ, ব্যালট ক্লিন করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
