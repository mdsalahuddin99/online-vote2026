/**
 * BulkSMSBD Live SMS Gateway Service
 * Dedicated to 100% Live SMS delivery via BulkSMSBD (http://bulksmsbd.net/)
 */

const SMS_CONFIG_STORAGE_KEY = 'mm_sms_gateway_config';

export const DEFAULT_SMS_CONFIG = {
  provider: import.meta.env.VITE_SMS_PROVIDER || 'bulksmsbd', // ডিফল্ট হিসেবে bulksmsbd
  senderId: import.meta.env.VITE_BULKSMSBD_SENDER_ID || import.meta.env.VITE_SMS_SENDER_ID || '8809617643365',
  apiKey: import.meta.env.VITE_BULKSMSBD_API_KEY || import.meta.env.VITE_SMS_API_KEY || 'cRuK5lRpRz7ycHEeJTB4',
  brandName: import.meta.env.VITE_SMS_BRAND_NAME || 'Model Mosque',
  apiSecret: '',
  apiUrl: '', // For custom provider
  isEnabled: true // ডিফল্ট সক্রিয়
};

// BulkSMSBD অফিসিয়াল রেসপন্স কোড ও ব্যাখ্যা
export const BULKSMSBD_ERROR_MAP = {
  202: 'SMS Submitted Successfully (সফলভাবে প্রেরণ সম্পন্ন)',
  1001: 'Invalid Number (নম্বরটি সঠিক নয়)',
  1002: 'Sender ID not correct or Sender ID is disabled (Sender ID সঠিক নয় বা নিষ্ক্রিয়)',
  1003: 'Please require all fields (প্রয়োজনীয় ফিল্ড খালি রয়েছে)',
  1005: 'Internal Error (গেটওয়ে অভ্যন্তরীণ সমস্যা)',
  1006: 'Balance Validity Not Available (ব্যালেন্সের মেয়াদ উত্তীর্ণ)',
  1007: 'Balance Insufficient (একাউন্টে পর্যাপ্ত এসএমএস ব্যালেন্স নেই)',
  1011: 'User ID not found (ইউজার আইডি পাওয়া যায়নি)',
  1012: 'Masking SMS must be sent in Bengali (মাস্কিং এসএমএস বাংলায় পাঠাতে হবে)',
  1013: 'Sender ID has not found Gateway by API key (এই API Key দিয়ে Sender ID পাওয়া যায়নি)',
  1014: 'Sender Type Name not found using this sender by API key',
  1015: 'Sender ID has not found any valid gateway by API key',
  1016: 'Sender Type Name Active Price Info not found by this sender ID',
  1017: 'Sender Type Name Price Info not found by this sender ID',
  1018: 'The owner of this username account is disabled (একাউন্ট নিষ্ক্রিয়)',
  1019: 'The price configuration for this sender type/account is disabled',
  1020: 'The parent of this account is not found',
  1021: 'The parent active price for this sender type is not found',
  1032: 'IP Whitelist Error (১০৩২): আপনার সার্ভার বা ইন্টারনেট আইপি অনুমোদিত নয়। bulksmsbd.net ড্যাশবোর্ডে গিয়ে Source IP Checking অপশনটি বন্ধ (Disable) করুন অথবা Phonebook -> IP White List মেনুতে আইপি যুক্ত করুন।'
};

// Format OTP message according to operator/BulkSMSBD approved template: "Your {Brand/Company Name} OTP is XXXX"
export const formatOtpMessage = (otp, brand) => {
  const brandName = (brand || getSMSConfig().brandName || 'Model Mosque').trim();
  return `Your ${brandName} OTP is ${otp}`;
};

/**
 * ফোন নম্বর ফরম্যাট হেল্পার (৮৮০১XXXXXXXXX স্ট্যান্ডার্ডে রূপান্তর)
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const clean = phone.toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('8801') && clean.length === 13) return clean;
  if (clean.startsWith('01') && clean.length === 11) return '88' + clean;
  if (clean.length === 11 && clean.startsWith('1')) return '880' + clean;
  return clean;
};

/**
 * কমা বা নতুন লাইনে থাকা একাধিক ফোন নম্বরের তালিকা প্রক্রিয়াকরণ (One-to-Many এর জন্য)
 */
