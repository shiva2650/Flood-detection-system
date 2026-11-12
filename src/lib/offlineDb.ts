export type OfflineSosStatus = 'Saved Offline' | 'Waiting for Network' | 'Sent' | 'Failed';

export interface OfflineSosRecord {
  idempotencyKey: string;
  citizenUid?: string;
  citizenName: string;
  phone: string;
  lat: number;
  lon: number;
  region: string;
  category: string;
  peopleCount: number;
  severity: string;
  medicalNeeds: string;
  vulnerableGroups: string;
  waterDepthCm: number;
  description: string;
  mediaNote?: string;
  status: OfflineSosStatus;
  trackingId?: string;
  queuedAt: string;
  syncedAt?: string;
  errorMsg?: string;
}

const DB_NAME = 'alertnet_offline_db';
const DB_VERSION = 2;
const SOS_STORE = 'offline_sos';
const CACHE_STORE = 'emergency_cache';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SOS_STORE)) {
        const store = db.createObjectStore(SOS_STORE, { keyPath: 'idempotencyKey' });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineSosToIdb(record: OfflineSosRecord): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SOS_STORE, 'readwrite');
      tx.objectStore(SOS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage if IndexedDB is blocked in private iframe
    const existing = getFallbackSosList();
    const idx = existing.findIndex((item) => item.idempotencyKey === record.idempotencyKey);
    if (idx >= 0) existing[idx] = record;
    else existing.unshift(record);
    localStorage.setItem('alertnet_idb_fallback_sos', JSON.stringify(existing));
  }
}

export async function getAllOfflineSosFromIdb(): Promise<OfflineSosRecord[]> {
  try {
    const db = await openOfflineDb();
    const records = await new Promise<OfflineSosRecord[]>((resolve, reject) => {
      const tx = db.transaction(SOS_STORE, 'readonly');
      const req = tx.objectStore(SOS_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return records.sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime());
  } catch {
    return getFallbackSosList();
  }
}

export async function updateOfflineSosStatusInIdb(
  idempotencyKey: string,
  status: OfflineSosStatus,
  trackingId?: string,
  errorMsg?: string
): Promise<void> {
  const all = await getAllOfflineSosFromIdb();
  const found = all.find((r) => r.idempotencyKey === idempotencyKey);
  if (!found) return;
  const updated: OfflineSosRecord = {
    ...found,
    status,
    trackingId: trackingId || found.trackingId,
    syncedAt: status === 'Sent' ? new Date().toISOString() : found.syncedAt,
    errorMsg,
  };
  await saveOfflineSosToIdb(updated);
}

export async function clearSentOfflineSosFromIdb(): Promise<void> {
  try {
    const db = await openOfflineDb();
    const all = await getAllOfflineSosFromIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SOS_STORE, 'readwrite');
      const store = tx.objectStore(SOS_STORE);
      for (const item of all) {
        if (item.status === 'Sent') {
          store.delete(item.idempotencyKey);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const remaining = getFallbackSosList().filter((r) => r.status !== 'Sent');
    localStorage.setItem('alertnet_idb_fallback_sos', JSON.stringify(remaining));
  }
}

export async function cacheEmergencyDataToIdb(key: string, data: unknown): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ key, data, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    localStorage.setItem(`alertnet_cache_${key}`, JSON.stringify(data));
  }
}

export async function getCachedEmergencyDataFromIdb<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openOfflineDb();
    const res = await new Promise<{ key: string; data: T } | undefined>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res && res.data !== undefined) return res.data;
  } catch {
    const raw = localStorage.getItem(`alertnet_cache_${key}`);
    if (raw) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    }
  }
  return fallback;
}

