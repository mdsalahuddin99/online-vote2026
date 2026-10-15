import React, { useState } from 'react';
import { 
  Users, 
  MapPin, 
  Vote, 
  Check, 
  Filter,
  Landmark,
  ShieldAlert,
  User
} from 'lucide-react';
import { POSTS } from '../data/electionData';

export default function CandidatesView({ candidatesList = [], onSelectVotePost, setActiveTab }) {
  const [selectedPost, setSelectedPost] = useState('all');

  const allCandidates = candidatesList || [];
  const filteredCandidates = selectedPost === 'all' 
    ? allCandidates 
    : allCandidates.filter(c => c.postId === selectedPost);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* শিরোনাম ও নিরপেক্ষতার বার্তা */}
      <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Users size={26} style={{ color: 'var(--primary)' }} />
          <h1 style={{ fontSize: '1.4rem', color: 'var(--primary-dark)' }}>
            কেন্দ্রীয় কার্যনির্বাহী কমিটি - নিরপেক্ষ প্রার্থী তালিকা
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          নির্বাচন পরিচালনা নীতিমালার ৪ নং ধারা অনুযায়ী: ভোট দেওয়ার সময় প্রার্থীদের তথ্য সম্পূর্ণ নিরপেক্ষভাবে প্রদর্শিত হয়েছে। কোনো প্রার্থীর পক্ষে কোনো প্রকার প্রচারণা বা প্রতীক রাখা হয়নি।
        </p>
      </div>

      {/* পদ অনুযায়ী ফিল্টার বোতাম (মোবাইলে প্রিমিয়াম স্ক্রলযোগ্য ও রেসপনসিভ ট্যাব) */}
      <div className="candidate-filter-container">
        <div className="candidate-filter-tabs" role="tablist" aria-label="পদ অনুযায়ী ফিল্টার">
          <button
            onClick={() => setSelectedPost('all')}
            className={`candidate-tab-pill ${selectedPost === 'all' ? 'is-active' : ''}`}
            role="tab"
            aria-selected={selectedPost === 'all'}
          >
            <Filter size={15} />
            <span>সকল পদ</span>
            <span className="candidate-tab-badge">{allCandidates.length}</span>
          </button>

          {POSTS.map(post => {
            const isSelected = selectedPost === post.id;
            const count = allCandidates.filter(c => c.postId === post.id).length;
            return (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post.id)}
                className={`candidate-tab-pill ${isSelected ? 'is-active' : ''}`}
                role="tab"
                aria-selected={isSelected}
              >
                <span>{post.title}</span>
                <span className="candidate-tab-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* প্রার্থীর তালিকা না থাকলে নোটিশ */}
      {filteredCandidates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#ffffff' }}>
          <Users size={48} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            {allCandidates.length === 0 ? 'বর্তমানে কোনো প্রার্থী নিবন্ধিত নেই' : 'এই পদে এখনো কোনো প্রার্থী নিবন্ধিত হননি'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            {allCandidates.length === 0 
              ? 'নির্বাচন কমিশনের অ্যাডমিন প্যানেল থেকে প্রার্থীর তথ্য যুক্ত করা হলে এখানে পদভিত্তিক নিরপেক্ষ তালিকা প্রদর্শিত হবে।'
              : 'অন্যান্য পদের প্রার্থীর তালিকা দেখতে উপরের বোতামগুলো নির্বাচন করুন।'}
          </p>
          {allCandidates.length === 0 && (
            <button 
              onClick={() => setActiveTab && setActiveTab('admin')} 
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.25rem' }}
            >
              অ্যাডমিন প্যানেলে যান
            </button>
          )}
        </div>
      ) : (
        /* প্রার্থী কার্ড গ্রিড */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredCandidates.map(candidate => {
            const postInfo = POSTS.find(p => p.id === candidate.postId);
            return (
              <div 
                key={candidate.id} 
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  position: 'relative',
                  border: '1.5px solid var(--border)',
                  background: '#ffffff'
                }}
              >
              {/* পদের ট্যাগ */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.8rem' }}>
                  {postInfo?.title} প্রার্থী
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {candidate.division} বিভাগ
                </span>
              </div>

              {/* প্রার্থীর ছবি, নাম ও মসজিদ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                {candidate.photo ? (
                  <img 
                    src={candidate.photo} 
                    alt={candidate.name} 
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--primary)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      flexShrink: 0
                    }} 
                  />
                ) : (
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'var(--emerald-50)',
                    border: '1.5px dashed var(--emerald-400)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--emerald-600)',
                    flexShrink: 0
                  }}>
                    <User size={28} />
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                    {candidate.name}
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.4rem',
                    fontSize: '0.875rem',
                    color: 'var(--primary-dark)',
                    fontWeight: 500
                  }}>
                    <Landmark size={15} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--primary)' }} />
                    <span>{candidate.mosque}</span>
                  </div>
                </div>
              </div>

              {/* সংক্ষিপ্ত তথ্য / অবস্থান */}
              <div style={{
                background: 'var(--bg-subtle)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                  <MapPin size={15} />
                  <span>উপজেলা/জেলা: <strong>{candidate.district}</strong></span>
                </div>
              </div>

              {/* অ্যাকশন বোতাম */}
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  onClick={() => setActiveTab('voting')}
                  className="btn btn-outline"
                  style={{ width: '100%', minHeight: '42px', fontSize: '0.9rem' }}
                >
                  <Vote size={18} />
                  <span>এই পদে ভোট দিতে বুথে যান</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

    </div>
  );
}