export const formatPhoneList = (input) => {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === 'string') {
    list = input.split(/[,;\n\r\s]+/);
  }
  return list
    .map(p => formatPhoneNumber(p))
    .filter(p => p.length >= 11);
};

// Retrieve SMS Configuration from localStorage with .env fallback
export const getSMSConfig = () => {
  try {
    const saved = localStorage.getItem(SMS_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...DEFAULT_SMS_CONFIG, 
        ...parsed,
        // যদি লোকালস্টোরেজে মান খালি থাকে তবে .env থেকে ডিফল্ট নিবে
        apiKey: parsed.apiKey || DEFAULT_SMS_CONFIG.apiKey,
        senderId: parsed.senderId || DEFAULT_SMS_CONFIG.senderId,
        brandName: parsed.brandName || DEFAULT_SMS_CONFIG.brandName
      };
    }
  } catch (e) {
    console.error('Failed to load SMS config:', e);
  }
  return DEFAULT_SMS_CONFIG;
};

// Save SMS Configuration to localStorage
export const saveSMSConfig = (config) => {
  try {
    localStorage.setItem(SMS_CONFIG_STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save SMS config:', e);
    return false;
  }
};

// Reset SMS Configuration to project defaults
export const resetSMSConfigToDefault = () => {
  try {
    localStorage.setItem(SMS_CONFIG_STORAGE_KEY, JSON.stringify(DEFAULT_SMS_CONFIG));
    return DEFAULT_SMS_CONFIG;
  } catch (e) {
    console.error('Failed to reset SMS config:', e);
    return DEFAULT_SMS_CONFIG;
  }
};

/**
 * BulkSMSBD ব্যালেন্স চেক ফাংশন
 * @param {string} apiKey - BulkSMSBD API Key
 * @returns {Promise<{success: boolean, balance?: string|number, error?: string, raw?: any}>}
 */
export const checkBulkSMSBDBalance = async (apiKey) => {
  const key = (apiKey || getSMSConfig().apiKey || '').trim();
  if (!key) {
    return { success: false, error: 'দয়া করে আপনার BulkSMSBD API Key প্রদান করুন।' };
  }

  const directHttpUrl = `http://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(key)}`;
  const directHttpsUrl = `https://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(key)}`;
  const proxyUrl = `/bulksmsbd-proxy/api/getBalanceApi?api_key=${encodeURIComponent(key)}`;

  const isLocalDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.port === '5173'
  );

  // লোকাল ও ভার্সেল (Vercel) উভয় পরিবেশেই /bulksmsbd-proxy নিরাপদ (CORS ও Mixed Content মুক্ত)
  const urlsToTry = [proxyUrl, directHttpsUrl, directHttpUrl];

  let lastError = null;
  let parsedData = null;

  for (const targetUrl of urlsToTry) {
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) continue;
      const text = await res.text();
      try {
        parsedData = JSON.parse(text);
        if (parsedData) break;
      } catch (e) {
        // যদি টেক্সট ফরম্যাটে সংখ্যা ফেরত আসে
        const num = parseFloat(text.trim());
        if (!isNaN(num)) {
          return { success: true, balance: text.trim(), raw: text };
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (parsedData) {
    if (parsedData.response_code === 202 || parsedData.balance !== undefined || parsedData.balance_sms !== undefined) {
      return {
        success: true,
        balance: parsedData.balance ?? parsedData.balance_sms ?? '0.00',
        raw: parsedData
      };
    } else {
      const code = parsedData.response_code;
      let errMsg = parsedData.error_message || BULKSMSBD_ERROR_MAP[code] || `ত্রুটি কোড: ${code}`;
      if (code === 1032 || (parsedData.error_message && parsedData.error_message.toLowerCase().includes('whitelisted'))) {
        const match = parsedData.error_message ? parsedData.error_message.match(/ip\s+([0-9.]+)/i) : null;
        const serverIp = match ? match[1] : '';
        errMsg = `IP Whitelist Error (১০৩২): ${serverIp ? `আপনার সার্ভার আইপি (${serverIp})` : 'আপনার আইপি'} BulkSMSBD-তে অনুমোদিত নয়। ড্যাশবোর্ডে গিয়ে 'Source IP Checking' বন্ধ (Disable) করুন।`;
      }
      return {
        success: false,
        error: errMsg,
        raw: parsedData
      };
    }
  }

  return {
    success: false,
    error: `ব্যালেন্স জানতে সমস্যা হয়েছে: ${lastError ? lastError.message : 'সার্ভার রেসপন্স দেয়নি'}`
  };
};

/**
 * Send SMS OTP or Single/One-to-Many Notice (100% Live BulkSMSBD)
 * @param {string|string[]} phone - Recipient phone number or comma separated numbers or array
 * @param {string} message - Message text (e.g. Your Model Mosque OTP is 1234)
 * @returns {Promise<{success: boolean, message: string, simulated?: boolean, serverIp?: string, rawError?: string, data?: any}>}
 */
export const sendSMS = async (phone, message) => {
  const config = getSMSConfig();

  // যদি অ্যাডমিন প্যানেল থেকে লাইভ এসএমএস বন্ধ রাখা হয়, তবে সিমুলেশন মোডে অন-স্ক্রিন ওটিপি সরবরাহ হবে
  if (config.isEnabled === false) {
    return {
      success: true,
      simulated: true,
      message: 'টেস্টিং মোড: লাইভ এসএমএস বন্ধ থাকায় অন-স্ক্রিন ওটিপি কোড তৈরি হয়েছে।'
    };
  }

  // Normalize phone number(s)
  const phoneList = formatPhoneList(phone);
  const formattedPhone = phoneList.join(',');

  if (!formattedPhone) {
    return {
      success: false,
      message: 'অবৈধ মোবাইল নম্বর। সঠিক মোবাইল নম্বর দিন।'
    };
  }

  const apiKey = (config.apiKey || '').trim();
  const senderId = (config.senderId || '').trim();

  if (!apiKey) {
    return {
      success: false,
      message: 'BulkSMSBD API Key সেট করা নেই। অ্যাডমিন প্যানেল থেকে এপিআই কি প্রদান করুন।'
    };
  }

  try {
    const queryParams = new URLSearchParams({
      api_key: apiKey,
      type: 'text',
      number: formattedPhone,
      senderid: senderId,
      message: message
    }).toString();

    const directHttpUrl = `http://bulksmsbd.net/api/smsapi?${queryParams}`;
    const directHttpsUrl = `https://bulksmsbd.net/api/smsapi?${queryParams}`;
    const proxyUrl = `/bulksmsbd-proxy/api/smsapi?${queryParams}`;

    // লোকাল ও ভার্সেল (Vercel) উভয় পরিবেশেই /bulksmsbd-proxy নিরাপদ (CORS ও Mixed Content মুক্ত)
    const urlsToTry = [proxyUrl, directHttpsUrl, directHttpUrl];

    let resData = null;
    let lastErr = null;

    for (const targetUrl of urlsToTry) {
      try {
        const fetchPromise = fetch(targetUrl, { method: 'POST' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('সার্ভার থেকে রেসপন্স পেতে ৮ সেকেন্ডের বেশি সময় লেগেছে।')), 8000)
        );
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (response && response.ok) {
          resData = await response.json();
          if (resData) break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!resData) {
      return {
        success: false,
        message: `BulkSMSBD লাইভ গেটওয়েতে সংযোগ করা যায়নি: ${lastErr ? lastErr.message : 'সার্ভার রেসপন্স দেয়নি'}`,
        error: lastErr?.message
      };
    }

    // BulkSMSBD 202 = Success
    if (resData.response_code === 202 || (resData.success_message && resData.success_message.toLowerCase().includes('success'))) {
      return {
        success: true,
        message: 'BulkSMSBD এর মাধ্যমে লাইভ এসএমএস সফলভাবে পাঠানো হয়েছে।',
        data: resData
      };
    }

    // BulkSMSBD Error mapping
    const code = resData.response_code;
    let errorMsg = resData.error_message || BULKSMSBD_ERROR_MAP[code] || `BulkSMSBD ত্রুটি কোড: ${code}`;
    let serverIp = '';

    if (code === 1032 || (resData.error_message && resData.error_message.toLowerCase().includes('whitelisted'))) {
      const match = resData.error_message ? resData.error_message.match(/ip\s+([0-9.]+)/i) : null;
      serverIp = match ? match[1] : '';
      errorMsg = `IP Whitelist Error (১০৩২): ${serverIp ? `আপনার সার্ভার আইপি (${serverIp})` : 'আপনার আইপি'} BulkSMSBD পোর্টালে অনুমোদিত নয়। লাইভ Vercel সার্ভারের জন্য bulksmsbd.net পোর্টালে গিয়ে 'Source IP Checking' নিষ্ক্রিয় (Disable) করুন অথবা Phonebook -> IP White List মেনুতে এই আইপি যুক্ত করুন।`;
    }

    console.error('BulkSMSBD Live API Error:', resData);
    return {
      success: false,
      message: errorMsg,
      serverIp: serverIp,
      rawError: resData.error_message,
      data: resData
    };
  } catch (error) {
    console.error('BulkSMSBD Live Call Error:', error);
    return {
      success: false,
      message: `এসএমএস গেটওয়ে সমস্যা: ${error.message}`
    };
  }
};

/**
 * BulkSMSBD Many-to-Many SMS প্রেরক ফাংশন (100% Live)
 * @param {Array<{to: string, message: string}>} messages - বিভিন্ন নম্বরে ভিন্ন ভিন্ন মেসেজের তালিকা
 * @returns {Promise<{success: boolean, message: string, serverIp?: string, data?: any}>}
 */
export const sendManySMS = async (messages) => {
  const config = getSMSConfig();

  if (config.isEnabled === false) {
    return {
      success: true,
      simulated: true,
      message: 'টেস্টিং মোড: লাইভ এসএমএস প্রেরণ বন্ধ রয়েছে।'
    };
  }

  const apiKey = (config.apiKey || '').trim();
  const senderId = (config.senderId || '').trim();

  if (!apiKey) {
    return {
      success: false,
      message: 'BulkSMSBD API Key সেট করা নেই।'
    };
  }

  try {
    const formattedMessages = messages.map(item => ({
      to: formatPhoneNumber(item.to),
      message: item.message
    }));

    const directHttpUrl = 'http://bulksmsbd.net/api/smsapimany';
    const directHttpsUrl = 'https://bulksmsbd.net/api/smsapimany';
    const proxyUrl = '/bulksmsbd-proxy/api/smsapimany';

    const urlsToTry = [proxyUrl, directHttpsUrl, directHttpUrl];

    const payload = {
      api_key: apiKey,
      senderid: senderId,
      messages: formattedMessages
    };

    let resData = null;
    let lastErr = null;

    for (const targetUrl of urlsToTry) {
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          resData = await response.json();
          if (resData) break;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (resData && (resData.response_code === 202 || resData.success_message)) {
      return {
        success: true,
        message: 'BulkSMSBD এর মাধ্যমে সবগুলো লাইভ এসএমএস সফলভাবে প্রেরিত হয়েছে।',
        data: resData
      };
    }

    const code = resData ? resData.response_code : null;
    let errorMsg = resData?.error_message || BULKSMSBD_ERROR_MAP[code] || lastErr?.message || 'অনেক এসএমএস পাঠাতে সমস্যা হয়েছে।';
    let serverIp = '';

    if (code === 1032 || (resData?.error_message && resData.error_message.toLowerCase().includes('whitelisted'))) {
      const match = resData.error_message ? resData.error_message.match(/ip\s+([0-9.]+)/i) : null;
      serverIp = match ? match[1] : '';
      errorMsg = `IP Whitelist Error (১০৩২): ${serverIp ? `আপনার সার্ভার আইপি (${serverIp})` : 'আপনার আইপি'} BulkSMSBD পোর্টালে অনুমোদিত নয়। bulksmsbd.net পোর্টালে গিয়ে 'Source IP Checking' নিষ্ক্রিয় (Disable) করুন।`;
    }

    return {
      success: false,
      message: errorMsg,
      serverIp: serverIp,
      data: resData
    };
  } catch (error) {
    return {
      success: false,
      message: `Many-to-Many SMS লাইভ ত্রুটি: ${error.message}`
    };
  }
};
