-- ==============================================================================
-- মডেল মসজিদ ইমাম পরিষদ নির্বাচন ২০২৬
-- সুপাবেস (Supabase) এ ভোটার ও প্রার্থী ডাটাবেজ পারমিশন ও RLS পলিসি
-- ==============================================================================
-- ব্যবহার নির্দেশিকা:
-- ১. আপনার Supabase Dashboard (https://supabase.com/dashboard)-এ যান
-- ২. আপনার প্রজেক্টটি ওপেন করুন
-- ৩. বাম পাশের মেনু থেকে "SQL Editor"-এ যান
-- ৪. নিচের সম্পূর্ণ স্ক্রিপ্টটি পেস্ট করে "Run" বাটনে ক্লিক করুন
-- ==============================================================================

-- ১. voters টেবিলের Row Level Security (RLS) সক্রিয়করণ ও সকল কার্যক্রমের অনুমতি
ALTER TABLE IF EXISTS voters ENABLE ROW LEVEL SECURITY;

-- ভোটার তালিকা পড়ার অনুমতি (SELECT)
DROP POLICY IF EXISTS "Allow Read Voters" ON voters;
DROP POLICY IF EXISTS "Allow Select Voters" ON voters;
DROP POLICY IF EXISTS "Public Check Voter Status" ON voters;
CREATE POLICY "Allow Select Voters" ON voters FOR SELECT USING (true);

-- এডমিন থেকে নতুন ভোটার ইনসার্ট বা CSV আপলোডের অনুমতি (INSERT)
DROP POLICY IF EXISTS "Allow Insert Voters" ON voters;
CREATE POLICY "Allow Insert Voters" ON voters FOR INSERT WITH CHECK (true);

-- ভোটার তথ্য আপডেট ও ভোটদানের স্ট্যাটাস পরিবর্তনের অনুমতি (UPDATE)
DROP POLICY IF EXISTS "Allow Update Voters" ON voters;
DROP POLICY IF EXISTS "Allow Update Voters Status" ON voters;
CREATE POLICY "Allow Update Voters" ON voters FOR UPDATE USING (true);

-- ভোটার মুছে ফেলা বা তালিকা রিসেটের অনুমতি (DELETE)
DROP POLICY IF EXISTS "Allow Delete Voters" ON voters;
CREATE POLICY "Allow Delete Voters" ON voters FOR DELETE USING (true);


-- ২. candidates টেবিলের Row Level Security (RLS) পলিসি
ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Select Candidates" ON candidates;
DROP POLICY IF EXISTS "Public Read Candidates" ON candidates;
CREATE POLICY "Allow Select Candidates" ON candidates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Insert Candidates" ON candidates;
CREATE POLICY "Allow Insert Candidates" ON candidates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Update Candidates" ON candidates;
CREATE POLICY "Allow Update Candidates" ON candidates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow Delete Candidates" ON candidates;
CREATE POLICY "Allow Delete Candidates" ON candidates FOR DELETE USING (true);


-- ৩. election_settings টেবিলের পলিসি
ALTER TABLE IF EXISTS election_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Select Settings" ON election_settings;
DROP POLICY IF EXISTS "Public Read Settings" ON election_settings;
CREATE POLICY "Allow Select Settings" ON election_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Update Settings" ON election_settings;
CREATE POLICY "Allow Update Settings" ON election_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow Insert Settings" ON election_settings;
CREATE POLICY "Allow Insert Settings" ON election_settings FOR INSERT WITH CHECK (true);

-- ৪. get_election_results RPC ফাংশন আপডেট (স্ট্যাটাস 'ended' অথবা সময় অতিক্রান্ত হলে ফলাফল উন্মুক্ত)
CREATE OR REPLACE FUNCTION get_election_results()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_end_time TIMESTAMPTZ;
    v_results JSONB;
BEGIN
    SELECT status, end_time INTO v_status, v_end_time FROM election_settings WHERE id = 1;

    -- ভোট শেষ না হওয়া পর্যন্ত ফলাফল কাউন্ট গোপন (তবে শেষ সময় অতিক্রান্ত হলে স্বয়ংক্রিয়ভাবে ফলাফল উন্মুক্ত)
    IF v_status != 'ended' AND (v_end_time IS NULL OR NOW() < v_end_time) THEN
        RETURN jsonb_build_object(
            'status', v_status,
            'is_ended', false,
            'message', 'ভোট গ্রহণ শেষ হওয়ার পর ফলাফল সবার জন্য উন্মুক্ত হবে।'
        );
    END IF;

    -- ভোট শেষ হলে সকল প্রার্থীর প্রাপ্ত ভোটের সমষ্টি রিটার্ন
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
        GROUP BY candidate_id
    ) v ON c.id = v.candidate_id;

    RETURN jsonb_build_object(
        'status', 'ended',
        'is_ended', true,
        'results', COALESCE(v_results, '[]'::jsonb)
    );
END;
$$;
