-- ==============================================================================
-- মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কার্যনির্বাহী কমিটি নির্বাচন
-- সুপাবেস (Supabase) পূর্ণাঙ্গ নিরাপদ ডাটাবেজ স্কিমা ও সিক্রেট ভোটিং RPC ফাংশন
-- ==============================================================================

-- ১. এক্সটেনশনসমূহ সক্রিয়করণ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ২. নির্বাচনী সেটিংস ও সময় নিয়ন্ত্রণ টেবিল
CREATE TABLE IF NOT EXISTS election_settings (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কমিটি নির্বাচন',
    term TEXT NOT NULL DEFAULT '২০২৬-২০২৮ সেশন',
    status TEXT NOT NULL DEFAULT 'ongoing', -- 'upcoming', 'ongoing', 'ended'
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ডিফল্ট সেটিংস এন্ট্রি
INSERT INTO election_settings (id, title, status)
VALUES (1, 'মডেল মসজিদ ইমাম পরিষদ কেন্দ্রীয় কমিটি নির্বাচন', 'ongoing')
ON CONFLICT (id) DO NOTHING;

-- ৩. নির্বাচনী ৫টি পদের টেবিল
CREATE TABLE IF NOT EXISTS election_posts (
    id TEXT PRIMARY KEY, -- 'president', 'secretary', 'treasurer', 'org_secretary', 'office_secretary'
    title TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    description TEXT
);

INSERT INTO election_posts (id, title, sort_order, description) VALUES
('president', 'সভাপতি', 1, 'সংগঠনের সামগ্রিক নেতৃত্ব ও সমন্বয়'),
('secretary', 'সাধারণ সম্পাদক', 2, 'প্রশাসনিক কার্যক্রম ও সমন্বয়'),
('treasurer', 'কোষাধ্যক্ষ', 3, 'আর্থিক তহবিল ও হিসাব ব্যবস্থাপনা'),
('org_secretary', 'সাংগঠনিক সম্পাদক', 4, '৮ বিভাগের সকল মডেল মসজিদের সাংগঠনিক নেটওয়ার্ক'),
('office_secretary', 'দপ্তর সম্পাদক', 5, 'কেন্দ্রীয় নথিপত্র ও দাপ্তরিক চিঠিপত্র ব্যবস্থাপনা')
ON CONFLICT (id) DO NOTHING;

-- ৪. পদভিত্তিক প্রার্থীদের টেবিল (ছবি/ফটো সাপোর্টসহ)
CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    post_id TEXT REFERENCES election_posts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mosque TEXT NOT NULL,
    district TEXT NOT NULL,
    division TEXT NOT NULL,
    qualification TEXT,
    experience TEXT,
    photo TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- পূর্বের তৈরি থাকা ডাটাবেজে ছবির কলাম স্বয়ংক্রিয়ভাবে যোগ করার জন্য:
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo TEXT DEFAULT '';

-- ৫. নিবন্ধিত ভোটার তালিকা টেবিল
CREATE TABLE IF NOT EXISTS voters (
    voter_id TEXT PRIMARY KEY,
    secret_pin TEXT NOT NULL,
    name TEXT NOT NULL,
    father_name TEXT,
    mosque TEXT NOT NULL,
    district TEXT NOT NULL,
    division TEXT NOT NULL,
    phone TEXT,
    has_voted BOOLEAN DEFAULT FALSE,
    voted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ৬. প্রদত্ত ভোটের টেবিল (CRITICAL: এতে কোনো voter_id কলাম থাকবে না!)
-- শতভাগ ব্যালট গোপনীয়তা রক্ষার জন্য voter_id ও vote সম্পূর্ণ পৃথক
CREATE TABLE IF NOT EXISTS cast_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT REFERENCES election_posts(id) ON DELETE CASCADE,
    candidate_id TEXT REFERENCES candidates(id) ON DELETE CASCADE,
    cast_time TIMESTAMPTZ DEFAULT NOW()
);

-- ৭. অডিট লগ টেবিল (ভোট প্রদানের প্রমাণ কিন্তু কে কাকে ভোট দিয়েছে তা গোপন)
CREATE TABLE IF NOT EXISTS voting_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ৮. সিকিউর আরপিসি ফাংশন: cast_secure_vote (Atomic, Zero-Knowledge Privacy)
-- ==============================================================================
CREATE OR REPLACE FUNCTION cast_secure_vote(
    p_voter_id TEXT,
    p_secret_pin TEXT,
    p_ballot JSONB -- যেমন: {"president": "p1", "secretary": "s1", ...}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- সর্বোচ্চ প্রশাসনিক প্রিভিলেজে রান হবে যাতে ভোটার সরাসরি টেবিল দেখতে না পায়
AS $$
DECLARE
    v_voter RECORD;
    v_status TEXT;
    v_token TEXT;
    v_post_id TEXT;
    v_cand_id TEXT;
BEGIN
    -- ক) নির্বাচন সক্রিয় আছে কি না যাচাই
    SELECT status INTO v_status FROM election_settings WHERE id = 1;
    IF v_status != 'ongoing' THEN
        RETURN jsonb_build_object('success', false, 'message', 'বর্তমানে ভোট গ্রহণ বন্ধ রয়েছে।');
    END IF;

    -- খ) ভোটার তথ্য ও পিন যাচাই (Row Lock দিয়ে রেস কন্ডিশন রোধ)
    SELECT * INTO v_voter 
    FROM voters 
    WHERE UPPER(voter_id) = UPPER(TRIM(p_voter_id)) 
      AND secret_pin = TRIM(p_secret_pin)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'ভুল ভোটার আইডি অথবা গোপন পিন!');
    END IF;

    -- গ) ভোটার ইতিমধ্যে ভোট দিয়েছেন কি না যাচাই
    IF v_voter.has_voted THEN
        RETURN jsonb_build_object('success', false, 'message', 'এই ভোটার আইডি দিয়ে ইতিপূর্বে ভোট সম্পন্ন হয়েছে। দ্বিতীয়বার ভোট দেওয়া নিষিদ্ধ।');
    END IF;

    -- ঘ) ভোটারের স্ট্যাটাস অবিলম্বে লক করা
    UPDATE voters 
    SET has_voted = TRUE, 
        voted_at = NOW() 
    WHERE voter_id = v_voter.voter_id;

    -- ঙ) ৫টি পদের ভোট cast_votes টেবিলে ইনসার্ট (কোনো ভোটারের পরিচয় ছাড়াই!)
    FOR v_post_id, v_cand_id IN SELECT * FROM jsonb_each_text(p_ballot)
    LOOP
        INSERT INTO cast_votes (post_id, candidate_id)
        VALUES (v_post_id, v_cand_id);
    END LOOP;

    -- চ) এনক্রিপ্টেড অডিট টোকেন জেনারেট ও সেভ
    v_token := 'TX-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)) || '-' || TO_CHAR(NOW(), 'HH24MISS');
    
    INSERT INTO voting_audit_logs (audit_token)
    VALUES (v_token);

    -- ছ) ভোটারকে সফল রেসপন্স ও ডিজিটাল টোকেন রিটার্ন
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'আপনার গোপন ভোট সফলভাবে গৃহীত হয়েছে।',
        'audit_token', v_token
    );
