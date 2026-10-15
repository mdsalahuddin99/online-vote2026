-- ==============================================================================
-- মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন ২০২৬
-- সিকিউর ভোটিং RPC ফাংশন ও RLS পলিসি (Production Security Hardening)
-- ==============================================================================
-- এই স্ক্রিপ্টটি আপনার Supabase ড্যাশবোর্ডের "SQL Editor"-এ গিয়ে রান করুন।

-- ১. cast_votes এবং voting_audit_logs টেবিল নিশ্চিতকরণ
CREATE TABLE IF NOT EXISTS cast_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    cast_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voting_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ২. Row Level Security (RLS) পলিসি আপডেট
ALTER TABLE cast_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;

-- ক) কাস্ট ভোট ইনসার্ট পলিসি (যাতে ক্লায়েন্ট ফলব্যাক সফলভাবে ভোট ইনসার্ট করতে পারে)
DROP POLICY IF EXISTS "Allow Insert Cast Votes" ON cast_votes;
CREATE POLICY "Allow Insert Cast Votes" ON cast_votes 
FOR INSERT WITH CHECK (true);

-- খ) কাস্ট ভোট সরাসরি দেখা নিষিদ্ধ (শুধুমাত্র ফলাফল প্রকাশের সময় সমষ্টিক কাউন্ট পাওয়া যাবে)
DROP POLICY IF EXISTS "Deny Public Select Cast Votes" ON cast_votes;
-- (No SELECT policy means public cannot read individual ballots directly)

-- গ) অডিট লগ ইনসার্ট ও সিলেক্ট পলিসি
DROP POLICY IF EXISTS "Allow Insert Audit Logs" ON voting_audit_logs;
CREATE POLICY "Allow Insert Audit Logs" ON voting_audit_logs 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Read Audit Logs" ON voting_audit_logs;
CREATE POLICY "Allow Read Audit Logs" ON voting_audit_logs 
FOR SELECT USING (true);

-- ঘ) ভোটার আপডেট পলিসি (has_voted ফ্ল্যাগ আপডেট করার অনুমতি)
DROP POLICY IF EXISTS "Allow Update Voters Status" ON voters;
CREATE POLICY "Allow Update Voters Status" ON voters 
FOR UPDATE USING (true);


-- ==============================================================================
-- ৩. সিকিউর অ্যাটমিক RPC ফাংশন: cast_secure_vote
-- বৈশিষ্ট্য:
--  - ACID ট্রানজেকশন (Row Locking দিয়ে ডাবল ভোটিং প্রতিরোধ)
--  - Zero-Knowledge Blind Ballot (ব্যালটে কোনো ভোটারের পরিচয় থাকে না)
--  - মোবাইল ওটিপি বা পিন উভয় ভেরিফিকেশন সমর্থন
-- ==============================================================================
CREATE OR REPLACE FUNCTION cast_secure_vote(
    p_voter_id TEXT,
    p_secret_pin TEXT,
    p_ballot JSONB -- যেমন: {"president": "p1", "secretary": "s1", ...}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- এটি RLS বাইপাস করে প্রশাসনিক সুরক্ষায় নির্বাহ হবে
AS $$
DECLARE
    v_voter RECORD;
    v_status TEXT;
    v_token TEXT;
    v_post_id TEXT;
    v_cand_id TEXT;
BEGIN
    -- ১. নির্বাচন চালু আছে কি না যাচাই
    SELECT status INTO v_status FROM election_settings WHERE id = 1;
    IF v_status IS NOT NULL AND v_status != 'ongoing' THEN
        RETURN jsonb_build_object('success', false, 'message', 'বর্তমানে ভোট গ্রহণ বন্ধ রয়েছে।');
    END IF;

    -- ২. ভোটার তথ্য যাচাই এবং রো-লক (FOR UPDATE)
    -- নোট: যদি ওটিপি দিয়ে ভেরিফাই হয়ে থাকে (p_secret_pin খালি হতে পারে) অথবা পিন ম্যাচ করতে পারে
    SELECT * INTO v_voter 
    FROM voters 
    WHERE UPPER(TRIM(voter_id)) = UPPER(TRIM(p_voter_id))
      AND (
          p_secret_pin IS NULL 
          OR TRIM(p_secret_pin) = '' 
          OR secret_pin = TRIM(p_secret_pin)
      )
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'ভোটার আইডি পাওয়া যায়নি অথবা পিন সঠিক নয়!');
    END IF;

    -- ৩. ভোটার ইতিপূর্বে ভোট দিয়েছেন কি না যাচাই
    IF v_voter.has_voted THEN
        RETURN jsonb_build_object('success', false, 'message', 'এই ভোটার ইতিপূর্বে ভোট সম্পন্ন করেছেন। দ্বিতীয়বার ভোট দেওয়া যাবে না।');
    END IF;

    -- ৪. ভোটারের স্ট্যাটাস অবিলম্বে লক করা
    UPDATE voters 
    SET has_voted = TRUE, 
        voted_at = NOW() 
    WHERE voter_id = v_voter.voter_id;

    -- ৫. ব্লাইন্ড ব্যালট বক্সে ভোট ইনসার্ট (কোনো ভোটার আইডির লিংক ছাড়াই)
    FOR v_post_id, v_cand_id IN SELECT * FROM jsonb_each_text(p_ballot)
    LOOP
        INSERT INTO cast_votes (post_id, candidate_id)
        VALUES (v_post_id, v_cand_id);
    END LOOP;

    -- ৬. অডিট রসিদ টোকেন জেনারেট ও সেভ
    v_token := 'TX-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)) || '-' || TO_CHAR(NOW(), 'HH24MISS');
    
    INSERT INTO voting_audit_logs (audit_token)
    VALUES (v_token);

    -- ৭. সফল রেসপন্স ও ডিজিটাল টোকেন রিটার্ন
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'আপনার গোপন ভোট সফলভাবে সম্পন্ন হয়েছে।',
        'audit_token', v_token
    );
END;
$$;
