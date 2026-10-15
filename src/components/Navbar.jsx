import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Vote, 
  Users, 
  Award, 
  BarChart3, 
  ShieldCheck, 
  Menu, 
  X, 
  CheckCircle2,
  Lock,
  Clock,
  Landmark
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, electionSettings, isLiveConnected }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'voting', path: '/voting', label: 'ভোট প্রদান বুথ', icon: Vote, highlight: true },
    { id: 'results', path: '/results', label: 'ফলাফল তালিকা', icon: BarChart3 }
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-subtle)'
    }}>
      {/* টপ নোটিশ বার (সংক্ষিপ্ত ও মার্জিত) */}
      <div style={{
        background: 'linear-gradient(90deg, #022c22 0%, #064e3b 100%)',
        color: '#ffffff',
        padding: '0.35rem 1rem',
        fontSize: '0.825rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.65rem'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>ভোট গ্রহণ সক্রিয়</span>
        </div>
        <span style={{ opacity: 0.4 }}>|</span>
        <span style={{ color: '#fef08a' }}>১০০% গোপন ব্যালট ও নিরাপদ যাচাই</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <Link to="/admin" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <Lock size={11} />
          <span>অ্যাডমিন</span>
        </Link>
      </div>

      <div style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* ব্র্যান্ড লোগো */}
        <Link 
          to="/voting"
          onClick={() => setMobileMenuOpen(false)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer' 
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
          }}>
            <Landmark size={22} />
          </div>
          <div>
            <div style={{ 
              fontWeight: 700, 
              fontSize: '1.05rem', 
              color: '#064e3b',
              lineHeight: 1.2
            }}>
              মডেল মসজিদ ইমাম পরিষদ
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              <span>কেন্দ্রীয় নির্বাচন {electionSettings.term}</span>
              {isLiveConnected && (
                <span className="badge badge-success" style={{ padding: '0.05rem 0.35rem', fontSize: '0.65rem' }}>লাইভ ক্লাউড</span>
              )}
            </div>
          </div>
        </Link>

        {/* ডেস্কটপ ন্যাভ মেনু */}
        <nav className="desktop-nav" style={{ gap: '0.35rem', alignItems: 'center' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (setActiveTab) setActiveTab(item.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? (item.highlight ? '#059669' : '#ecfdf5') : 'transparent',
                  color: isActive ? (item.highlight ? '#ffffff' : '#047857') : 'var(--text-secondary)',
                  border: isActive && !item.highlight ? '1px solid rgba(5, 150, 105, 0.2)' : 'none',
                  textDecoration: 'none'
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* মোবাইল মেনু টগল বাটন */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="mobile-menu-toggle"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)'
          }}
          aria-label="মেনু খুলুন"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* মোবাইল ড্রপডাউন মেনু */}
      {mobileMenuOpen && (
        <div style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid var(--border-color)',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          boxShadow: 'var(--shadow-elevated)'
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (setActiveTab) setActiveTab(item.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? (item.highlight ? '#059669' : '#ecfdf5') : 'transparent',
                  color: isActive ? (item.highlight ? '#ffffff' : '#047857') : 'var(--text-primary)',
                  textAlign: 'left',
                  textDecoration: 'none'
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* মোবাইলে সর্বদা দৃশ্যমান স্ক্রলেবল অনুভূমিক মেনু (যা ক্লিকে কখনোই হাইড হবে না) */}
      <nav 
        className="mobile-horizontal-nav" 
        aria-label="মোবাইল দ্রুত মেনু"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => {
                if (setActiveTab) setActiveTab(item.id);
              }}
              className={`mobile-nav-pill ${isActive ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        .desktop-nav {
          display: flex;
        }
        .mobile-menu-toggle {
          display: none;
        }
        .mobile-horizontal-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-toggle {
            display: flex !important;
          }
          .mobile-horizontal-nav {
            display: flex !important;
            padding: 0.45rem 0.75rem;
            gap: 0.45rem;
            overflow-x: auto;
            white-space: nowrap;
            background: #f8fafc;
            border-top: 1px solid var(--border-color);
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .mobile-horizontal-nav::-webkit-scrollbar {
            display: none;
          }
          .mobile-nav-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.38rem 0.75rem;
            border-radius: 99px;
            font-size: 0.825rem;
            font-weight: 500;
            text-decoration: none;
            color: var(--text-secondary);
            background: #ffffff;
            border: 1px solid var(--border-color);
            flex-shrink: 0;
            transition: all 0.2s ease;
          }
          .mobile-nav-pill.active {
            background: #059669;
            color: #ffffff;
            font-weight: 700;
            border-color: #059669;
            box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
          }
        }
      `}</style>
    </header>
  );
}