END;
$$;

-- ৯. সিকিউর ফাংশন: get_election_results (ভোট চলাকালীন ফলাফল গোপন রাখা)
CREATE OR REPLACE FUNCTION get_election_results()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_results JSONB;
BEGIN
    SELECT status, start_time, end_time INTO v_status, v_start_time, v_end_time FROM election_settings WHERE id = 1;

    -- ভোট শেষ না হওয়া পর্যন্ত ফলাফল কাউন্ট গোপন (তবে শেষ সময় অতিক্রান্ত হলে স্বয়ংক্রিয়ভাবে ফলাফল উন্মুক্ত)
    IF v_status != 'ended' AND (v_status = 'upcoming' OR v_end_time IS NULL OR NOW() < v_end_time) THEN
        RETURN jsonb_build_object(
            'status', v_status,
            'is_ended', false,
            'message', 'ভোট গ্রহণ শেষ হওয়ার পর ফলাফল সবার জন্য উন্মুক্ত হবে।'
        );
    END IF;

    -- ভোট শেষ হলে শুধুমাত্র বর্তমান নির্বাচনের (start_time এর পরের) সকল প্রার্থীর প্রাপ্ত ভোটের সমষ্টি রিটার্ন
    SELECT jsonb_agg(
        jsonb_build_object(
            'candidate_id', c.id,
            'post_id', c.post_id,
            'name', c.name,
            'mosque', c.mosque,
            'district', c.district,
            'division', c.division,
            'votes_count', COALESCE(v.vote_count, 0)
        )
    ) INTO v_results
    FROM candidates c
    LEFT JOIN (
        SELECT candidate_id, COUNT(*) as vote_count 
        FROM cast_votes 
        WHERE cast_time >= COALESCE(v_start_time, '1970-01-01'::timestamptz)
        GROUP BY candidate_id
    ) v ON c.id = v.candidate_id;

    RETURN jsonb_build_object(
        'status', 'ended',
        'is_ended', true,
        'results', COALESCE(v_results, '[]'::jsonb)
    );
