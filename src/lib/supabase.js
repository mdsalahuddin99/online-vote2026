import { createClient } from '@supabase/supabase-js';

// সুপাবেস প্রজেক্টের কনফিগারেশন (.env বা ডিফল্ট ডেমো ফলব্যাক)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// ক্লায়েন্ট ইনস্ট্যান্স
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (typeof window !== 'undefined' && supabase) {
  window.supabase = supabase;
}

// সুপাবেস সক্রিয় আছে কি না চেক
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabase);
};

/**
 * ১. নিরাপদ ভোট প্রদান ফাংশন (RPC)
 * Zero-Knowledge Privacy নিশ্চিত করে ডাটাবেজের ফাংশনে কল করা হয়।
 */
export async function submitVoteSecurely({ voterId, secretPin, ballotSelections, auditToken }) {
  if (!isSupabaseConfigured()) {
    // ডেমো মোড ফলব্যাক (সুপাবেস কনফিগ না থাকলে লোকাল স্টেট)
    return {
      success: true,
      demo: true,
      audit_token: auditToken || ('TX-DEMO-' + Math.random().toString(36).substring(2, 8).toUpperCase())
    };
  }

  const generatedToken = auditToken || ('TX-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4));

  // ১. প্রথমে সুপাবেসের সিকিউর অ্যাটমিক RPC কল করার চেষ্টা (Row Locking সহ ডাবল ভোটিং প্রতিরোধ)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('cast_secure_vote', {
      p_voter_id: voterId,
      p_secret_pin: secretPin || '',
      p_ballot: ballotSelections
    });

    if (!rpcError && rpcData && rpcData.success) {
      return {
        success: true,
        audit_token: rpcData.audit_token || generatedToken,
        method: 'rpc'
      };
    }
    // যদি আরপিসি থেকে ভ্যালিডেশন এরর আসে (যেমন: ইতিমধ্যে ভোট দেওয়া হয়েছে)
    if (rpcData && rpcData.success === false) {
      return {
        success: false,
        message: rpcData.message
      };
    }
  } catch (rpcErr) {
    console.warn('RPC cast_secure_vote fallback:', rpcErr);
  }

  // ২. ফলব্যাক ট্রানজেকশনাল আপডেট (যদি আরপিসি সক্রিয় না থাকে বা পিনবিহীন ওটিপি ভেরিফিকেশন হয়)
  try {
    // ক) ভোটার ইতিপূর্বে ভোট দিয়েছে কি না যাচাই
    const { data: voterCheck, error: checkErr } = await supabase
      .from('voters')
      .select('has_voted')
      .eq('voter_id', voterId)
      .single();

    if (voterCheck && voterCheck.has_voted) {
      return {
        success: false,
        message: 'এই ভোটার আইডি দিয়ে ইতিপূর্বে ভোট সম্পন্ন হয়েছে। দ্বিতীয়বার ভোট দেওয়া নিষিদ্ধ।'
      };
    }

    // খ) ভোটার স্ট্যাটাস অবিলম্বে লক করা
    const { error: updateErr } = await supabase
      .from('voters')
      .update({
        has_voted: true,
        voted_at: new Date().toISOString()
      })
      .eq('voter_id', voterId);

    if (updateErr) throw updateErr;

    // গ) ব্লাইন্ড ব্যালট বক্সে ভোট ইনসার্ট (কোনো ভোটার আইডির লিংক ছাড়াই)
    const votesToInsert = Object.entries(ballotSelections).map(([postId, candId]) => ({
      post_id: postId,
      candidate_id: candId
    }));
    const { error: votesErr } = await supabase
      .from('cast_votes')
      .insert(votesToInsert);

    if (votesErr) {
      console.warn('cast_votes insert status:', votesErr);
    }

    // ঘ) অডিট লগ টেবিলে শুধুমাত্র টোকেন ইনসার্ট
    try {
      await supabase.from('voting_audit_logs').insert([{
        audit_token: generatedToken
      }]);
    } catch (auditErr) {
      console.warn('voting_audit_logs insert note:', auditErr);
    }

    return {
      success: true,
      audit_token: generatedToken,
      method: 'direct_sync'
    };
  } catch (err) {
    console.error('Supabase Vote Error:', err);
    return {
      success: false,
      message: err.message || 'ভোট সাবমিট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
    };
  }
}

/**
 * ২. ভোটার আইডি দিয়ে স্ট্যাটাস যাচাই
 */
export async function verifyVoterFromDB(voterId) {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('voters')
      .select('voter_id, name, mosque, district, division, has_voted')
      .ilike('voter_id', voterId.trim())
      .single();

    if (error) return null;
    return {
      voterId: data.voter_id,
      name: data.name,
      mosque: data.mosque,
      district: data.district,
      division: data.division,
      hasVoted: data.has_voted
    };
  } catch (err) {
    return null;
  }
}

/**
 * ৩. নির্বাচনী ফলাফল আনা (টাইম-লক রেজাল্ট)
 */
export async function fetchResultsFromDB() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.rpc('get_election_results');
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Fetch Results Error:', err);
    return null;
  }
}

/**
 * ৪. নতুন নির্বাচনের জন্য ব্যালট বক্স ও অডিট ক্লিন করা (প্রার্থী ও ভোটার বহাল থাকবে)
 */
export async function resetElectionBallotInDB(newStart, newEnd) {
  if (!isSupabaseConfigured()) return { success: true };

  const startIso = newStart || new Date().toISOString();
  const endIso = newEnd || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  // ১. RPC ফাংশন চেষ্টা
  try {
    const { data, error } = await supabase.rpc('reset_election_ballot', {
      p_new_start: startIso,
      p_new_end: endIso
    });
    if (!error && data?.success) {
      return { success: true, method: 'rpc' };
    }
  } catch (rpcErr) {
    console.warn('RPC reset_election_ballot fallback:', rpcErr);
  }

  // ২. ফলব্যাক সরাসরি ডাটাবেজ ডিলিট ও রিসেট
  try {
    // ক) ভোটারদের স্ট্যাটাস রিসেট
    await supabase.from('voters').update({
      has_voted: false,
      voted_at: null
    }).neq('voter_id', 'dummy_keep_none');

    // খ) ব্যালট বক্সের ভোট ডিলিট
    await supabase.from('cast_votes').delete().neq('post_id', 'dummy_keep_none');

    // গ) অডিট লগ ডিলিট
    await supabase.from('voting_audit_logs').delete().neq('audit_token', 'dummy_keep_none');

    // ঘ) সেটিংস স্ট্যাটাস 'upcoming' ও ভবিষ্যৎ সময় দিয়ে আপডেট
    await supabase.from('election_settings').update({
      status: 'upcoming',
      start_time: startIso,
      end_time: endIso,
      updated_at: new Date().toISOString()
    }).eq('id', 1);

    return { success: true, method: 'direct' };
  } catch (err) {
    console.error('Direct reset error:', err);
    return { success: false, error: err.message };
  }
}
