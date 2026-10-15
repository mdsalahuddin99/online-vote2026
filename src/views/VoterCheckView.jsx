import React from 'react';
import { Navigate } from 'react-router-dom';

// পাবলিক ভোটার যাচাই পেইজ অপসারণ করা হয়েছে - হোম পেইজে রিডাইরেক্ট
export default function VoterCheckView() {
  return <Navigate to="/" replace />;
}