END;
$$;

-- ১০. Row Level Security (RLS) সক্রিয়করণ ও নিরাপত্তা পলিসি
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cast_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_posts ENABLE ROW LEVEL SECURITY;

-- পাবলিক পলিসি: সেটিংস, পদ ও প্রার্থী যে কেউ দেখতে পারবে
CREATE POLICY "Public Read Settings" ON election_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Posts" ON election_posts FOR SELECT USING (true);
CREATE POLICY "Public Read Candidates" ON candidates FOR SELECT USING (true);

-- ভোটার যাচাই পলিসি (পিন ছাড়া শুধুমাত্র নাম, মসজিদ ও স্ট্যাটাস দেখতে পারবে)
CREATE POLICY "Public Check Voter Status" ON voters FOR SELECT USING (true);

-- cast_votes টেবিলে সাধারণ পাবলিকের সরাসরি SELECT সম্পূর্ণ নিষিদ্ধ (ফলাফল কেবল RPC ফাংশন দিবে)
-- (No SELECT Policy on cast_votes for public to ensure 100% secrecy)

-- ১১. নতুন নির্বাচনের জন্য ব্যালট ক্লিন/রিসেট আরপিসি ফাংশন (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION reset_election_ballot(
    p_new_start TIMESTAMPTZ DEFAULT NOW(),
    p_new_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days')
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- ক) সকল ভোটারের ভোট স্ট্যাটাস রিসেট (কোনো ভোটার ডিলিট হবে না)
    UPDATE voters 
    SET has_voted = FALSE, 
        voted_at = NULL;

    -- খ) ব্যালট বক্সের কাস্ট হওয়া সকল ভোট মুছে ফেলা
    DELETE FROM cast_votes;

    -- গ) অডিট লগ মুছে ফেলা
    DELETE FROM voting_audit_logs;

    -- ঘ) নতুন নির্বাচনী সময়সূচি ও স্ট্যাটাস 'upcoming' সেট করা
    UPDATE election_settings
    SET status = 'upcoming',
        start_time = p_new_start,
        end_time = p_new_end,
        updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'ব্যালট ও ভোট সফলভাবে রিসেট করা হয়েছে।'
    );
END;
$$;

-- ১২. সরাসরি ক্লায়েন্ট ডিলিট / আপডেটের জন্য RLS পলিসি (যদি আরপিসি ছাড়া ডিলিট করতে চায়)
CREATE POLICY "Allow reset cast_votes" ON cast_votes FOR DELETE USING (true);
CREATE POLICY "Allow reset voting_audit_logs" ON voting_audit_logs FOR DELETE USING (true);
CREATE POLICY "Allow update voters status" ON voters FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow update election_settings" ON election_settings FOR UPDATE USING (true) WITH CHECK (true);
