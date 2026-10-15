import React from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Phone, Mail, ShieldCheck, Heart } from 'lucide-react';

export default function Footer({ setActiveTab, electionSettings }) {
  return (
    <footer style={{
      backgroundColor: '#064e3b',
      color: '#ffffff',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      marginTop: 'auto',
      padding: '2.5rem 1rem 1.5rem'
    }}>
      <div style={{
        maxWidth: '1080px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* কলাম ১: পরিচিতি */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#047857',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Landmark size={20} />
            </div>
            <h3 style={{ fontSize: '1.15rem', color: '#ffffff' }}>মডেল মসজিদ ইমাম পরিষদ</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের ধর্ম বিষয়ক মন্ত্রণালয়ের আওতাধীন দেশব্যাপী নির্মিত মডেল মসজিদের সম্মানিত ইমামগণের ঐক্য ও কল্যাণে গঠিত কেন্দ্রীয় সংগঠন।
          </p>
        </div>

        {/* কলাম ২: জরুরি লিংক */}
        <div>
          <h4 style={{ fontSize: '1rem', color: '#fef08a', marginBottom: '0.85rem' }}>জরুরি লিংকসমূহ</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <li>
              <Link
                to="/voting"
                style={{ color: '#e2e8f0', textDecoration: 'none', display: 'inline-block' }}
              >
                • ভোট প্রদান বুথ (ব্যালট পেপার)
              </Link>
            </li>
            <li>
              <Link
                to="/results"
                style={{ color: '#e2e8f0', textDecoration: 'none', display: 'inline-block' }}
              >
                • চূড়ান্ত নির্বাচনী ফলাফল তালিকা
              </Link>
            </li>
          </ul>
        </div>

        {/* কলাম ৩: হেল্পলাইন ও সহায়তা */}
        <div>
          <h4 style={{ fontSize: '1rem', color: '#fef08a', marginBottom: '0.85rem' }}>নির্বাচন কমিশন সহায়তা সেল</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone size={16} style={{ color: '#34d399' }} />
              <span>হটলাইন: {electionSettings.hotline}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={16} style={{ color: '#34d399' }} />
              <span>ইমেইল: {electionSettings.email}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <ShieldCheck size={16} style={{ color: '#fbbf24' }} />
              <span>এনক্রিপ্টেড ও সম্পূর্ণ গোপন ব্যালট সিস্টেম</span>
            </div>
          </div>
        </div>
      </div>

      {/* কপিরাইট ও ক্রেডিট */}
      <div style={{
        maxWidth: '1080px',
        margin: '0 auto',
        paddingTop: '1.25rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.8rem',
        color: '#94a3b8'
      }}>
        <div>
          © {new Date().getFullYear()} মডেল মসজিদ ইমাম পরিষদ। সর্বস্বত্ব সংরক্ষিত।
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>কারিগরি সহায়তায়: তিতাস আইটি </span>
          <Link to="/admin" style={{ color: 'rgba(255, 255, 255, 0.4)', textDecoration: 'none', fontSize: '0.75rem' }}>
            অ্যাডমিন প্রবেশ
          </Link>
        </div>
      </div>
    </footer>
  );
}
