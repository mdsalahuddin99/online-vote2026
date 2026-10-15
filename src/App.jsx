import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomeView from './views/HomeView';
import CandidatesView from './views/CandidatesView';
import VotingView from './views/VotingView';
import ResultsView from './views/ResultsView';
import AdminView from './views/AdminView';

import { 
  ELECTION_SETTINGS, 
  INITIAL_VOTERS, 
  CANDIDATES 
} from './data/electionData';
import { IMPORTED_VOTERS } from './data/pdfVotersData';
import { supabase, isSupabaseConfigured, submitVoteSecurely, fetchResultsFromDB } from './lib/supabase';

// নিরাপত্তা: localStorage-এ সংরক্ষণের আগে সেনসিটিভ ফিল্ড (secretPin) বাদ দেওয়া
const stripSensitiveFields = (voters) => {
  return voters.map(({ secretPin, ...safeVoter }) => safeVoter);
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // URL পাথ থেকে বর্তমান ভিউ বা ট্যাব নির্ধারণ (পাবলিক পেজ: শুধুমাত্র ভোট প্রদান ও ফলাফল তালিকা)
  const pathToTab = {
    '/': 'voting',
    '/voting': 'voting',
    '/vote': 'voting',
    '/results': 'results',
    '/admin': 'admin'
  };

  const tabToPath = {
    'voting': '/voting',
    'results': '/results',
    'admin': '/admin'
  };

  const activeTab = pathToTab[location.pathname] || 'home';

  const setActiveTab = (tab) => {
    const targetPath = tabToPath[tab] || (tab.startsWith('/') ? tab : `/${tab}`);
    navigate(targetPath);
  };

  // রুট পরিবর্তিত হলে পেইজের শীর্ষে স্ক্রল করা
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const [electionSettings, setElectionSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('mm_election_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.status || parsed.startTime)) return parsed;
      }
    } catch (e) {}
    return ELECTION_SETTINGS;
  });
  const [votersList, setVotersList] = useState(() => {
    try {
      const saved = localStorage.getItem('mm_voters_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        // সিড ডাটা বাদ দেওয়া (যদি পুরানো ডেমো ভোটার থাকে যেমন 01711111111 ইত্যাদি)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter(v => v.phone !== '01711111111' && v.name !== 'মাওলানা মোহাম্মদ আব্দুল্লাহ' && v.phone !== '01819222222' && v.phone !== '01725333333' && v.phone !== '01912444444' && v.phone !== '01713555555');
          if (clean.length > 0) return clean;
        }
      }
    } catch (e) {}
    if (IMPORTED_VOTERS && IMPORTED_VOTERS.length > 0) return IMPORTED_VOTERS;
    return [];
  });
  const [candidatesList, setCandidatesList] = useState(() => {
    try {
      const saved = localStorage.getItem('mm_candidates_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isOfficial = parsed.some(c => c.id === 'c_pres_1' || c.name === 'মুফতি আহমদ মাসরুর');
          if (isOfficial) return parsed;
        }
      }
    } catch (e) {}
    return CANDIDATES || [];
  });
  // নিরাপত্তা: অডিট লগ আর localStorage-এ সংরক্ষণ করা হয় না, শুধু React state ও Supabase-এ থাকে
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // সেটিংস, ভোটার ও প্রার্থী তালিকা লোকাল স্টোরেজে সংরক্ষণ
  useEffect(() => {
    try {
      localStorage.setItem('mm_election_settings', JSON.stringify(electionSettings));
      localStorage.setItem('mm_voters_list', JSON.stringify(stripSensitiveFields(votersList)));
      localStorage.setItem('mm_candidates_list', JSON.stringify(candidatesList));
    } catch (e) {}
  }, [electionSettings, votersList, candidatesList]);

  // সুপাবেস থেকে লাইভ ডাটা লোড করা
  const loadDataFromSupabase = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      // ১. সেটিংস
      const { data: settingsData } = await supabase.from('election_settings').select('*').eq('id', 1).maybeSingle();
      let currentStatus = electionSettings.status;
      let effectiveSettings = electionSettings;

      if (settingsData) {
        const now = new Date();
        const endTimeDate = settingsData.end_time ? new Date(settingsData.end_time) : null;
        // শুধুমাত্র চলমান (ongoing) নির্বাচনের ক্ষেত্রে নির্ধারিত সময় শেষ হলে 'ended' হবে
        // কিন্তু স্ট্যাটাস 'upcoming' (আসন্ন/নতুন রিসেট) থাকলে কখনোই স্বয়ংক্রিয় 'ended' হবে না
        const isTimeExpired = (settingsData.status === 'ongoing') && Boolean(endTimeDate && now >= endTimeDate);
        currentStatus = (settingsData.status === 'ended' || isTimeExpired) ? 'ended' : settingsData.status;

        effectiveSettings = {
          ...electionSettings,
          title: settingsData.title || electionSettings.title,
          status: currentStatus,
          term: settingsData.term || electionSettings.term,
          startTime: settingsData.start_time || electionSettings.startTime,
          endTime: settingsData.end_time || electionSettings.endTime
        };

        setElectionSettings(effectiveSettings);
        try {
          localStorage.setItem('mm_election_settings', JSON.stringify(effectiveSettings));
        } catch (e) {}

        // যদি চলমান নির্বাচনের শেষ সময় পার হয়ে থাকে কিন্তু সার্ভার স্ট্যাটাস এখনও 'ended' হয়নি, ডাটাবেসে সিঙ্ক করে দেওয়া
        if (isTimeExpired && settingsData.status !== 'ended') {
          try {
            await supabase.from('election_settings').upsert({
              id: 1,
              status: 'ended',
              updated_at: new Date().toISOString()
            });
          } catch (e) {}
        }
      }

      // ২. ভোটার তালিকা (সুপাবেস থেকে সরাসরি সিঙ্ক করা)
      const { data: vData, error: vErr } = await supabase.from('voters').select('*').order('voter_id');
      let activeVoters = votersList;
      if (!vErr && vData) {
        const formatted = vData.map(v => ({
          voterId: v.voter_id,
          secretPin: v.secret_pin,
          name: v.name,
          fatherName: v.father_name,
          mosque: v.mosque,
          district: v.district,
          division: v.division,
          phone: v.phone,
          hasVoted: v.has_voted,
          votedAt: v.voted_at
        }));
        activeVoters = formatted;
        setVotersList(formatted);
        try {
          // নিরাপত্তা: secretPin ছাড়া localStorage-এ ক্যাশ করা
          localStorage.setItem('mm_voters_list', JSON.stringify(stripSensitiveFields(formatted)));
        } catch (e) {}
      } else if (vErr) {
        console.warn('Supabase voters load error:', vErr);
        // সুপাবেসে নেটওয়ার্ক সমস্যা বা এরর হলে লোকাল ক্যাশ থেকে ব্যাকআপ লোড করা
        try {
          const saved = localStorage.getItem('mm_voters_list');
          if (saved) {
            const parsed = JSON.parse(saved);
            activeVoters = parsed;
            setVotersList(parsed);
          }
        } catch (e) {}
      }

      // ৩. প্রার্থী তালিকা ও ফলাফল সিঙ্ক
      const { data: cData } = await supabase.from('candidates').select('*');
      const hasOfficial = cData && cData.some(c => c.id === 'c_pres_1' || c.name === 'মুফতি আহমদ মাসরুর');

      // যদি সুপাবেসে প্রার্থী তালিকা খালি থাকে বা এখনো নতুন ১২ জন সেভ না হয়ে থাকে
      if (!cData || cData.length === 0 || !hasOfficial) {
        try {
          if (cData && cData.length > 0 && !hasOfficial) {
            // পুরনো ডামি ডাটা মুছে ফেলা
            await supabase.from('candidates').delete().neq('id', 'keep_none');
          }
          const payload = CANDIDATES.map(c => ({
            id: c.id,
            post_id: c.postId,
            name: c.name,
            mosque: c.mosque,
            district: c.district,
            division: c.division
          }));
          await supabase.from('candidates').upsert(payload);
          setCandidatesList(CANDIDATES);
          try {
            localStorage.setItem('mm_candidates_list', JSON.stringify(CANDIDATES));
          } catch (e) {}
        } catch (sErr) {
          console.warn('Auto-seed candidates error:', sErr);
          setCandidatesList(CANDIDATES);
        }
      } else {
        // সুপাবেসে ১২ জন প্রার্থী বিদ্যমান -> লোড করা
        let resultsMap = {};
        const isEndedNow = currentStatus === 'ended' || (settingsData && settingsData.status === 'ended');
        const totalVotedInList = (activeVoters || []).filter(v => v.hasVoted).length;

        // শুধুমাত্র নির্বাচন সমাপ্ত হলে এবং কমপক্ষে একজন ভোটার ভোট দিয়ে থাকলে তবেই ডাটাবেজ থেকে ফলাফল ফেচ করা
        if (isEndedNow && totalVotedInList > 0) {
          try {
            const resData = await fetchResultsFromDB();
            if (resData && resData.is_ended && Array.isArray(resData.results)) {
              resData.results.forEach(r => {
                resultsMap[r.candidate_id] = r.votes_count || 0;
              });
            }
          } catch (rErr) {
            console.warn('Results fetch error:', rErr);
          }
        }

        const formattedCands = cData.map(c => {
          const prevCand = candidatesList.find(prev => prev.id === c.id);
          // যদি মোট ভোটার উপস্থিতি ০ হয় বা নির্বাচন এখনো শেষ না হয়, তাহলে ভোট সংখ্যা সর্বদা ০ থাকবে
          const finalVotes = (totalVotedInList === 0 || !isEndedNow) 
            ? 0 
            : (resultsMap[c.id] !== undefined ? resultsMap[c.id] : 0);

          return {
            id: c.id,
            postId: c.post_id,
            name: c.name,
            mosque: c.mosque,
            district: c.district,
            division: c.division,
            qualification: c.qualification || prevCand?.qualification || '',
            experience: c.experience || prevCand?.experience || '',
            photo: c.photo || prevCand?.photo || '',
            votesCount: finalVotes
          };
        });
        setCandidatesList(formattedCands);
        try {
          localStorage.setItem('mm_candidates_list', JSON.stringify(formattedCands));
        } catch (e) {}
      }

      // ৪. অডিট লগ সিঙ্ক (নিরাপত্তা: শুধু React state-এ রাখা, localStorage-এ নয়)
      try {
        const { data: aData } = await supabase.from('voting_audit_logs').select('audit_token, created_at').order('created_at', { ascending: false });
        if (aData && aData.length > 0) {
          const formattedAudits = aData.map(a => ({
            token: a.audit_token,
            votedAt: a.created_at
          }));
          setAuditLogs(formattedAudits);
        }
      } catch (err) {}

      setIsLiveConnected(true);
    } catch (err) {
      console.error('Supabase load error:', err);
    }
  };

  useEffect(() => {
    loadDataFromSupabase();
  }, []);

  // পরিসংখ্যান ক্যালকুলেশন
  const totalVoters = votersList.length;
  const votedCount = votersList.filter(v => v.hasVoted).length;
  const remainingCount = totalVoters - votedCount;

  const stats = {
    totalVoters,
    votedCount,
    remainingCount
  };

  // ভোট সফল হওয়ার পর হ্যান্ডলার (নিরাপদ সুপাবেস আরপিসি ও স্টেট সিঙ্ক)
  const handleCastVoteSuccess = async ({ voterId, secretPin, selections, token, voterName, mosque, phone }) => {
    const defaultToken = token || ('TX-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4));

    // ১. সুপাবেসে নিরাপদ অ্যাটমিক ভোট সাবমিট (RPC / Row-Lock ট্রানজেকশন)
    let finalToken = defaultToken;
    if (isSupabaseConfigured()) {
      const res = await submitVoteSecurely({
        voterId,
        secretPin,
        ballotSelections: selections,
        auditToken: defaultToken
      });

      if (!res.success) {
        alert(res.message || 'ভোট সাবমিট করতে সমস্যা হয়েছে!');
        return null;
      }
      if (res.audit_token) {
        finalToken = res.audit_token;
      }
    }

    // ২. লোকাল অডিট রেকর্ড আপডেট (চ্যালেঞ্জ ভেরিফিকেশন ও সেশন ডিসপ্লে)
    const auditRecord = {
      token: finalToken,
      mosque: mosque || '',
      phone: phone || '',
      selections,
      votedAt: new Date().toISOString()
    };

    // নিরাপত্তা: অডিট লগ শুধু React state-এ রাখা (localStorage-এ নয়)
    setAuditLogs(prev => [auditRecord, ...prev.filter(a => a.token !== finalToken)]);

    // লোকাল ভোটার তালিকা আপডেট ও লোকাল স্টোরেজে তাৎক্ষণিক সেভ (যাতে রিলোডে ডাটা সুরক্ষিত থাকে)
    setVotersList(prev => {
      const updated = prev.map(v => {
        if (v.voterId === voterId) {
          return {
            ...v,
            hasVoted: true,
            votedAt: new Date().toISOString()
          };
        }
        return v;
      });
      try {
        // নিরাপত্তা: secretPin বাদ দিয়ে localStorage-এ সংরক্ষণ
        localStorage.setItem('mm_voters_list', JSON.stringify(stripSensitiveFields(updated)));
      } catch (e) {}
      return updated;
    });

    setCandidatesList(prev => prev.map(cand => {
      if (selections[cand.postId] === cand.id) {
        return {
          ...cand,
          votesCount: (cand.votesCount || 0) + 1
        };
      }
      return cand;
    }));

    return finalToken;
  };

  const isAdmin = location.pathname.startsWith('/admin') || activeTab === 'admin';

  return (
    <div className="app-container">
      {/* পাবলিক ন্যাভিগেশন বার (এডমিন প্যানেলে হাইড থাকবে) */}
      {!isAdmin && (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          electionSettings={electionSettings} 
          isLiveConnected={isLiveConnected}
        />
      )}

      {/* মূল কনটেন্ট এরিয়া */}
      <main className={isAdmin ? "content-wrapper admin-content-wrapper" : "content-wrapper"} style={isAdmin ? { padding: '1rem', maxWidth: '100%' } : {}}>
        <Routes>
          {/* পাবলিক রুট: শুধুমাত্র ভোট প্রদান বুথ ও ফলাফল তালিকা উন্মুক্ত */}
          <Route path="/" element={<Navigate to="/voting" replace />} />
          <Route 
            path="/voting" 
            element={
              <VotingView 
                votersList={votersList}
                candidatesList={candidatesList}
                onCastVoteSuccess={handleCastVoteSuccess}
                electionSettings={electionSettings}
              />
            } 
          />
          <Route path="/vote" element={<Navigate to="/voting" replace />} />
          <Route path="/candidates" element={<Navigate to="/voting" replace />} />
          <Route path="/voter-check" element={<Navigate to="/voting" replace />} />
          <Route path="/voters" element={<Navigate to="/voting" replace />} />
          <Route path="/home" element={<Navigate to="/voting" replace />} />
          <Route 
            path="/results" 
            element={
              <ResultsView 
                electionSettings={electionSettings}
                stats={stats}
                candidatesList={candidatesList}
                onRefresh={loadDataFromSupabase}
              />
            } 
          />
          <Route 
            path="/admin" 
            element={
              <AdminView 
                electionSettings={electionSettings}
                setElectionSettings={setElectionSettings}
                votersList={votersList}
                setVotersList={setVotersList}
                candidatesList={candidatesList}
                setCandidatesList={setCandidatesList}
                stats={stats}
                auditLogs={auditLogs}
                setAuditLogs={setAuditLogs}
                setActiveTab={setActiveTab}
                refreshElectionData={loadDataFromSupabase}
              />
            } 
          />
          <Route path="*" element={<Navigate to="/voting" replace />} />
        </Routes>
      </main>

      {/* সাধারণ ফুটার (এডমিন প্যানেলে হাইড থাকবে) */}
      {!isAdmin && (
        <Footer 
          setActiveTab={setActiveTab}
          electionSettings={electionSettings}
        />
      )}
    </div>
  );
}
