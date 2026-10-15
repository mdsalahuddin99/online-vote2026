import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Lock, 
  Clock, 
  CheckCircle2, 
  Award, 
  Trophy, 
  Users, 
  Landmark,
  Share2,
  Printer,
  RefreshCw,
  Eye,
  AlertCircle,
  Sparkles,
  LayoutGrid,
  List
} from 'lucide-react';
import { POSTS } from '../data/electionData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function ResultsView({ 
  electionSettings, 
  stats, 
  candidatesList = [],
  onRefresh 
}) {
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminPreview, setAdminPreview] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' (ডিফল্ট: বড় স্ক্রিনে ৪টি, মোবাইলে ২টি) অথবা 'list'

  // পেজ লোড হলে লাইভ ফলাফল রিফ্রেশ করা
  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // অ্যাডমিন লগইন স্ট্যাটাস চেক
  const isAdminLoggedIn = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mm_admin_authenticated') === 'true';

  // সময়সীমা শেষ হয়েছে কি না চেক
  const now = new Date();
  const endTimeDate = electionSettings?.endTime ? new Date(electionSettings.endTime) : null;
  const isTimePassed = Boolean(electionSettings?.status === 'ongoing' && endTimeDate && now >= endTimeDate);
  const isElectionEnded = electionSettings?.status === 'ended' || isTimePassed || adminPreview;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* হেডার ব্যানার */}
      <div className="card" style={{
        background: isElectionEnded ? 'linear-gradient(135deg, #064e3b 0%, #047857 100%)' : '#ffffff',
        color: isElectionEnded ? '#ffffff' : 'var(--text-main)',
        borderTop: isElectionEnded ? 'none' : '4px solid var(--gold)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <BarChart3 size={28} style={{ color: isElectionEnded ? '#fef08a' : 'var(--primary)' }} />
              <h1 style={{ fontSize: '1.4rem' }}>
                {isElectionEnded ? 'নির্বাচনের চূড়ান্ত ফলাফল (অফিসিয়াল গেজেট)' : 'নির্বাচনী ফলাফল পোর্টাল'}
              </h1>
            </div>

            <p style={{ opacity: 0.9, fontSize: '0.95rem', maxWidth: '750px', margin: 0 }}>
              {isElectionEnded 
                ? 'নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি কর্তৃক অনুমোদিত কেন্দ্রীয় কার্যনির্বাহী কমিটির পূর্ণাঙ্গ ফলাফল সবার জন্য উন্মুক্ত করা হলো।'
                : 'নির্বাচন নীতিমালার ৮ ও ৯ নং ধারা অনুযায়ী: পক্ষপাত এড়াতে ভোট চলাকালীন সময়ে ফলাফল গোপন রাখা হয়েছে। ভোট গ্রহণ শেষ হলে স্বয়ংক্রিয়ভাবে ফলাফল এখানে প্রকাশিত হবে।'
              }
            </p>
          </div>

          {/* রিফ্রেশ ও প্রিভিউ বাটনসমূহ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {onRefresh && (
              <button 
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="btn btn-secondary"
                style={{ 
                  padding: '0.5rem 0.85rem', 
                  fontSize: '0.85rem',
                  background: isElectionEnded ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-subtle)',
                  color: isElectionEnded ? '#ffffff' : 'var(--text-main)',
                  border: isElectionEnded ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border)'
                }}
                title="লাইভ ফলাফল রিফ্রেশ করুন"
              >
                <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
                <span>{isRefreshing ? 'রিফ্রেশ হচ্ছে...' : 'ফলাফল রিফ্রেশ'}</span>
              </button>
            )}

            {/* অ্যাডমিন প্রিভিউ মোড টগল (শুধুমাত্র লগইন থাকা অ্যাডমিনদের জন্য) */}
            {isAdminLoggedIn && !isElectionEnded && (
              <button 
                onClick={() => setAdminPreview(true)}
                className="btn"
                style={{ 
                  padding: '0.5rem 0.85rem', 
                  fontSize: '0.85rem',
                  background: 'var(--gold)',
                  color: '#0f172a',
                  fontWeight: 700,
                  border: 'none'
                }}
              >
                <Eye size={15} />
                <span>অ্যাডমিন ফলাফল প্রিভিউ</span>
              </button>
            )}
          </div>
        </div>

        {/* যদি প্রিভিউ মোড সক্রিয় থাকে */}
        {adminPreview && electionSettings?.status !== 'ended' && !isTimePassed && (
          <div style={{
            marginTop: '1rem',
            padding: '0.65rem 1rem',
            background: 'rgba(251, 191, 36, 0.2)',
            border: '1px solid #fbbf24',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: '#fef08a' }} />
              <span><strong>অ্যাডমিন প্রিভিউ মোড সক্রিয়:</strong> সাধারণ ভোটারদের জন্য এখনও লক রয়েছে, কিন্তু আপনি অ্যাডমিন হিসেবে ফলাফল পরীক্ষা করছেন।</span>
            </div>
            <button 
              onClick={() => setAdminPreview(false)}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#ffffff', color: '#000' }}
            >
              প্রিভিউ বন্ধ করুন
            </button>
          </div>
        )}
      </div>

      {/* যদি নির্বাচন এখনো চলমান থাকে */}
      {!isElectionEnded && (
        <div className="card" style={{
          textAlign: 'center',
          padding: '2.5rem 1.5rem',
          background: '#ffffff',
          border: '1.5px dashed var(--gold)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--gold-light)',
            color: 'var(--gold-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Lock size={32} />
          </div>

          <h2 style={{ fontSize: '1.35rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
            ফলাফল টাইম-লক করা রয়েছে
          </h2>

          <p style={{ maxWidth: '540px', margin: '0 auto 1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            ভোট গ্রহণ সমাপ্তির নির্ধারিত সময়: <strong>{new Date(electionSettings.endTime).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong><br />
            নির্ধারিত সময় অতিক্রান্ত হলে সম্পূর্ণ ফলাফল চার্ট ও বিজয়ী তালিকা স্বয়ংক্রিয়ভাবে উন্মুক্ত হবে।
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--bg-subtle)',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.9rem',
            marginBottom: '1rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>বর্তমান ভোটার উপস্থিতি:</span>
            <strong style={{ color: 'var(--primary)' }}>
              {stats.votedCount} জন ভোট দিয়েছেন ({stats.totalVoters ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0}%)
            </strong>
          </div>

          {/* দ্রুত আনলক বা রিফ্রেশ অপশন */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button 
              onClick={handleManualRefresh} 
              disabled={isRefreshing}
              className="btn btn-secondary" 
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'সার্ভার চেক হচ্ছে...' : 'স্ট্যাটাস রিফ্রেশ করুন'}</span>
            </button>

            {isAdminLoggedIn && (
              <button 
                onClick={() => setAdminPreview(true)}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                <Eye size={15} />
                <span>অ্যাডমিন প্রিভিউতে ফলাফল দেখুন</span>
              </button>
            )}
          </div>

          {/* টেস্টিং টিপস */}
          <div style={{ marginTop: '1.75rem', fontSize: '0.825rem', color: '#94a3b8' }}>
            💡 অ্যাডমিন প্যানেলে গিয়ে 'ভোট গ্রহণ সমাপ্ত ও ফলাফল উন্মুক্ত করুন' সুইচে চাপ দিলে ফলাফল সবার জন্য উন্মুক্ত হবে।
          </div>
        </div>
      )}

      {/* যদি ভোট সমাপ্ত হয়ে থাকে বা প্রিভিউ সক্রিয় থাকে -> পূর্ণাঙ্গ ফলাফল চার্ট ও তালিকা */}
      {isElectionEnded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* প্রিন্ট, উপস্থিতি ও ভিউ মোড বার */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: '#ffffff', padding: '0.85rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />
              <span>মোট ভোটার উপস্থিতি: <strong style={{ color: 'var(--primary-dark)' }}>{stats.votedCount} জন</strong> ({stats.totalVoters ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0}%)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* ভিউ মোড টগল (গ্রিড ৪টি/২টি বনাম লিস্ট) */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: viewMode === 'grid' ? 700 : 500,
                    background: viewMode === 'grid' ? '#059669' : 'transparent',
                    color: viewMode === 'grid' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s'
                  }}
                  title="গ্রিড ভিউ (বড় স্ক্রিনে ৪টি, মোবাইলে ২টি)"
                >
                  <LayoutGrid size={15} />
                  <span>গ্রিড ভিউ (৪টি/২টি)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: viewMode === 'list' ? 700 : 500,
                    background: viewMode === 'list' ? '#059669' : 'transparent',
                    color: viewMode === 'list' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s'
                  }}
                  title="তালিকা ভিউ"
                >
                  <List size={15} />
                  <span>লিস্ট ভিউ</span>
                </button>
              </div>

              <button onClick={() => window.print()} className="btn btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                <Printer size={16} />
                <span>গেজেট প্রিন্ট</span>
              </button>
            </div>
          </div>

          {/* একনজরে নির্বাচিত কেন্দ্রীয় পরিষদ সামারি কার্ড (গ্রিড: মোবাইলে ২টি, বড় স্ক্রিনে ৪টি) */}
          {(!stats.votedCount || stats.votedCount === 0) ? (
            <div className="card" style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Users size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: '#1e293b', margin: '0 0 0.4rem', fontWeight: 700 }}>
                এখনো পর্যন্ত কোনো ভোট প্রদান করা হয়নি
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
                বর্তমান ভোটার উপস্থিতি শূন্য (০ জন)। নতুন নির্বাচন চালু হলে ভোটাররা ব্যালটে ভোট প্রদান করার পর এখানে প্রাপ্ত ফলাফলের পূর্ণাঙ্গ বিবরণ ও বিজয়ী পরিষদ স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
              </p>
            </div>
          ) : (
            <div className="card" style={{ background: '#ffffff', borderTop: '4px solid #f59e0b', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.15rem' }}>
                <Trophy size={24} color="#d97706" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--primary-dark)' }}>
                    একনজরে কেন্দ্রীয় কার্যনির্বাহী পরিষদ (গেজেট অনুযায়ী বিজয়ী প্যানেল)
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    মডেল মসজিদ ইমাম পরিষদ নির্বাচন ২০২৬-২০২৮
                  </span>
                </div>
              </div>

              <div className="results-candidates-grid">
                {POSTS.map(post => {
                  const candidatesForPost = candidatesList
                    .filter(c => c.postId === post.id)
                    .sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));
                  const winner = candidatesForPost[0];
                  const hasVotes = winner && (winner.votesCount || 0) > 0;

                  return (
                    <div 
                      key={post.id} 
                      className="results-candidate-card is-winner" 
                      style={{ background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)' }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                            {post.title}
                          </span>
                          {hasVotes && (
                            <span className="badge badge-gold" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                              🏆 নির্বাচিত
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', margin: '0.35rem 0 0.75rem' }}>
                          {winner?.photo ? (
                            <img 
                              src={winner.photo} 
                              alt={winner.name} 
                              style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #059669',
                                flexShrink: 0
                              }} 
                            />
                          ) : (
                            <div style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              background: '#d1fae5',
                              color: '#047857',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <User size={24} />
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#064e3b', margin: '0 0 0.2rem', lineHeight: 1.35, wordBreak: 'break-word' }}>
                              {winner?.name || 'প্রার্থী নির্ধারিত নয়'}
                            </h4>
                            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.35 }}>
                              {winner?.mosque || 'মডেল মসজিদ'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>প্রাপ্ত ভোট:</span>
                          <strong style={{ fontSize: '1.15rem', color: '#059669', fontWeight: 800 }}>
                            {winner?.votesCount || 0} ভোট
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* পদভিত্তিক বিস্তারিত ফলাফল সেকশন */}
          {POSTS.map((post) => {
            const candidatesForPost = candidatesList
              .filter(c => c.postId === post.id)
              .sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0));

            const totalPostVotes = candidatesForPost.reduce((acc, c) => acc + (c.votesCount || 0), 0) || 1;

            return (
              <div key={post.id} className="card" style={{ background: '#ffffff', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '0.85rem',
                  borderBottom: '1px solid var(--border)',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={22} style={{ color: 'var(--gold-dark)' }} />
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--primary-dark)', margin: 0 }}>
                      {post.title} পদের ফলাফল
                    </h3>
                  </div>
                  <span className="badge badge-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.88rem' }}>
                    মোট কাস্টেড ভোট: {candidatesForPost.reduce((acc, c) => acc + (c.votesCount || 0), 0)}
                  </span>
                </div>

                {candidatesForPost.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    এই পদে কোনো প্রার্থী প্রতিদ্বন্দ্বিতা করেননি।
                  </div>
                ) : viewMode === 'grid' ? (
                  /* গ্রিড ভিউ: বড় ডিভাইসে ৪টি, মোবাইলে ২টি */
                  <div className="results-candidates-grid">
                    {candidatesForPost.map((candidate, idx) => {
                      const voteCount = candidate.votesCount || 0;
                      const hasVotes = candidatesForPost.some(c => (c.votesCount || 0) > 0);
                      const isLeading = idx === 0 && hasVotes && voteCount > 0;
                      const percentage = totalPostVotes > 0 ? Math.round((voteCount / totalPostVotes) * 100) : 0;

                      return (
                        <div 
                          key={candidate.id}
                          className={`results-candidate-card ${isLeading ? 'is-winner' : ''}`}
                        >
                          <div>
                            {/* কার্ডের শীর্ষ: স্ট্যাটাস ব্যাজ */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                              {isLeading ? (
                                <span className="badge badge-gold" style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <Trophy size={13} />
                                  <span>বিজয়ী</span>
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                  প্রতিদ্বন্দ্বী #{idx + 1}
                                </span>
                              )}

                              <span style={{ fontSize: '0.8rem', color: isLeading ? '#059669' : '#64748b', fontWeight: 700 }}>
                                {percentage}%
                              </span>
                            </div>

                            {/* প্রার্থীর নাম ও মসজিদ */}
                            <h4 style={{ fontSize: '1.05rem', color: '#0f172a', fontWeight: 700, margin: '0 0 0.25rem', lineHeight: 1.35 }}>
                              {candidate.name}
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.85rem', lineHeight: 1.35 }}>
                              {candidate.mosque}{candidate.district ? ` • ${candidate.district}` : ''}
                            </p>
                          </div>

                          <div>
                            {/* প্রাপ্ত ভোট */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>প্রাপ্ত ভোট:</span>
                              <strong style={{ fontSize: '1.3rem', color: isLeading ? '#059669' : '#0f172a', fontWeight: 800 }}>
                                {voteCount} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>ভোট</span>
                              </strong>
                            </div>

                            {/* প্রোগ্রেস বার */}
                            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${percentage}%`,
                                background: isLeading ? 'linear-gradient(90deg, #10b981, #059669)' : '#94a3b8',
                                borderRadius: '99px',
                                transition: 'width 0.6s ease'
                              }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ক্লাসিক লিস্ট ভিউ */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {candidatesForPost.map((candidate, idx) => {
                      const voteCount = candidate.votesCount || 0;
                      const hasVotes = candidatesForPost.some(c => (c.votesCount || 0) > 0);
                      const isLeading = idx === 0 && hasVotes && voteCount > 0;
                      const percentage = totalPostVotes > 0 ? Math.round((voteCount / totalPostVotes) * 100) : 0;

                      return (
                        <div 
                          key={candidate.id}
                          style={{
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            background: isLeading ? '#f0fdf4' : 'var(--bg-subtle)',
                            border: isLeading ? '1.5px solid #86efac' : '1px solid var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isLeading && (
                                  <span className="badge badge-gold" style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}>
                                    <Trophy size={13} />
                                    <span>বিজয়ি</span>
                                  </span>
                                )}
                                <h4 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>
                                  {candidate.name}
                                </h4>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {candidate.mosque} • {candidate.district}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: isLeading ? 'var(--primary)' : 'var(--text-main)' }}>
                                {voteCount} ভোট
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {percentage}% ভোট
                              </div>
                            </div>
                          </div>

                          {/* ভোট শতাংশ বার */}
                          <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${percentage}%`,
                              background: isLeading ? 'linear-gradient(90deg, #10b981, #059669)' : '#94a3b8',
                              borderRadius: '99px',
                              transition: 'width 0.6s ease'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
