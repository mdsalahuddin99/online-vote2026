import React, { useState, useEffect } from 'react';
import { 
  Vote, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Printer, 
  Download,
  Check, 
  HelpCircle,
  Landmark,
  UserCheck,
  Smartphone,
  KeyRound,
  RotateCcw,
  Calendar,
  Clock,
  User
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { POSTS } from '../data/electionData';
import { sendSMS, getSMSConfig, formatOtpMessage } from '../services/smsService';

export default function VotingView({ 
  votersList, 
  candidatesList = [],
  onCastVoteSuccess, 
  electionSettings 
}) {
  // ভোটিং স্টেপ: 1 = আইডি, ফোন ও পিন ইনপুট, 1.5 = ওটিপি ভেরিফিকেশন, 2 = ব্যালট পেপার, 3 = রিভিউ ও কনফার্ম, 4 = সফল রসিদ
  const [step, setStep] = useState(1);
  
  // বাংলা বর্ণ নরমালাইজেশন ফাংশন (য+় / য়, ড+় / ড়, ঈ/ই ইত্যাদি ফিক্স)
  const cleanBn = (str) => {
    if (!str) return '';
    return str
      .toString()
      .normalize('NFC')
      .replace(/[\u09AF][\u09BC]/g, '\u09DF')
      .replace(/[\u09A1][\u09BC]/g, '\u09DC')
      .replace(/[\u09A2][\u09BC]/g, '\u09DD')
      .replace(/[\u09B0][\u09BC]/g, '\u09DC')
      .replace(/ী/g, 'ি')
      .replace(/ূ/g, 'ু')
      .replace(/ণ/g, 'ন')
      .replace(/[\s\.\,\:\-\_]/g, '')
      .toLowerCase();
  };

  // ভেরিফিকেশন ইনপুট: শুধুমাত্র নিবন্ধিত মোবাইল নম্বর
  const [voterPhoneInput, setVoterPhoneInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [currentVoter, setCurrentVoter] = useState(null);

  // OTP স্টেট
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(120); // ২ মিনিট টাইমার
  const [isResendActive, setIsResendActive] = useState(false);
  const [otpSentNotification, setOtpSentNotification] = useState(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // প্রতিটি পদের জন্য সিলেক্টেড প্রার্থী: { president: 'p1', secretary: 's1', ... }
  const [ballotSelections, setBallotSelections] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [voteReceiptToken, setVoteReceiptToken] = useState('');
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  // ওটিপি কাউন্টডাউন টাইমার
  useEffect(() => {
    let interval = null;
    if (step === 1.5 && otpTimer > 0 && !isOtpVerified) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      setIsResendActive(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [step, otpTimer, isOtpVerified]);

  // ওটিপি জেনারেট ও পাঠানোর ফাংশন (BulkSMSBD লাইভ এসএমএস গেটওয়ে)
  const sendOtpCode = async (voter) => {
    setIsSendingOtp(true);
    setOtpError('');
    setAuthError('');
    setInputOtp('');
    setIsResendActive(false);
    setIsOtpVerified(false);

    const rawPhone = voter.phone || voterPhoneInput;
    const maskedPhone = rawPhone 
      ? rawPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1-****-$2') 
      : 'রেজিস্টার্ড নম্বর';

    // এসএমএস ওটিপি প্রেরণের জন্য ৪-সংখ্যার ওটিপি কোড জেনারেট
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomOtp);
    setOtpTimer(120);

    const smsConfig = getSMSConfig();
    const brandName = (smsConfig.brandName || 'Model Mosque').trim();
    const smsMessage = formatOtpMessage(randomOtp, brandName);

    let sendResult = null;
    try {
      sendResult = await sendSMS(rawPhone, smsMessage);
    } catch (e) {
      console.error('Error sending OTP:', e);
      sendResult = { success: false, message: e.message || 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে।' };
    }

    setOtpSentNotification({
      phone: maskedPhone,
      brand: brandName,
      time: new Date().toLocaleTimeString('bn-BD'),
      success: sendResult ? sendResult.success : true,
      errorMsg: sendResult && !sendResult.success ? sendResult.message : '',
      simulated: sendResult?.simulated || false,
      code: sendResult?.simulated ? randomOtp : undefined,
      serverIp: sendResult?.serverIp || ''
    });
    setIsSendingOtp(false);
  };

  // ১. ভোটার ভেরিফিকেশন হ্যান্ডলার (শুধুমাত্র মোবাইল নম্বর দিয়ে যাচাই)
  const handleVerifyVoter = (e) => {
    e.preventDefault();
    setAuthError('');

    if (!voterPhoneInput.trim()) {
      setAuthError('দয়া করে আপনার নিবন্ধিত মোবাইল নম্বরটি লিখুন।');
      return;
    }

    const cleanInput = voterPhoneInput.trim();
    const cleanDigits = cleanInput.replace(/[^0-9]/g, '');

    if (votersList.length === 0) {
      setAuthError('ভোটার তালিকা এখনও খালি রয়েছে। এডমিন প্যানেল থেকে ভোটার তালিকা আপলোড করুন।');
      return;
    }

    if (cleanDigits.length < 8 && cleanInput.length < 3) {
      setAuthError('অনুগ্রহ করে সঠিক মোবাইল নম্বর প্রদান করুন (যেমন: 017XXXXXXXX)।');
      return;
    }

    // মোবাইল নম্বর (অথবা ব্যাকআপ হিসেবে ভোটার আইডি) দিয়ে সার্ভারের ভোটার তালিকায় খোঁজ
    const voter = votersList.find(v => {
      const vDigits = (v.phone || '').replace(/[^0-9]/g, '');
      const matchPhone = cleanDigits.length >= 8 && vDigits.length >= 8 && (
        vDigits.slice(-10) === cleanDigits.slice(-10) || vDigits === cleanDigits
      );
      const matchId = (v.voterId || '').trim().toUpperCase() === cleanInput.toUpperCase();
      return matchPhone || matchId;
    });

    if (!voter) {
      setAuthError('প্রদত্ত মোবাইল নম্বরটি সার্ভারের ভোটার তালিকায় পাওয়া যায়নি। দয়া করে আপনার নিবন্ধিত সঠিক মোবাইল নম্বরটি দিন।');
      return;
    }

    // ইতোমধ্যে ভোট দিয়েছে কি না যাচাই
    if (voter.hasVoted) {
      setAuthError(`দুঃখিত! সম্মানিত ${voter.name} মহোদয় (${voter.mosque}), এই নম্বরে (${voter.phone}) ইতিমধ্যে ভোট প্রদান সম্পন্ন হয়েছে। এক ভোটার এক ভোটের নীতি অনুযায়ী পুনরায় ভোট দেওয়া সম্ভব নয়।`);
      return;
    }

    // ভোটার পাওয়া গেছে -> ওটিপি পাঠিয়ে ওটিপি ভেরিফিকেশন ধাপে নিয়ে যাওয়া
    setCurrentVoter(voter);
    sendOtpCode(voter);
    setStep(1.5);
  };

  // ওটিপি যাচাই হ্যান্ডলার (এসএমএস / টেস্ট কোড)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');

    if (otpTimer === 0) {
      setOtpError('ওটিপি কোডের মেয়াদ শেষ হয়ে গেছে! অনুগ্রহ করে পুনরায় কোড পাঠান।');
      return;
    }

    if (!inputOtp.trim()) {
      setOtpError('দয়া করে ৪-সংখ্যার ওটিপি কোডটি লিখুন।');
      return;
    }

    // লাইভ ওটিপি কোড যাচাই (সরাসরি মোবাইলে আসা ৪-সংখ্যার ওটিপি কোড যাচাই)
    if (inputOtp.trim() !== generatedOtp.trim()) {
      setOtpError('ভুল ওটিপি কোড! অনুগ্রহ করে আপনার মোবাইলে আসা ৪ সংখ্যার সঠিক কোডটি লিখুন।');
      return;
    }

    // ওটিপি সফল -> স্বয়ংক্রিয়ভাবে ভোটার প্রোফাইল ভেরিফায়েড
    setIsOtpVerified(true);
  };

  // পুনরায় ওটিপি পাঠানোর হ্যান্ডলার
  const handleResendOtp = () => {
    if (currentVoter) {
      sendOtpCode(currentVoter);
    }
  };

  // প্রার্থী সিলেক্ট বা পরিবর্তন
  const handleSelectCandidate = (postId, candidateId) => {
    setBallotSelections(prev => ({
      ...prev,
      [postId]: candidateId
    }));
  };

  // সব পদে ভোট দেওয়া হয়েছে কিনা যাচাই
  const isAllPostsVoted = POSTS.every(post => ballotSelections[post.id]);

  // রিভিউ পেইজে যাওয়া (যদি কোনো পদে ভোট বাকি থাকে, স্বয়ংক্রিয়ভাবে সে পদে স্ক্রোল করে সতর্কবার্তা দেখাবে)
  const handleProceedToReview = () => {
    if (!isAllPostsVoted) {
      const firstUnvoted = POSTS.find(post => !ballotSelections[post.id]);
      const remainingCount = POSTS.filter(p => !ballotSelections[p.id]).length;
      if (firstUnvoted) {
        setSubmitError(`পদ "${firstUnvoted.title}" সহ মোট ${remainingCount}টি পদে এখনও প্রার্থী নির্বাচন করা বাকি রয়েছে। অনুগ্রহ করে প্রতিটি পদের জন্য প্রার্থী নির্বাচন করুন।`);
        const el = document.getElementById(`post-section-${firstUnvoted.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setSubmitError('অনুগ্রহ করে প্রতিটি পদের জন্য একজন করে প্রার্থী নির্বাচন করুন।');
      }
      return;
    }
    setSubmitError('');
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  // ৩. চূড়ান্ত ভোট কাস্ট ও সাবমিট (গোপনীয়তা ও ডেটাবেজ সিঙ্ক নিশ্চিতকরণ)
  const handleConfirmFinalVote = async () => {
    if (isSubmittingVote) return;
    setIsSubmittingVote(true);
    setSubmitError('');

    // ইউনিক ডিসিওসিয়েটেড রসিদ টোকেন জেনারেট (কোনো ভোটার আইডির সাথে ব্যালট চেইন থাকবে না)
    const token = 'TX-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString().slice(-4);
    
    try {
      // প্যারেন্ট স্টেট ও সুপাবেস অ্যাটমিক আরপিসি আপডেট
      const assignedToken = await onCastVoteSuccess({
        voterId: currentVoter.voterId,
        secretPin: currentVoter.secretPin,
        selections: ballotSelections,
        token: token,
        voterName: currentVoter.name,
        mosque: currentVoter.mosque,
        phone: currentVoter.phone
      });

      if (!assignedToken) {
        setIsSubmittingVote(false);
        return;
      }

      setVoteReceiptToken(assignedToken || token);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // সেলিব্রেশন কনফেটি অ্যানিমেশন
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    } catch (err) {
      console.error('Final vote submission error:', err);
      setSubmitError('ভোট সংরক্ষণে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  // শুধুমাত্র ভোটার রশিদ প্রিন্ট করার ডেডিকেটেড ফাংশন (পুরো পেজ প্রিন্ট প্রতিরোধ)
  const handlePrintReceipt = () => {
    const voterName = currentVoter?.name || 'সম্মানিত ভোটার';
    const mosqueName = currentVoter?.mosque || 'মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র';
    const voterId = currentVoter?.voterId || 'N/A';
    const voterPhone = currentVoter?.phone || 'N/A';
    const voterLocation = `${currentVoter?.district || ''}${currentVoter?.division ? ' (' + currentVoter.division + ' বিভাগ)' : ''}` || 'বাংলাদেশ';
    const token = voteReceiptToken || ('TX-AUDIT-' + Date.now().toString().slice(-6));
    const voteTime = new Date().toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const printDate = new Date().toLocaleString('bn-BD');

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>ভোটার ভোট প্রদান রশিদ - ${token}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 20mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif;
            color: #0f172a;
            background: #ffffff;
            padding: 15px;
            font-size: 14px;
            line-height: 1.5;
          }
          .receipt-card {
            border: 2px solid #064e3b;
            border-radius: 12px;
            padding: 24px;
            position: relative;
            background: #ffffff;
            max-width: 680px;
            margin: 0 auto;
          }
          .receipt-card::before {
            content: '';
            position: absolute;
            top: 4px; left: 4px; right: 4px; bottom: 4px;
            border: 1px solid #10b981;
            border-radius: 8px;
            pointer-events: none;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #064e3b;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .org-title {
            font-size: 19px;
            font-weight: 800;
            color: #064e3b;
            margin-bottom: 3px;
          }
          .sub-title {
            font-size: 13px;
            font-weight: 600;
            color: #475569;
            margin-bottom: 8px;
          }
          .badge-receipt {
            display: inline-block;
            background: #064e3b;
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            padding: 4px 16px;
            border-radius: 20px;
            letter-spacing: 0.5px;
          }
          .token-box {
            background: #ecfdf5;
            border: 1.5px solid #a7f3d0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .token-label {
            font-weight: 700;
            color: #064e3b;
            font-size: 13px;
          }
          .token-val {
            font-family: 'Courier New', monospace;
            font-weight: 800;
            font-size: 18px;
            color: #064e3b;
            letter-spacing: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th, td {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            font-size: 13px;
          }
          th {
            background: #f8fafc;
            color: #475569;
            font-weight: 700;
            width: 32%;
            text-align: left;
          }
          td {
            color: #0f172a;
            font-weight: 600;
          }
          .status-badge {
            color: #047857;
            background: #dcfce7;
            padding: 2px 8px;
            border-radius: 4px;
            display: inline-block;
            font-weight: 700;
            border: 1px solid #bbf7d0;
          }
          .notice-box {
            background: #f8fafc;
            border-left: 4px solid #059669;
            padding: 10px 14px;
            font-size: 11.5px;
            color: #334155;
            line-height: 1.6;
            margin-bottom: 24px;
            border-radius: 0 6px 6px 0;
          }
          .footer-signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 25px;
            padding-top: 14px;
            border-top: 1px dashed #cbd5e1;
          }
          .sig-block {
            text-align: center;
            width: 220px;
          }
          .sig-line {
            border-top: 1px solid #0f172a;
            margin-bottom: 4px;
          }
          .sig-text {
            font-size: 11px;
            color: #475569;
            font-weight: 600;
          }
          .qr-placeholder {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 10px;
            font-family: monospace;
            font-size: 10px;
            color: #047857;
            background: #f0fdf4;
            display: inline-block;
          }
          .print-meta {
            text-align: center;
            font-size: 10.5px;
            color: #94a3b8;
            margin-top: 14px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-card">
          <div class="header">
            <div class="org-title">মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন</div>
            <div class="sub-title">কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি ২০২৬-২০২৮</div>
            <div style="margin-top: 6px;">
              <span class="badge-receipt">ভোটার ভোট প্রদান রশিদ ও অডিট প্রত্যয়নপত্র</span>
            </div>
          </div>

          <div class="token-box">
            <div class="token-label">ডিজিটাল অডিট সিকিউরিটি টোকেন:</div>
            <div class="token-val">${token}</div>
          </div>

          <table>
            <tbody>
              <tr>
                <th>ভোটারের পূর্ণ নাম</th>
                <td style="font-size: 14px; font-weight: 700; color: #064e3b;">${voterName}</td>
              </tr>
              <tr>
                <th>ভোটার কোড / আইডি</th>
                <td>${voterId}</td>
              </tr>
              <tr>
                <th>নিবন্ধিত মোবাইল নম্বর</th>
                <td>${voterPhone}</td>
              </tr>
              <tr>
                <th>কর্মরত মডেল মসজিদ</th>
                <td>${mosqueName}</td>
              </tr>
              <tr>
                <th>জেলা ও বিভাগ</th>
                <td>${voterLocation}</td>
              </tr>
              <tr>
                <th>ভোট প্রদানের সময়</th>
                <td>${voteTime}</td>
              </tr>
              <tr>
                <th>ভোট প্রদানের স্ট্যাটাস</th>
                <td><span class="status-badge">✓ ভোট সফলভাবে গৃহীত ও এনক্রিপ্ট হয়েছে</span></td>
              </tr>
            </tbody>
          </table>

          <div class="notice-box">
            <strong>🛡️ নির্বাচন কমিশনের নিরাপত্তা নিশ্চয়তা ও অডিট নীতিমালা:</strong><br>
            গোপনীয় ব্যালট নীতির সুরক্ষায় এই রশিদে ভোটারের পছন্দের প্রার্থীদের নাম দৃশ্যমান করা হয় না। তবে আপনার প্রদত্ত ভোটটি সার্ভার ডাটাবেসে সুরক্ষিতভাবে রেকর্ড হয়েছে। নির্বাচন সমাপ্তির পর ফলাফল অডিট বা চ্যালেঞ্জ যাচাইয়ে এই অডিট টোকেনটি ভোটারের আইনি ডিজিটাল প্রমাণপত্র হিসেবে গণ্য হবে।
          </div>

          <div class="footer-signatures">
            <div class="sig-block">
              <div class="qr-placeholder">
                VERIFIED BY DATABASE<br>
                SECURE SHA-256 TOKEN
              </div>
              <div class="sig-text" style="margin-top: 4px;">ডিজিটাল ভেরিফিকেশন সীল</div>
            </div>

            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-text">
                সদস্য সচিব / প্রধান নির্বাচন কমিশনার<br>
                কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি
              </div>
            </div>
          </div>

          <div class="print-meta">
            রশিদ মুদ্রণের সময়: ${printDate} • এই ডিজিটাল কপিটি সিস্টেম কর্তৃক স্বয়ংক্রিয়ভাবে প্রস্তুতকৃত।
          </div>
        </div>
      </body>
      </html>
    `;

    // অদৃশ্য আইফ্রেমের মাধ্যমে সরাসরি শুধু এই রশিদের প্রিন্ট ডায়ালগ ওপেন করা
    try {
      let iframe = document.getElementById('receipt-print-iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'receipt-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(receiptHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 250);
    } catch (e) {
      console.warn('Iframe print fallback to window.print():', e);
      window.print();
    }
  };

  // ভোটার রশিদ সরাসরি ইমেজ/ফাইল হিসেবে ডাউনলোড করার ফাংশন (Pure Client-side, Canvas High-Res)
  const handleDownloadReceipt = () => {
    setIsDownloadingReceipt(true);
    const voterName = currentVoter?.name || 'সম্মানিত ভোটার';
    const mosqueName = currentVoter?.mosque || 'মডেল মসজিদ ও ইসলামিক সাংস্কৃতিক কেন্দ্র';
    const voterId = currentVoter?.voterId || 'N/A';
    const voterPhone = currentVoter?.phone || 'N/A';
    const voterLocation = `${currentVoter?.district || ''}${currentVoter?.division ? ' (' + currentVoter.division + ' বিভাগ)' : ''}` || 'বাংলাদেশ';
    const token = voteReceiptToken || ('TX-AUDIT-' + Date.now().toString().slice(-6));
    const voteTime = new Date().toLocaleString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 980;
    const scale = 2; // হাই-রেজ্যুলুশন রিটিনা স্কেল
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // ব্যাকগ্রাউন্ড
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // জমকালো ডাবল বর্ডার
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(26, 26, width - 52, height - 52);

    // হেডার গ্রিন বার
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(35, 35, width - 70, 6);

    // সংস্থা ও নির্বাচন শিরোনাম
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন', width / 2, 75);

    ctx.fillStyle = '#475569';
    ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.fillText('কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি ২০২৬-২০২৮', width / 2, 102);

    // অফিসিয়াল ব্যাজ
    const badgeText = 'ভোটার ভোট প্রদান রশিদ ও ডিজিটাল অডিট প্রত্যয়নপত্র';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    const badgeWidth = ctx.measureText(badgeText).width + 36;
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect((width - badgeWidth) / 2, 120, badgeWidth, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText, width / 2, 141);

    // ডিভাইডার
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 172);
    ctx.lineTo(width - 40, 172);
    ctx.stroke();

    // ডিজিটাল অডিট টোকেন বক্স
    ctx.fillStyle = '#ecfdf5';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(40, 190, width - 80, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ডিজিটাল অডিট ও ভেরিফিকেশন টোকেন:', 60, 224);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(token, width - 60, 225);

    // ভোটার তথ্য সারি
    const startY = 270;
    const rowHeight = 44;
    const rows = [
      { label: 'ভোটারের পূর্ণ নাম:', value: voterName, isBold: true },
      { label: 'কর্মরত মডেল মসজিদ:', value: mosqueName },
      { label: 'ভোটার আইডি কোড:', value: voterId },
      { label: 'নিবন্ধিত মোবাইল নম্বর:', value: voterPhone },
      { label: 'এলাকা / জেলা ও বিভাগ:', value: voterLocation },
      { label: 'ভোট প্রদানের সময়:', value: voteTime },
      { label: 'ভোটার ভোট স্ট্যাটাস:', value: '✓ সফলভাবে সম্পন্ন ও ডাটাবেসে নিবন্ধিত (LOCKED)', isSuccess: true }
    ];

    rows.forEach((r, idx) => {
      const y = startY + (idx * rowHeight);
      
      if (idx % 2 === 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(40, y - 28, width - 80, rowHeight);
      }

      ctx.fillStyle = '#475569';
      ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(r.label, 60, y);

      let val = r.value || '';
      ctx.textAlign = 'right';

      if (r.isSuccess) {
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 14.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
      } else if (r.isBold) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
      }

      // বড় টেক্সট নিরাপদভাবে ছাঁটাই যাতে ওভারফ্লো না হয়
      const maxValWidth = width - 330;
      if (ctx.measureText(val).width > maxValWidth) {
        while (ctx.measureText(val + '...').width > maxValWidth && val.length > 5) {
          val = val.slice(0, -1);
        }
        val += '...';
      }

      ctx.fillText(val, width - 60, y);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, y + 14);
      ctx.lineTo(width - 40, y + 14);
      ctx.stroke();
    });

    // গোপনীয়তা ও অডিট সংক্রান্ত নোটিশ বক্স
    const noticeY = startY + (rows.length * rowHeight) + 16;
    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(40, noticeY, width - 80, 84, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.fillRect(40, noticeY, 5, 84);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🛡️ গোপনীয়তা নীতি ও চ্যালেঞ্জ ভেরিফিকেশন:', 55, noticeY + 24);

    ctx.fillStyle = '#334155';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.fillText('গোপনীয় ব্যালট নীতি সুরক্ষায় এই রশিদে ভোটারের পছন্দের প্রার্থীদের নাম দৃশ্যমান করা হয় না।', 55, noticeY + 46);
    ctx.fillText('তবে অডিট ও ফলাফল যাচাইয়ে এই অডিট টোকেনটি ভোটারের আইনি ডিজিটাল প্রমাণপত্র হিসেবে গণ্য হবে।', 55, noticeY + 66);

    // অফিসিয়াল অডিট সিল ও সিগনেচার
    const sealY = noticeY + 110;

    ctx.save();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(110, sealY + 40, 36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL AUDIT', 110, sealY + 34);
    ctx.font = 'bold 12px monospace';
    ctx.fillText('✓ VERIFIED', 110, sealY + 49);
    ctx.restore();

    ctx.fillStyle = '#64748b';
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ভেরিফিকেশন: ডেটাবেজ ক্রিপ্টোগ্রাফিক সিলড', 160, sealY + 32);
    ctx.fillText('রশিদ প্রস্তুতের সময়: ' + new Date().toLocaleString('bn-BD'), 160, sealY + 52);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি', width - 40, sealY + 36);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SolaimanLipi", "Kalpurush", sans-serif';
    ctx.fillText('মডেল মসজিদ ইমাম পরিষদ বাংলাদেশ', width - 40, sealY + 54);

    // ফুটার বটম বার
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(35, height - 42, width - 70, 4);

    // স্বয়ংক্রিয় ডাউনলোড ট্রিগার
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `Voter-Receipt-${voterId}-${token}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setIsDownloadingReceipt(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Voter-Receipt-${voterId}-${token}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(url);
          setIsDownloadingReceipt(false);
        }, 1500);
      }, 'image/png');
    } catch (err) {
      console.error('Canvas download error:', err);
      setIsDownloadingReceipt(false);
      handlePrintReceipt();
    }
  };

  const now = new Date();
  const startTimeDate = electionSettings?.startTime ? new Date(electionSettings.startTime) : null;
  const endTimeDate = electionSettings?.endTime ? new Date(electionSettings.endTime) : null;
  const isUpcoming = Boolean(startTimeDate && now < startTimeDate && electionSettings?.status !== 'ongoing');
  const isEnded = electionSettings?.status === 'ended' || Boolean(endTimeDate && now >= endTimeDate);

  // নির্বাচন সমাপ্ত হলে ভোটারদের জন্য নোটিশ
  if (isEnded && step < 4) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '2rem auto', width: '100%' }}>
        <div className="card" style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
          borderTop: '6px solid #dc2626',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Lock size={38} />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#991b1b', marginBottom: '0.75rem', fontWeight: 800 }}>
            ভোট গ্রহণ সমাপ্ত হয়েছে
          </h2>
          <p style={{ maxWidth: '560px', margin: '0 auto 1.75rem', color: '#475569', fontSize: '1.1rem', lineHeight: 1.6 }}>
            নির্বাচন কমিশনের নির্ধারিত তফসিল অনুযায়ী ভোট গ্রহণের সময়সীমা শেষ হয়েছে। চূড়ান্ত ফলাফল ও বিজয়ী তালিকা সবার জন্য উন্মুক্ত রয়েছে।
          </p>
          <div style={{ display: 'inline-flex', background: '#f8fafc', padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.75rem', fontSize: '0.92rem', color: '#64748b' }}>
            <span>ভোট সমাপ্তির সময়: <strong>{endTimeDate ? endTimeDate.toLocaleString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'নির্ধারিত সময়'}</strong></span>
          </div>
          <div>
            <a
              href="/results"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 2.2rem', fontSize: '1.15rem', borderRadius: '12px', fontWeight: 700 }}
            >
              <span>নির্বাচনী ফলাফল দেখুন</span>
              <ArrowRight size={22} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // নির্বাচন এখনও শুরু না হলে আসন্ন নোটিশ
  if (isUpcoming && step < 4) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '2rem auto', width: '100%' }}>
        <div className="card" style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
          borderTop: '6px solid #f59e0b',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)'
        }}>
          <div style={{
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            background: '#fef3c7',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Clock size={38} />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#92400e', marginBottom: '0.75rem', fontWeight: 800 }}>
            ভোট গ্রহণ এখনও শুরু হয়নি
          </h2>
          <p style={{ maxWidth: '560px', margin: '0 auto 1.75rem', color: '#475569', fontSize: '1.1rem', lineHeight: 1.6 }}>
            নির্বাচন কমিশনের তফসিল অনুযায়ী ভোট গ্রহণ শুরু হবে: <strong>{startTimeDate ? startTimeDate.toLocaleString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'নির্ধারিত তারিখ'}</strong>।
          </p>
          <div>
            <a
              href="/results"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 2.2rem', fontSize: '1.1rem', borderRadius: '12px', fontWeight: 700 }}
            >
              <span>নির্বাচনী ফলাফল ও তথ্য</span>
              <ArrowRight size={22} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '860px', margin: '0 auto', width: '100%', paddingBottom: '3rem' }}>
      
      {/* ========================================================
          ৪টি ধাপের দৃষ্টিনন্দন ভিজ্যুয়াল প্রোগ্রেস বার (Top Stepper)
         ======================================================== */}
      <div className="card voting-stepper-box" style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        border: '2px solid #e2e8f0',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {/* ধাপ ১: মোবাইল ও ওটিপি */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
            <div className="voting-step-circle" style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: (step === 1 || step === 1.5) ? 'linear-gradient(135deg, #059669, #064e3b)' : (step > 1.5 ? '#10b981' : '#f1f5f9'),
              color: (step >= 1) ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.15rem',
              border: (step === 1 || step === 1.5) ? '3px solid #a7f3d0' : 'none',
              boxShadow: (step === 1 || step === 1.5) ? '0 0 0 4px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {step > 1.5 ? <Check size={24} strokeWidth={3} /> : '১'}
            </div>
            <span className="voting-step-label" style={{
              fontSize: '0.92rem',
              fontWeight: (step === 1 || step === 1.5) ? 800 : 600,
              color: (step === 1 || step === 1.5) ? '#064e3b' : '#64748b',
              marginTop: '0.45rem',
              textAlign: 'center'
            }}>
              ১. মোবাইল ও ওটিপি
            </span>
          </div>

          {/* কানেক্টর ১-২ */}
          <div className="voting-step-connector" style={{
            height: '4px',
            flex: 1,
            background: step >= 2 ? '#10b981' : '#e2e8f0',
            margin: '0 -10px 1.6rem',
            zIndex: 1,
            transition: 'background 0.3s ease'
          }} />

          {/* ধাপ ২: ব্যালট পেপার */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
            <div className="voting-step-circle" style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: step === 2 ? 'linear-gradient(135deg, #059669, #064e3b)' : (step > 2 ? '#10b981' : '#ffffff'),
              color: step >= 2 ? '#ffffff' : '#64748b',
              border: step < 2 ? '2px solid #cbd5e1' : (step === 2 ? '3px solid #a7f3d0' : 'none'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.15rem',
              boxShadow: step === 2 ? '0 0 0 4px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {step > 2 ? <Check size={24} strokeWidth={3} /> : '২'}
            </div>
            <span className="voting-step-label" style={{
              fontSize: '0.92rem',
              fontWeight: step === 2 ? 800 : 600,
              color: step === 2 ? '#064e3b' : '#64748b',
              marginTop: '0.45rem',
              textAlign: 'center'
            }}>
              ২. ডিজিটাল ব্যালট
            </span>
          </div>

          {/* কানেক্টর ২-৩ */}
          <div className="voting-step-connector" style={{
            height: '4px',
            flex: 1,
            background: step >= 3 ? '#10b981' : '#e2e8f0',
            margin: '0 -10px 1.6rem',
            zIndex: 1,
            transition: 'background 0.3s ease'
          }} />

          {/* ধাপ ৩: ভোট পর্যালোচনা */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
            <div className="voting-step-circle" style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: step === 3 ? 'linear-gradient(135deg, #059669, #064e3b)' : (step > 3 ? '#10b981' : '#ffffff'),
              color: step >= 3 ? '#ffffff' : '#64748b',
              border: step < 3 ? '2px solid #cbd5e1' : (step === 3 ? '3px solid #a7f3d0' : 'none'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.15rem',
              boxShadow: step === 3 ? '0 0 0 4px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {step > 3 ? <Check size={24} strokeWidth={3} /> : '৩'}
            </div>
            <span className="voting-step-label" style={{
              fontSize: '0.92rem',
              fontWeight: step === 3 ? 800 : 600,
              color: step === 3 ? '#064e3b' : '#64748b',
              marginTop: '0.45rem',
              textAlign: 'center'
            }}>
              ৩. ভোট পর্যালোচনা
            </span>
          </div>

          {/* কানেক্টর ৩-৪ */}
          <div className="voting-step-connector" style={{
            height: '4px',
            flex: 1,
            background: step >= 4 ? '#10b981' : '#e2e8f0',
            margin: '0 -10px 1.6rem',
            zIndex: 1,
            transition: 'background 0.3s ease'
          }} />

          {/* ধাপ ৪: সফল রসিদ */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 2 }}>
            <div className="voting-step-circle" style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: step === 4 ? 'linear-gradient(135deg, #059669, #064e3b)' : '#ffffff',
              color: step === 4 ? '#ffffff' : '#64748b',
              border: step < 4 ? '2px solid #cbd5e1' : '3px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.15rem',
              boxShadow: step === 4 ? '0 0 0 4px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              {step === 4 ? <Check size={24} strokeWidth={3} /> : '৪'}
            </div>
            <span className="voting-step-label" style={{
              fontSize: '0.92rem',
              fontWeight: step === 4 ? 800 : 600,
              color: step === 4 ? '#064e3b' : '#64748b',
              marginTop: '0.45rem',
              textAlign: 'center'
            }}>
              ৪. ডিজিটাল রসিদ
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          ধাপ ১: মোবাইল নম্বর দিয়ে ওটিপি প্রেরণ স্ক্রিন
         ======================================================== */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          <div className="card hero-gradient voting-hero-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: '#fff', borderRadius: '18px' }}>
            <div className="voting-hero-icon" style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '3px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <Smartphone size={38} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff', lineHeight: 1.3 }}>
              ডিজিটাল ব্যালট বুথ - ভোটার প্রবেশাধিকার
            </h1>
            <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', color: '#f1f5f9', lineHeight: 1.6 }}>
              ভোটার তালিকায় নিবন্ধিত আপনার মোবাইল নম্বরটি লিখুন। আপনার মোবাইলে একটি তাৎক্ষণিক ৪-সংখ্যার এসএমএস ওটিপি (OTP) পাঠানো হবে।
            </p>
          </div>

          <form onSubmit={handleVerifyVoter} className="card voting-form-card" style={{ background: '#ffffff', borderTop: '5px solid #059669', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.65rem', color: '#0f172a', fontSize: '1.25rem' }}>
                  নিবন্ধিত মোবাইল নম্বর প্রবেশ করান:
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="tel" 
                    placeholder="যেমন: 017XXXXXXXX বা 018XXXXXXXX"
                    value={voterPhoneInput}
                    onChange={(e) => setVoterPhoneInput(e.target.value)}
                    className="voter-input-lg"
                    style={{ 
                      fontWeight: 700, 
                      paddingLeft: '3.2rem', 
                      fontSize: '1.25rem', 
                      height: '58px',
                      borderRadius: '12px',
                      border: '2px solid #cbd5e1'
                    }}
                    autoFocus
                    required
                  />
                  <Smartphone size={26} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#059669' }} />
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  marginTop: '0.75rem',
                  fontSize: '0.95rem',
                  color: '#334155',
                  background: '#f8fafc',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0'
                }}>
                  <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>গোপন পিন টাইপ করার ঝামেলা নেই:</strong> আপনার নিবন্ধিত মোবাইলে সরাসরি ৪-সংখ্যার ওটিপি কোড আসবে, কোডটি দিলেই ব্যালট পেপার খুলে যাবে।
                  </span>
                </div>
              </div>

              {authError && (
                <div style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  border: '1.5px solid #fecaca'
                }}>
                  <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontWeight: 600 }}>{authError}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSendingOtp}
                className="btn btn-primary"
                style={{ 
                  width: '100%', 
                  fontSize: '1.25rem', 
                  minHeight: '58px', 
                  borderRadius: '12px',
                  fontWeight: 800,
                  boxShadow: '0 6px 20px rgba(5, 150, 105, 0.35)'
                }}
              >
                <Smartphone size={24} />
                <span>{isSendingOtp ? 'ওটিপি পাঠানো হচ্ছে...' : 'ওটিপি (OTP) পাঠান ও ভোটার যাচাই করুন'}</span>
              </button>

            </div>
          </form>

        </div>
      )}

      {/* ========================================================
          ধাপ ১.৫: মোবাইল এসএমএস ওটিপি (OTP) ভেরিফিকেশন ও স্বয়ংক্রিয় তথ্য
         ======================================================== */}
      {step === 1.5 && currentVoter && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          <div className="card hero-gradient" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: '#fff', borderRadius: '18px' }}>
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              border: '3px solid rgba(255, 255, 255, 0.45)'
            }}>
              <Smartphone size={38} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.75rem', color: '#ffffff', lineHeight: 1.3 }}>
              মোবাইল ওটিপি (OTP) যাচাইকরণ
            </h1>
            <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', color: '#f1f5f9', lineHeight: 1.6 }}>
              আপনার মোবাইলে (<strong style={{ color: '#fbbf24', fontSize: '1.2rem' }}>{currentVoter.phone}</strong>) ৪ সংখ্যার গোপন ওটিপি কোড পাঠানো হয়েছে। কোডটি দিয়ে পরিচয় নিশ্চিত করুন।
            </p>
          </div>

          {/* লাইভ এসএমএস নিশ্চিতকরণ ব্যানার */}
          {otpSentNotification && (
            otpSentNotification.simulated ? (
              <div style={{
                background: '#eff6ff',
                border: '2px solid #3b82f6',
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 6px 20px rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Smartphone size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <strong style={{ color: '#1e40af', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={20} color="#2563eb" />
                      <span>টেস্টিং মোড: অন-স্ক্রিন ওটিপি কোড</span>
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: '#1d4ed8', background: '#dbeafe', padding: '0.2rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
                      {otpSentNotification.time}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.98rem', color: '#1e3a8a', lineHeight: '1.6' }}>
                    অ্যাডমিন সেটিংসে লাইভ এসএমএস বন্ধ থাকায় ওটিপি কোডটি স্ক্রিনে প্রদর্শন করা হলো: <strong style={{ color: '#1d4ed8', fontSize: '1.35rem', letterSpacing: '3px', background: '#dbeafe', padding: '2px 8px', borderRadius: '6px' }}>{otpSentNotification.code}</strong>
                  </div>
                </div>
              </div>
            ) : otpSentNotification.success ? (
              <div style={{
                background: '#ecfdf5',
                border: '2px solid #059669',
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  background: '#059669',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Smartphone size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <strong style={{ color: '#064e3b', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={20} color="#059669" />
                      <span>৪-সংখ্যার ওটিপি আপনার মোবাইলে এসএমএস করা হয়েছে</span>
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: '#047857', background: '#d1fae5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
                      {otpSentNotification.time}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.98rem', color: '#065f46', lineHeight: '1.6' }}>
                    আপনার নিবন্ধিত মোবাইল নম্বর (<strong style={{ color: '#047857', fontSize: '1.05rem' }}>{currentVoter.phone}</strong>)-এ গোপন ওটিপি কোড পাঠানো হয়েছে। নিরাপত্তার স্বার্থে স্ক্রিনে ওটিপি প্রদর্শন বন্ধ রাখা হয়েছে। আপনার মোবাইলের মেসেজ ইনবক্স চেক করে নিচের বক্সে কোডটি লিখুন।
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: '#fef2f2',
                border: '2px solid #ef4444',
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem'
              }}>
                <div style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlertCircle size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <strong style={{ color: '#991b1b', fontSize: '1.1rem' }}>
                      ⚠️ এসএমএস প্রেরণে গেটওয়ে সমস্যা
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: '#b91c1c', background: '#fee2e2', padding: '0.2rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
                      লাইভ রিপোর্ট
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#7f1d1d', lineHeight: '1.5' }}>
                    {otpSentNotification.errorMsg || 'এসএমএস গেটওয়ে থেকে কোনো রেসপন্স পাওয়া যায়নি।'}
                  </p>
                  {(otpSentNotification.errorMsg?.includes('১০৩২') || otpSentNotification.errorMsg?.includes('1032') || otpSentNotification.errorMsg?.includes('Whitelist')) && (
                    <div style={{
                      marginTop: '0.75rem',
                      background: '#ffffff',
                      border: '1.5px solid #fca5a5',
                      borderRadius: '10px',
                      padding: '0.9rem 1.15rem',
                      color: '#991b1b',
                      fontSize: '0.88rem',
                      lineHeight: '1.65'
                    }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.4rem', color: '#b91c1c' }}>
                        🛠️ BulkSMSBD Error 1032 সমাধানের সহজ নির্দেশিকা:
                      </div>
                      <div>
                        <strong>মূল কারণ:</strong> Vercel ক্লাউড সার্ভারের আউটবাউন্ড আইপি BulkSMSBD পোর্টালে অনুমোদিত নয়।
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <strong>১. সবচেয়ে সহজ ও স্থায়ী সমাধান (Vercel ক্লাউডের জন্য প্রস্তাবিত):</strong><br />
                        • <a href="https://bulksmsbd.net/login" target="_blank" rel="noreferrer" style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'underline' }}>bulksmsbd.net</a> পোর্টালে লগইন করুন।<br />
                        • ড্যাশবোর্ডে <strong>API Settings / Security</strong>-এ গিয়ে <strong>"Source IP Checking" বা "IP Whitelist"</strong> অপশনটি <strong>Disable (নিষ্ক্রিয় / OFF)</strong> করে দিন। এটি করলে Vercel সার্ভারলেস ক্লাউড থেকে সব ওটিপি সরাসরি চলে যাবে।
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <strong>২. বিকল্প পদ্ধতি (আইপি যুক্ত করা বা হেল্পলাইন):</strong><br />
                        • BulkSMSBD পোর্টালে <em>Phonebook -&gt; IP White List</em>-এ যান এবং আপনার সার্ভার আইপি {otpSentNotification.serverIp ? <code style={{ background: '#fee2e2', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>{otpSentNotification.serverIp}</code> : 'সার্ভার আইপি'} যুক্ত করুন।<br />
                        • অথবা BulkSMSBD হেল্পলাইন / WhatsApp সাপোর্টে নক দিয়ে জানান: <em>"আমাদের Vercel ক্লাউড অ্যাপ্লিকেশনের জন্য API Source IP Restriction তুলে দিন।"</em>
                      </div>
                      <div style={{ marginTop: '0.5rem', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: '3px solid #ef4444' }}>
                        💡 <strong>তাত্ক্ষণিক বিকল্প:</strong> সমস্যা সমাধান না হওয়া পর্যন্ত ভোট টেস্ট করার জন্য অ্যাডমিন প্যানেল (<a href="/admin" target="_blank" rel="noreferrer" style={{ color: '#b91c1c', fontWeight: 700, textDecoration: 'underline' }}>Admin Panel</a> -&gt; এসএমএস কনফিগারেশন) থেকে <strong>"লাইভ এসএমএস প্রেরণ"</strong> সাময়িকভাবে আনচেক করে সেভ করলে স্ক্রিনেই ওটিপি কোড পাওয়া যাবে।
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* ওটিপি যাচাই সফল হলে ভোটার প্রোফাইল কার্ড প্রদর্শন */}
          {isOtpVerified ? (
            <div className="card voting-profile-card" style={{ background: '#ffffff', borderTop: '6px solid #059669', borderRadius: '16px', boxShadow: 'var(--shadow-card)', padding: '2rem' }}>
              <div style={{
                background: '#ecfdf5',
                border: '2px solid #a7f3d0',
                borderRadius: '14px',
                padding: '1.35rem 1.5rem',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle2 size={34} />
                </div>
                <div>
                  <h2 style={{ margin: 0, color: '#065f46', fontSize: '1.5rem', fontWeight: 800 }}>
                    ভোটার পরিচয় সফলভাবে নিশ্চিত হয়েছে!
                  </h2>
                  <p style={{ margin: '0.3rem 0 0', color: '#047857', fontSize: '0.98rem' }}>
                    সার্ভার থেকে আপনার ভোটার তথ্য সফলভাবে ভেরিফাই করা হয়েছে। কোনো গোপন পিন বা নাম টাইপ করার প্রয়োজন নেই।
                  </p>
                </div>
              </div>

              {/* স্বয়ংক্রিয় ভোটার তথ্য কার্ড */}
              <div className="voting-profile-grid" style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '14px',
                padding: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.35rem',
                marginBottom: '1.75rem'
              }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>ইমাম মহোদয়ের নাম:</span>
                  <strong style={{ color: '#064e3b', fontSize: '1.4rem', display: 'block', marginTop: '0.2rem' }}>{currentVoter.name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>কর্মরত মডেল মসজিদ:</span>
                  <strong style={{ color: '#0f172a', fontSize: '1.18rem', display: 'block', marginTop: '0.2rem' }}>{currentVoter.mosque}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>ভোটার কোড / আইডি:</span>
                  <strong style={{ color: '#059669', fontFamily: 'monospace', fontSize: '1.25rem', display: 'block', marginTop: '0.2rem' }}>{currentVoter.voterId}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>এলাকা ও বিভাগ:</span>
                  <strong style={{ color: '#0f172a', fontSize: '1.15rem', display: 'block', marginTop: '0.2rem' }}>{currentVoter.district}, {currentVoter.division}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>যাচাইকৃত মোবাইল নম্বর:</span>
                  <strong style={{ color: '#0f172a', fontSize: '1.18rem', display: 'block', marginTop: '0.2rem' }}>{currentVoter.phone}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>ভোটাধিকার স্ট্যাটাস:</span>
                  <span className="badge badge-success" style={{ padding: '0.35rem 0.85rem', fontSize: '0.95rem', fontWeight: 700, marginTop: '0.25rem' }}>
                    ✓ অনুমোদিত ও সক্রিয়
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsOtpVerified(false);
                    setStep(1);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: '1 1 160px', minHeight: '54px', fontSize: '1.1rem', borderRadius: '12px' }}
                >
                  <ArrowLeft size={20} />
                  <span>অন্য নম্বর দিন</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn btn-primary"
                  style={{ flex: '2 1 260px', minHeight: '54px', fontSize: '1.25rem', borderRadius: '12px', fontWeight: 800 }}
                >
                  <span>ব্যালট পেপারে প্রবেশ করুন</span>
                  <ArrowRight size={22} />
                </button>
              </div>

            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="card voting-form-card" style={{ background: '#fff', borderTop: '5px solid #059669', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.65rem', color: '#0f172a', fontSize: '1.3rem' }}>
                    ৪-সংখ্যার ওটিপি (OTP) কোড প্রবেশ করান:
                  </label>
                  <input 
                    type="text" 
                    placeholder="• • • •"
                    value={inputOtp}
                    onChange={(e) => setInputOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    maxLength={4}
                    className="otp-input-field"
                    style={{ 
                      letterSpacing: '14px', 
                      fontSize: '2.2rem', 
                      textAlign: 'center', 
                      fontWeight: 800,
                      height: '64px',
                      borderRadius: '12px',
                      border: '2.5px solid #059669',
                      color: '#064e3b'
                    }}
                    autoFocus
                    required
                  />
                </div>

                {/* টাইমার ও রিসেন্ড অপশন */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.95rem' }}>
                  <span style={{ color: otpTimer > 0 ? '#475569' : '#dc2626', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600 }}>
                    কোডের মেয়াদ: <strong style={{ color: otpTimer > 0 ? '#059669' : '#dc2626', fontSize: '1.15rem' }}>{Math.floor(otpTimer / 60)}:{('0' + (otpTimer % 60)).slice(-2)} মিনিট</strong>
                  </span>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={!isResendActive}
                    className="btn btn-outline"
                    style={{
                      padding: '0.5rem 1.15rem',
                      minHeight: '42px',
                      fontSize: '0.95rem',
                      borderRadius: '8px',
                      fontWeight: 700
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>পুনরায় কোড পাঠান</span>
                  </button>
                </div>

                {otpError && (
                  <div style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    border: '1.5px solid #fecaca'
                  }}>
                    <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontWeight: 600 }}>{otpError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="btn btn-secondary"
                    style={{ flex: 1, minHeight: '54px', fontSize: '1.1rem', borderRadius: '12px' }}
                  >
                    <ArrowLeft size={20} />
                    <span>পেছনে যান</span>
                  </button>

                  <button 
                    type="submit" 
                    disabled={isSendingOtp}
                    className="btn btn-primary"
                    style={{ flex: 2, minHeight: '54px', fontSize: '1.2rem', borderRadius: '12px', fontWeight: 800 }}
                  >
                    <CheckCircle2 size={24} />
                    <span>{isSendingOtp ? 'যাচাই করা হচ্ছে...' : 'ওটিপি যাচাই করুন'}</span>
                  </button>
                </div>

              </div>
            </form>
          )}

        </div>
      )}

      {/* ========================================================
          ধাপ ২: অফিসিয়াল ব্যালট পেপার (৫টি পদ)
         ======================================================== */}
      {step === 2 && currentVoter && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* ব্যালট হেডার ও ভোটার তথ্যের নিরাপদ সংক্ষিপ্ত কার্ড */}
          <div className="card ballot-voter-card" style={{ background: '#ffffff', borderLeft: '6px solid #059669', borderRadius: '16px', padding: '1.5rem 1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '0.4rem', fontSize: '0.9rem', padding: '0.3rem 0.75rem' }}>
                  ✓ অনুমোদিত ভোটার
                </span>
                <h2 style={{ fontSize: '1.8rem', color: '#064e3b', fontWeight: 800, marginTop: '0.2rem' }}>
                  সম্মানিত ভোটার: {currentVoter.name}
                </h2>
                <div style={{ fontSize: '1.05rem', color: '#475569', marginTop: '0.25rem' }}>
                  মডেল মসজিদ: <strong style={{ color: '#0f172a' }}>{currentVoter.mosque}</strong> ({currentVoter.district})
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-gold" style={{ fontSize: '0.92rem', padding: '0.35rem 0.85rem' }}>
                  🛡️ ১০০% গোপন ব্যালট মোড
                </span>
                <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.35rem' }}>
                  আপনার ভোট এনক্রিপ্টেড ও সম্পূর্ণ গোপন
                </div>
              </div>
            </div>
          </div>

          {/* প্রোগ্রেস ইন্ডিকেটর */}
          <div className="ballot-progress-card" style={{ background: '#ffffff', padding: '1.1rem 1.35rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              <span style={{ color: '#0f172a' }}>পদভিত্তিক ভোট অগ্রগতি:</span>
              <span style={{ color: '#059669', fontSize: '1.15rem' }}>
                {Object.keys(ballotSelections).length} / {POSTS.length} পদ সম্পন্ন
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                width: `${(Object.keys(ballotSelections).length / POSTS.length) * 100}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* ৫টি পদের ব্যালট বক্স */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {POSTS.map((post, postIndex) => {
              const candidatesForPost = (candidatesList || []).filter(c => c.postId === post.id);
              const selectedCandidateId = ballotSelections[post.id];

              return (
                <div 
                  key={post.id}
                  id={`post-section-${post.id}`}
                  className="card post-section-card"
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    border: selectedCandidateId ? '2.5px solid #059669' : '2px solid #cbd5e1',
                    boxShadow: selectedCandidateId ? '0 6px 20px rgba(5, 150, 105, 0.12)' : 'var(--shadow-card)',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {/* পদের নাম ও বড় হেডলাইন */}
                  <div 
                    className="post-section-header"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: '0.9rem',
                      borderBottom: '2px solid #e2e8f0',
                      marginBottom: '1.25rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span 
                        className="post-number-badge"
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: selectedCandidateId ? 'linear-gradient(135deg, #059669, #064e3b)' : '#f1f5f9',
                          color: selectedCandidateId ? '#ffffff' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          border: selectedCandidateId ? '2px solid #a7f3d0' : '1.5px solid #cbd5e1'
                        }}
                      >
                        {postIndex + 1}
                      </span>
                      <h3 
                        className="post-section-title"
                        style={{ fontSize: '1.65rem', color: '#064e3b', fontWeight: 800, margin: 0 }}
                      >
                        {post.title}
                      </h3>
                    </div>

                    {selectedCandidateId ? (
                      <span className="badge badge-success" style={{ gap: '0.35rem', fontSize: '0.95rem', padding: '0.35rem 0.85rem', fontWeight: 700 }}>
                        <Check size={18} strokeWidth={3} />
                        <span>প্রার্থী নির্বাচিত</span>
                      </span>
                    ) : (
                      <span className="badge badge-danger" style={{ fontSize: '0.9rem', padding: '0.35rem 0.85rem', fontWeight: 700 }}>
                        {candidatesForPost.length === 0 ? 'প্রার্থী নেই' : 'প্রার্থী নির্বাচন বাকি'}
                      </span>
                    )}
                  </div>

                  {/* এই পদের প্রার্থীরা (ট্যাপ/ক্লিক করে সিলেক্ট করা) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {candidatesForPost.length === 0 ? (
                      <div style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        এই পদে এখনো কোনো প্রার্থী নিবন্ধিত হয়নি।
                      </div>
                    ) : (
                      candidatesForPost.map((candidate) => {
                        const isSelected = selectedCandidateId === candidate.id;
                        return (
                          <div
                            key={candidate.id}
                            onClick={() => handleSelectCandidate(post.id, candidate.id)}
                            className="candidate-card"
                            style={{
                              padding: '1.25rem 1.4rem',
                              borderRadius: '14px',
                              border: isSelected ? '3px solid #059669' : '2px solid #cbd5e1',
                              background: isSelected ? '#ecfdf5' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem',
                              boxShadow: isSelected ? '0 4px 15px rgba(5, 150, 105, 0.16)' : '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                          >
                            {/* প্রার্থীর ছবি / আভাটার */}
                            {candidate.photo ? (
                              <img 
                                src={candidate.photo} 
                                alt={candidate.name} 
                                style={{
                                  width: '54px',
                                  height: '54px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: isSelected ? '2.5px solid #059669' : '2px solid #cbd5e1',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                  flexShrink: 0
                                }} 
                              />
                            ) : (
                              <div style={{
                                width: '54px',
                                height: '54px',
                                borderRadius: '50%',
                                background: isSelected ? '#d1fae5' : '#f1f5f9',
                                color: isSelected ? '#047857' : '#94a3b8',
                                border: isSelected ? '2px solid #10b981' : '1.5px dashed #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <User size={28} />
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div 
                                className="candidate-card-name"
                                style={{
                                  fontWeight: 800,
                                  fontSize: '1.35rem',
                                  color: isSelected ? '#064e3b' : '#0f172a',
                                  marginBottom: '0.25rem',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {candidate.name}
                              </div>
                              <div 
                                className="candidate-card-meta"
                                style={{ fontSize: '1rem', color: '#475569', fontWeight: 500 }}
                              >
                                {candidate.mosque} • {candidate.district} ({candidate.division} বিভাগ)
                              </div>
                            </div>

                            {/* রেডিও বোতাম / সিলেক্ট চেকমার্ক - ক্লিকে কখনোই হাইড বা ব্যাকগ্রাউন্ডে মিশবে না */}
                            <div 
                              className="candidate-card-radio"
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                border: isSelected ? '3px solid #047857' : '2.5px solid #94a3b8',
                                background: isSelected ? '#059669' : '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                flexShrink: 0,
                                boxShadow: isSelected ? '0 2px 8px rgba(5, 150, 105, 0.4)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {isSelected && <Check size={22} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {submitError && (
            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '1.05rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              border: '1.5px solid #fecaca',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)'
            }}>
              <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontWeight: 600 }}>{submitError}</span>
            </div>
          )}

          {/* রিভিউ বা পরবর্তী ধাপ বোতাম */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="btn btn-secondary"
              style={{ flex: '1 1 160px', minHeight: '56px', fontSize: '1.1rem', borderRadius: '12px' }}
            >
              <ArrowLeft size={20} />
              <span>বাতিল করুন</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToReview}
              className="btn btn-primary"
              style={{ 
                flex: '2 1 280px', 
                fontSize: '1.25rem', 
                minHeight: '56px', 
                borderRadius: '12px', 
                fontWeight: 800,
                background: isAllPostsVoted ? 'linear-gradient(135deg, #059669 0%, #064e3b 100%)' : 'linear-gradient(135deg, #0d9488 0%, #047857 100%)'
              }}
            >
              <span>
                {isAllPostsVoted 
                  ? 'পছন্দসমূহ পর্যালোচনা (রিভিউ) করুন' 
                  : `পছন্দসমূহ পর্যালোচনা করুন (বাকি ${POSTS.length - Object.keys(ballotSelections).length}টি পদ)`
                }
              </span>
              <ArrowRight size={22} />
            </button>
          </div>

        </div>
      )}

      {/* ========================================================
          ধাপ ৩: ব্যালট রিভিউ ও চূড়ান্ত জমা (Review & Confirm)
         ======================================================== */}
      {step === 3 && currentVoter && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          <div className="card voting-review-card" style={{ background: '#ffffff', borderTop: '5px solid #d97706', borderRadius: '16px', padding: '2rem' }}>
            <h2 style={{ fontSize: '2rem', color: '#064e3b', marginBottom: '0.5rem', fontWeight: 800 }}>
              ব্যালট পেপার চূড়ান্ত পর্যালোচনা ও নিশ্চিতকরণ
            </h2>
            <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6 }}>
              অনুগ্রহ করে আপনার নির্বাচিত ৫টি পদের প্রার্থীদের তালিকা সতর্কতার সাথে মিলিয়ে নিন। 
              <strong style={{ color: '#b91c1c' }}> সাবমিট করার পর এই ভোট আর পরিবর্তন করা সম্ভব হবে না।</strong>
            </p>
          </div>

          <div className="card voting-review-card" style={{ background: '#ffffff', borderRadius: '16px', padding: '1.75rem', border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {POSTS.map((post, idx) => {
                const candidate = (candidatesList || []).find(c => c.id === ballotSelections[post.id]);
                return (
                  <div key={post.id} className="voting-review-item" style={{
                    padding: '1.15rem 1.35rem',
                    background: '#f8fafc',
                    borderRadius: '14px',
                    border: '1.5px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      {candidate?.photo ? (
                        <img 
                          src={candidate.photo} 
                          alt={candidate.name} 
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #059669',
                            flexShrink: 0
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: '#e2e8f0',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <User size={26} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>পদ {idx + 1}: {post.title}</div>
                        <div className="review-cand-name" style={{ fontWeight: 800, fontSize: '1.4rem', color: '#064e3b', marginTop: '0.2rem' }}>
                          {candidate ? candidate.name : 'নির্বাচিত হয়নি'}
                        </div>
                        <div style={{ fontSize: '0.98rem', color: '#334155', marginTop: '0.15rem' }}>
                          {candidate?.mosque} ({candidate?.district})
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-success" style={{ padding: '0.4rem 0.95rem', fontSize: '0.95rem', fontWeight: 700 }}>
                      ✓ মনোনীত
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* গোপনীয়তার অঙ্গীকার ঘোষণা */}
          <div style={{
            background: '#ecfdf5',
            padding: '1.35rem 1.5rem',
            borderRadius: '14px',
            border: '2px solid #a7f3d0',
            fontSize: '1rem',
            color: '#065f46',
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-start',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)'
          }}>
            <ShieldCheck size={26} style={{ flexShrink: 0, marginTop: '2px' }} color="#059669" />
            <div style={{ lineHeight: 1.6 }}>
              <strong style={{ fontSize: '1.15rem', display: 'block', marginBottom: '0.25rem' }}>
                ১০০% গোপন ব্যালটের নিশ্চয়তা:
              </strong>
              আপনার ভোট সাবমিট হওয়ার সাথে সাথে আপনার নাম ও ভোটার আইডি থেকে ব্যালট তথ্য স্থায়ীভাবে বিচ্ছিন্ন (Decoupled) হয়ে যাবে। স্বয়ং ডাটাবেজ এডমিনও জানতে পারবে না আপনি কোন প্রার্থীকে ভোট দিয়েছেন।
            </div>
          </div>

          {submitError && (
            <div style={{
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '1.05rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              border: '1.5px solid #fecaca'
            }}>
              <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontWeight: 600 }}>{submitError}</span>
            </div>
          )}

          {/* অ্যাকশন বোতাম */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="btn btn-secondary"
              style={{ flex: '1 1 160px', minHeight: '58px', fontSize: '1.15rem', borderRadius: '12px' }}
            >
              <ArrowLeft size={20} />
              <span>পরিবর্তন করুন</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmFinalVote}
              disabled={isSubmittingVote}
              className="btn btn-primary"
              style={{
                flex: '2 1 280px',
                fontSize: '1.35rem',
                minHeight: '62px',
                borderRadius: '12px',
                fontWeight: 800,
                boxShadow: '0 6px 22px rgba(5, 150, 105, 0.4)'
              }}
            >
              <CheckCircle2 size={26} />
              <span>{isSubmittingVote ? 'ভোট জমা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...' : 'হ্যাঁ, চূড়ান্ত ভোট সাবমিট করুন'}</span>
            </button>
          </div>

        </div>
      )}

      {/* ========================================================
          ধাপ ৪: সফল ভোট প্রদান ও ডিজিটাল রসিদ
         ======================================================== */}
      {step === 4 && (
        <div className="card voting-receipt-card" style={{
          background: '#ffffff',
          textAlign: 'center',
          padding: '3rem 2rem',
          maxWidth: '660px',
          margin: '0 auto',
          boxShadow: 'var(--shadow-elevated)',
          borderRadius: '20px',
          borderTop: '6px solid #059669'
        }}>
          {/* স্ক্রিন হেডার (প্রিন্টে হাইড থাকবে) */}
          <div className="voting-screen-success-header">
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '4px solid #bbf7d0',
              boxShadow: '0 6px 20px rgba(5, 150, 105, 0.2)'
            }}>
              <CheckCircle2 size={48} />
            </div>

            <h2 style={{ fontSize: '2.2rem', color: '#064e3b', fontWeight: 800, marginBottom: '0.65rem' }}>
              আলহামদুলিল্লাহ! আপনার ভোট সফল হয়েছে
            </h2>

            <p style={{ color: '#475569', fontSize: '1.1rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
              মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচনে আপনার পবিত্র আমানত ও ভোটাধিকার সফলভাবে গৃহীত হয়েছে।
            </p>
          </div>

          {/* ডিজিটাল এনক্রিপ্টেড রসিদ বক্স (শুধুমাত্র এটি প্রিন্ট হবে) */}
          <div 
            id="voter-receipt-printable"
            style={{
              background: '#f8fafc',
              padding: '1.75rem',
              borderRadius: '16px',
              border: '2px dashed #cbd5e1',
              textAlign: 'left',
              marginBottom: '1.75rem',
              fontSize: '1rem',
              position: 'relative'
            }}
          >
            {/* প্রিন্ট-অনলি অফিসিয়াল হেডার (সাধারণ স্ক্রিনে হাইড থাকবে, প্রিন্টে দৃশ্যমান হবে) */}
            <div className="print-only-block" style={{ textAlign: 'center', borderBottom: '2px solid #064e3b', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#064e3b', marginBottom: '3px' }}>
                মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি ২০২৬-২০২৮
              </div>
              <div style={{ display: 'inline-block', background: '#064e3b', color: '#ffffff', fontSize: '12px', fontWeight: 700, padding: '3px 14px', borderRadius: '20px' }}>
                ভোটার ভোট প্রদান রশিদ ও অডিট প্রত্যয়নপত্র
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>ডিজিটাল অডিট টোকেন:</span>
              <strong style={{ letterSpacing: '2px', color: '#064e3b', fontSize: '1.35rem', fontFamily: 'monospace', background: '#ecfdf5', padding: '0.2rem 0.65rem', borderRadius: '8px', border: '1.5px solid #a7f3d0' }}>
                {voteReceiptToken}
              </strong>
            </div>
            
            {currentVoter && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{ color: '#64748b' }}>ভোটারের নাম:</span>
                  <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>{currentVoter.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{ color: '#64748b' }}>কর্মরত মডেল মসজিদ:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{currentVoter.mosque}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{ color: '#64748b' }}>ভোটার কোড / মোবাইল:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{currentVoter.voterId} ({currentVoter.phone})</span>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ color: '#64748b' }}>ভোট প্রদানের সময়:</span>
              <span style={{ color: '#0f172a', fontWeight: 600 }}>{new Date().toLocaleString('bn-BD')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <span style={{ color: '#64748b' }}>ভোটার স্ট্যাটাস:</span>
              <span className="badge badge-success" style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>✓ ভোট সম্পন্ন (Locked)</span>
            </div>
            
            <div style={{
              background: '#f1f5f9',
              padding: '1rem',
              borderRadius: '10px',
              borderLeft: '4px solid #059669',
              fontSize: '0.88rem',
              color: '#334155',
              lineHeight: 1.6,
              marginTop: '0.75rem'
            }}>
              <strong>🛡️ গোপনীয়তা নীতি ও চ্যালেঞ্জ ভেরিফিকেশন:</strong> নির্বাচন চলাকালীন শতভাগ গোপনীয়তা রক্ষার স্বার্থে এই রসিদে আপনার পছন্দের প্রার্থীদের নাম দেখানো হয় না। তবে নির্বাচন সমাপ্ত হওয়ার পর কোনো প্রার্থী বা ভোটার যদি ফলাফল নিয়ে চ্যালেঞ্জ করেন, তবে এই অডিট টোকেন নম্বর দিয়ে অ্যাডমিন প্যানেল থেকে আপনার প্রদত্ত ভোট নির্ভুলভাবে যাচাই করা যাবে।
            </div>

            {/* প্রিন্ট-অনলি ফুটার সিল (স্ক্রিনে হাইড) */}
            <div className="print-only-block" style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>ভেরিফিকেশন: ডেটাবেস ক্রিপ্টোগ্রাফিক সিলড</div>
              <div>কেন্দ্রীয় নির্বাচন পরিচালনা ও আহ্বায়ক কমিটি</div>
            </div>
          </div>

          {/* অ্যাকশন বাটনসমূহ (প্রিন্টে সম্পূর্ণ হাইড থাকবে) */}
          <div className="voting-screen-actions" style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isDownloadingReceipt}
              onClick={handleDownloadReceipt}
              className="btn btn-primary"
              style={{
                flex: '1 1 220px',
                minHeight: '52px',
                fontSize: '1.15rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 15px rgba(5, 150, 105, 0.35)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <Download size={22} />
              <span>{isDownloadingReceipt ? 'ডাউনলোড হচ্ছে...' : 'রশিদ সরাসরি ডাউনলোড করুন'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReceipt}
              className="btn btn-secondary"
              style={{
                flex: '1 1 180px',
                minHeight: '52px',
                fontSize: '1.1rem',
                borderRadius: '12px',
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <Printer size={20} color="#059669" />
              <span>প্রিন্ট / পিডিএফ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setCurrentVoter(null);
                setBallotSelections({});
                setVoterPhoneInput('');
                setIsOtpVerified(false);
                setOtpSentNotification(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="btn btn-outline"
              style={{
                flex: '1 1 170px',
                minHeight: '52px',
                fontSize: '1.1rem',
                borderRadius: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <span>হোমে ফিরে যান</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