function getFallbackSosList(): OfflineSosRecord[] {
  try {
    const raw = localStorage.getItem('alertnet_idb_fallback_sos');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const OFFLINE_SAFETY_GUIDELINES = {
  en: {
    title: 'Offline Emergency Flood Safety Protocol (Cached for Zero-Network Access)',
    helplines: [
      { label: 'National Emergency Response', number: '112' },
      { label: 'Ambulance & Medical Trauma', number: '108' },
      { label: 'State Disaster Control Room (NDRF/SDMA)', number: '1070 / 1077' },
    ],
    steps: [
      'Move immediately to the highest floor or elevated ground. Do not stay in basements or ground-floor rooms when water rises above 15 cm.',
      'Turn off the main electrical breaker and LPG gas cylinder valves before evacuating.',
      'Never walk, swim, or drive through moving floodwater—15 cm (6 inches) of fast-moving water can knock an adult down, and 60 cm can sweep a vehicle away.',
      'Keep emergency drinking water, essential prescription medicines (insulin, cardiac drugs), mobile power bank, and waterproofed ID documents in a grab bag.',
      'Notice: Offline SOS requests saved on this device are stored in IndexedDB and will automatically transmit as soon as cellular or Wi-Fi connectivity returns.',
    ],
  },
  te: {
    title: 'ఆఫ్‌లైన్ అత్యవసర వరద భద్రతా మార్గదర్శకాలు (నెట్‌వర్క్ లేని సమయం కోసం భద్రపరచబడింది)',
    helplines: [
      { label: 'జాతీయ అత్యవసర సహాయం', number: '112' },
      { label: 'అంబులెన్స్ & వైద్య సహాయం', number: '108' },
      { label: 'విపత్తు నిర్వహణ కంట్రోల్ రూమ్ (NDRF/SDMA)', number: '1070 / 1077' },
    ],
    steps: [
      'వెంటనే భవనం పై అంతస్తుకు లేదా ఎత్తైన సురక్షిత ప్రాంతానికి వెళ్లండి. నీటి మట్టం పెరుగుతున్నప్పుడు గ్రౌండ్ ఫ్లోర్‌లో ఉండకండి.',
      'ఇంటిని ఖాళీ చేసే ముందు మెయిన్ ఎలక్ట్రిక్ స్విచ్ మరియు గ్యాస్ సిలిండర్ వాల్వ్ ఆఫ్ చేయండి.',
      'ప్రవహించే వరద నీటిలో నడవకండి లేదా వాహనాలు నడపకండి. 6 అంగుళాల వేగవంతమైన నీటి ప్రవాహం మనిషిని పడేయగలదు.',
      'త్రాగునీరు, అత్యవసర మందులు (ఇన్సులిన్, బీపీ మందులు), పవర్ బ్యాంక్ మరియు ముఖ్యమైన పత్రాలను ప్లాస్టిక్ కవర్‌లో భద్రపరచుకోండి.',
      'ముఖ్య గమనిక: ఆఫ్‌లైన్‌లో సేవ్ చేయబడిన SOS అభ్యర్థనలు మీ ఫోన్‌లో సురక్షితంగా ఉంటాయి. నెట్‌వర్క్ రాగానే రెస్క్యూ టీమ్‌కు ఆటోమేటిక్‌గా పంపబడతాయి.',
    ],
  },
  hi: {
    title: 'ऑफ़लाइन आपातकालीन बाढ़ सुरक्षा निर्देश (बिना इंटरनेट उपयोग के लिए सुरक्षित)',
    helplines: [
      { label: 'राष्ट्रीय आपातकालीन हेल्पलाइन', number: '112' },
      { label: 'एम्बुलेंस और चिकित्सा आपातकाल', number: '108' },
      { label: 'आपदा प्रबंधन नियंत्रण कक्ष (NDRF/SDMA)', number: '1070 / 1077' },
    ],
    steps: [
      'तुरंत सबसे ऊपरी मंजिल या ऊंचे सुरक्षित स्थान पर जाएं। पानी बढ़ने पर बेसमेंट या ग्राउंड फ्लोर में न रहें।',
      'घर खाली करने से पहले मुख्य बिजली का स्विच और एलपीजी गैस सिलेंडर का वाल्व बंद कर दें।',
      'बहते हुए बाढ़ के पानी में कभी न चलें और न ही गाड़ी चलाएं—6 इंच तेज बहता पानी व्यक्ति को गिरा सकता है।',
      'पीने का साफ पानी, जरूरी दवाइयां (इंसुलिन, हृदय रोग की दवा), पावर बैंक और पहचान पत्र वाटरप्रूफ बैग में रखें।',
      'महत्वपूर्ण सूचना: ऑफ़लाइन सहेजे गए SOS अनुरोध आपके डिवाइस में सुरक्षित हैं और नेटवर्क वापस आते ही बचाव दल को स्वतः भेज दिए जाएंगे।',
    ],
  },
};
