import React, { useState, useEffect } from 'react';
import { 
  Vote, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  Lock, 
  Clock, 
  ArrowRight, 
  Landmark, 
  Award,
  AlertCircle,
  FileCheck,
  ChevronRight
} from 'lucide-react';
import { POSTS } from '../data/electionData';

export default function HomeView({ setActiveTab, electionSettings, stats }) {
  // লাইভ কাউন্টডাউন হিসাব
  const [countdownText, setCountdownText] = useState('ভোট গ্রহণ চলমান রয়েছে');

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const startTime = electionSettings?.startTime ? new Date(electionSettings.startTime).getTime() : null;
      const endTime = electionSettings?.endTime ? new Date(electionSettings.endTime).getTime() : null;

      if (electionSettings?.status === 'ended' || (endTime && now >= endTime)) {
        setCountdownText('ভোট গ্রহণ সম্পন্ন হয়েছে • ফলাফল প্রকাশিত');
        return;
      }

      if (startTime && now < startTime) {
        const diff = startTime - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(`ভোট শুরু হতে বাকি: ${days > 0 ? days + ' দিন ' : ''}${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড`);
        return;
      }

      if (endTime) {
        const diff = endTime - now;
        if (diff <= 0) {
          setCountdownText('ভোট গ্রহণ সমাপ্ত হয়েছে');
          return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(`ভোট সমাপ্ত হতে বাকি: ${days > 0 ? days + ' দিন ' : ''}${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড`);
      } else {
        setCountdownText('ভোট গ্রহণ চলমান রয়েছে');
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [electionSettings?.startTime, electionSettings?.endTime, electionSettings?.status]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* ১. হিরো সেকশন - মার্জিত ইসলামিক গ্রিন ও সোনালী হাইলাইট */}
      <div className="hero-gradient" style={{
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(10px)',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.85rem',
          marginBottom: '1.25rem',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <Clock size={16} style={{ color: '#fef08a' }} />
          <span><strong>{countdownText}</strong></span>
        </div>

        <h1 style={{
          fontSize: 'clamp(1.5rem, 4.5vw, 2.2rem)',
          color: '#ffffff',
          marginBottom: '0.75rem',
          lineHeight: 1.35
        }}>
          মডেল মসজিদ ইমাম পরিষদ<br />
          <span style={{ color: '#fbbf24', fontWeight: 600 }}>কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন</span>
        </h1>

        <p style={{
          maxWidth: '620px',
          margin: '0 auto 1.75rem',
          color: '#e2e8f0',
          fontSize: '0.975rem',
          lineHeight: 1.6
        }}>
          দেশব্যাপী মডেল মসজিদের সম্মানিত ইমামদের পবিত্র ভোটাধিকার প্রয়োগের স্বচ্ছ ও সম্পূর্ণ নিরপেক্ষ অনলাইন ভোটিং প্ল্যাটফর্ম।
        </p>

        {/* প্রাইমারি অ্যাকশন বাটন */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.85rem',
          justifyContent: 'center',
          maxWidth: '440px',
          margin: '0 auto'
        }}>
          <button 
            onClick={() => setActiveTab('voting')}
            className="btn"
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              fontWeight: 700,
              flex: '1 1 200px',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              border: 'none'
            }}
          >
            <Vote size={19} />
            <span>ভোট প্রদান বুথে যান</span>
            <ArrowRight size={17} />
          </button>

          <button 
            onClick={() => setActiveTab('candidates')}
            className="btn"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              flex: '1 1 180px'
            }}
          >
            <Users size={19} />
            <span>প্রার্থী তালিকা দেখুন</span>
          </button>
        </div>
      </div>

      {/* ২. লাইভ নির্বাচনী পরিসংখ্যান (Clean Metric Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem'
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.15rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857', flexShrink: 0 }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>মোট নিবন্ধিত ভোটার</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#064e3b' }}>{stats.totalVoters} জন</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.15rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', flexShrink: 0 }}>
            <FileCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>প্রদত্ত ভোট (কাস্টেড)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#92400e' }}>
              {stats.votedCount} জন ({stats.totalVoters ? Math.round((stats.votedCount / stats.totalVoters) * 100) : 0}%)
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.15rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
            <Award size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>নির্বাচনী পদের সংখ্যা</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e40af' }}>৫ টি পদ</div>
          </div>
        </div>
      </div>

      {/* ৩. সিস্টেমের মূল ৩টি নিরাপত্তা অঙ্গীকার */}
      <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1.15rem', color: '#064e3b', textAlign: 'center' }}>
          আহ্বায়ক কমিটির ৩টি কঠোর নিরাপত্তা নীতিমালা
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{ background: 'var(--bg-subtle)', padding: '1.15rem', borderRadius: 'var(--radius-sm)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#047857', marginBottom: '0.35rem' }}>
              <ShieldCheck size={20} />
              <h3 style={{ fontSize: '0.975rem' }}>১. এক ভোটার = এক ভোট</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              ইউনিক ভোটার আইডি ও গোপন পিনের মাধ্যমে বুথে প্রবেশ। ভোট সম্পন্ন হওয়ামাত্র ব্যালট স্বয়ংক্রিয়ভাবে চিরতরে লক হয়ে যায়।
            </p>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '1.15rem', borderRadius: 'var(--radius-sm)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', marginBottom: '0.35rem' }}>
              <Lock size={20} />
              <h3 style={{ fontSize: '0.975rem' }}>২. সম্পূর্ণ গোপন ব্যালট</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              কে কাকে ভোট দিয়েছেন তা কোনো ব্যক্তি বা ডাটাবেজ অ্যাডমিন দেখতে পারেন না। ভোটার পরিচয় ও ব্যালট শতভাগ বিচ্ছিন্ন থাকে।
            </p>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '1.15rem', borderRadius: 'var(--radius-sm)', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1d4ed8', marginBottom: '0.35rem' }}>
              <CheckCircle2 size={20} />
              <h3 style={{ fontSize: '0.975rem' }}>৩. উন্মুক্ত ও স্বচ্ছ ফলাফল</h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              ভোট চলাকালীন পক্ষপাত এড়াতে লাইভ কাউন্ট গোপন থাকে এবং নির্ধারিত সময় শেষে সবার জন্য পূর্ণাঙ্গ ফলাফল দৃশ্যমান হয়।
            </p>
          </div>
        </div>
      </div>

      {/* ৪. ৫টি নির্বাচনী পদসমূহ */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#064e3b' }}>নির্বাচনী পদসমূহ</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>৫টি পদের জন্য ব্যালট পেপারে ভোট গ্রহণ করা হচ্ছে</p>
          </div>
          <button 
            onClick={() => setActiveTab('candidates')}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', minHeight: '38px' }}
          >
            <span>সকল প্রার্থী দেখুন</span>
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.85rem'
        }}>
          {POSTS.map((post, index) => (
            <div key={post.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ecfdf5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                {index + 1}
              </div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{post.title}</h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', flex: 1 }}>{post.description}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
