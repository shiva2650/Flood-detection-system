export type LanguageCode = 'en' | 'te' | 'hi';
export type UserRole = 'admin' | 'citizen' | 'rescue' | 'shelter';

export interface TranslationDictionary {
  appTitle: string;
  commandCenter: string;
  floodMonitoring: string;
  citizenDashboard: string;
  citizenRegistration: string;
  citizenSos: string;
  communityChat: string;
  volunteerHub: string;
  rescueOps: string;
  shelters: string;
  massAlerts: string;
  digitalTwin: string;
  aiAssistant: string;
  analytics: string;
  systemHealth: string;
  triggerEmergencySos: string;
  offlineQueueReady: string;
  installApp: string;
  roleLabels: Record<UserRole, string>;
  registration: {
    title: string;
    subtitle: string;
    fullName: string;
    mobileNumber: string;
    emailAddress: string;
    state: string;
    city: string;
    locality: string;
    preferredLanguage: string;
    gpsPermissionTitle: string;
    gpsPermissionDesc: string;
    captureGpsBtn: string;
    registerBtn: string;
    loginExistingBtn: string;
    updateProfileBtn: string;
    savedSuccess: string;
    presetScenariosTitle: string;
  };
  dashboard: {
    welcomePrefix: string;
    localityRiskTitle: string;
    riskScoreLabel: string;
    stayIndoorsBanner: string;
    evacuateNowBanner: string;
    prepareEvacuationBanner: string;
    weatherRainfallLabel: string;
    nearbyFloodedTitle: string;
    nearbySaferTitle: string;
    verifiedSheltersTitle: string;
    verifiedHospitalsTitle: string;
    latestAlertsTitle: string;
    originalOfficialMsg: string;
    translatedMsgLabel: string;
    offlineSafetyTitle: string;
  };
  community: {
    title: string;
    subtitle: string;
    selectLocality: string;
    postPlaceholder: string;
    postUpdateBtn: string;
    typeUpdate: string;
    typeHelpRequest: string;
    typeHazardReport: string;
    typeDirectAssist: string;
    flagMisinfoBtn: string;
    verifiedBadge: string;
    flaggedBadge: string;
  };
  volunteer: {
    title: string;
    subtitle: string;
    safetyWarningTitle: string;
    safetyWarningDesc: string;
    skillsLabel: string;
    availabilityLabel: string;
    acknowledgeSafetyCheckbox: string;
    registerVolunteerBtn: string;
  };
  alertsEngine: {
    title: string;
    subtitle: string;
    triggerAutoAlertBtn: string;
    smsEnglishCount: string;
    smsTeluguCount: string;
    smsHindiCount: string;
    dedupProtected: string;
    retryFailedBtn: string;
  };
  offlineNotice: {
    bannerTitle: string;
    bannerDesc: string;
    statusSavedOffline: string;
    statusWaitingNetwork: string;
    statusSent: string;
    statusFailed: string;
  };
}

export const UI_TRANSLATIONS: Record<LanguageCode, TranslationDictionary> = {
  en: {
    appTitle: 'AlertNet Command',
    commandCenter: 'Command Center',
    floodMonitoring: 'Flood Prediction & GIS',
    citizenDashboard: 'My Locality Dashboard',
    citizenRegistration: 'Citizen Register / Profile',
    citizenSos: 'Citizen SOS Portal',
    communityChat: 'Locality Community Chat',
    volunteerHub: 'Volunteer Coordination',
    rescueOps: 'Rescue & Triage',
    shelters: 'Shelters & Hospitals',
    massAlerts: 'Location & SMS Alerts',
    digitalTwin: 'Digital Twin Simulator',
    aiAssistant: 'AI Safety Chatbot',
    analytics: 'Analytics & Audit',
    systemHealth: 'System Reliability',
    triggerEmergencySos: 'Submit Emergency SOS',
    offlineQueueReady: 'IndexedDB Offline Queue Active',
    installApp: 'Install PWA',
    roleLabels: {
      admin: 'Disaster Authority (Admin)',
      citizen: 'Citizen Portal',
      rescue: 'NDRF Rescue Team',
      shelter: 'Shelter Manager',
    },
    registration: {
      title: 'Citizen Registration, Login & Localized Alert Profile',
      subtitle: 'Register your mobile number, locality, and preferred language (English, తెలుగు, हिंदी) for automatic flood warnings.',
      fullName: 'Full Name',
      mobileNumber: 'Mobile Number (SMS Alerts)',
      emailAddress: 'Email Address',
      state: 'State',
      city: 'City / District',
      locality: 'Locality / Ward',
      preferredLanguage: 'Preferred Alert Language',
      gpsPermissionTitle: 'Location Permission for Local Flood Alerts',
      gpsPermissionDesc: 'Grant GPS access so AlertNet can pinpoint your exact flood zone and nearest safe shelter.',
      captureGpsBtn: 'Allow GPS Location',
      registerBtn: 'Register & Activate Local Alerts',
      loginExistingBtn: 'Switch Registered Citizen Profile',
      updateProfileBtn: 'Save Language & Locality Changes',
      savedSuccess: 'Citizen profile, preferred language, and locality saved to Cloud SQL.',
      presetScenariosTitle: 'Quick Demo Citizen Profiles (1-Click Switch)',
    },
    dashboard: {
      welcomePrefix: 'Localized Flood Intelligence for',
      localityRiskTitle: 'Current Locality Flood Risk',
      riskScoreLabel: 'Flood Risk Score (0–100)',
      stayIndoorsBanner: 'OFFICIAL GUIDANCE: STAY INDOORS & MONITOR UPDATES. Roads in your locality remain passable.',
      evacuateNowBanner: 'OFFICIAL GUIDANCE: EVACUATE IMMEDIATELY TO VERIFIED HIGH-GROUND SHELTER. Critical water rise detected.',
      prepareEvacuationBanner: 'OFFICIAL GUIDANCE: MOVE TO UPPER FLOORS & PREPARE GRAB BAG. Avoid low-lying underpasses.',
      weatherRainfallLabel: 'Live Weather & Rainfall Telemetry',
      nearbyFloodedTitle: 'Nearby Flooded & High-Risk Zones (Avoid)',
      nearbySaferTitle: 'Nearby Safer High-Ground Corridors',
      verifiedSheltersTitle: 'Verified Emergency Shelters Near You',
      verifiedHospitalsTitle: 'Verified Emergency Hospitals & Trauma Units',
      latestAlertsTitle: 'Automatic Location-Based Emergency Notifications',
      originalOfficialMsg: 'Official Dispatch (English)',
      translatedMsgLabel: 'Translated Emergency Alert',
      offlineSafetyTitle: 'Offline Cached Emergency Safety Instructions',
    },
    community: {
      title: 'Locality-Based Citizen Community Chat',
      subtitle: 'Connect with verified neighbors in your locality to share flood updates, request help, and report blocked roads.',
      selectLocality: 'Active Locality Channel',
      postPlaceholder: 'Share verified water levels, road closures, or request neighborhood assistance...',
      postUpdateBtn: 'Post to Locality Channel',
      typeUpdate: 'Verified Flood Update',
      typeHelpRequest: 'Emergency Help Request',
      typeHazardReport: 'Dangerous Road / Water Report',
      typeDirectAssist: 'Offer Direct Assistance',
      flagMisinfoBtn: 'Report Unverified / Misinformation',
      verifiedBadge: 'Verified Local Report',
      flaggedBadge: 'Flagged for Admin Review',
    },
    volunteer: {
      title: 'Registered Volunteer Coordination Hub',
      subtitle: 'Support safe shelter intake, multilingual translation, food distribution, and medical camp logistics.',
      safetyWarningTitle: 'MANDATORY VOLUNTEER SAFETY DIRECTIVE',
      safetyWarningDesc: 'Untrained volunteers are strictly prohibited from entering fast-moving floodwaters or deep inundation zones. Deep-water rescue is restricted to certified NDRF/SDRF boat teams.',
      skillsLabel: 'Skills & Certifications (First Aid, Translation, Relief Logistics)',
      availabilityLabel: 'Availability Window',
      acknowledgeSafetyCheckbox: 'I acknowledge that I will only operate in verified non-hazardous zones under official command.',
      registerVolunteerBtn: 'Register as Verified Relief Volunteer',
    },
    alertsEngine: {
      title: 'Automatic Location-Based Multilingual SMS & Push Alert Engine',
      subtitle: 'Automatically dispatches flood warnings to registered citizens in affected localities in their chosen language (English, తెలుగు, हिंदी).',
      triggerAutoAlertBtn: 'Dispatch Automatic Locality Alerts Now',
      smsEnglishCount: 'English SMS Delivered',
      smsTeluguCount: 'Telugu (తెలుగు) SMS Delivered',
      smsHindiCount: 'Hindi (हिंदी) SMS Delivered',
      dedupProtected: 'Duplicate Alert Prevention Active',
      retryFailedBtn: 'Retry Failed Deliveries',
    },
    offlineNotice: {
      bannerTitle: 'OFFLINE EMERGENCY MODE — INDEXEDDB STORAGE ACTIVE',
      bannerDesc: 'Important: Offline SOS requests cannot reach rescue teams until a communication connection becomes available. Your SOS is safely stored on this device and will auto-transmit on reconnect.',
      statusSavedOffline: 'Saved Offline (IndexedDB)',
      statusWaitingNetwork: 'Waiting for Network',
      statusSent: 'Sent to Command Center',
      statusFailed: 'Transmission Failed (Will Retry)',
    },
  },
  te: {
    appTitle: 'అలర్ట్‌నెట్ కమాండ్ (AlertNet)',
    commandCenter: 'కమాండ్ సెంటర్',
    floodMonitoring: 'వరద అంచనా & GIS మ్యాప్',
    citizenDashboard: 'నా ప్రాంత వరద సమాచారం',
    citizenRegistration: 'పౌరుల నమోదు / ప్రొఫైల్',
    citizenSos: 'పౌరుల అత్యవసర SOS',
    communityChat: 'ప్రాంతీయ కమ్యూనిటీ చాట్',
    volunteerHub: 'వాలంటీర్ల సమన్వయం',
    rescueOps: 'రెస్క్యూ & ట్రయాజ్',
    shelters: 'షెల్టర్లు & ఆసుపత్రులు',
    massAlerts: 'ప్రాంతీయ SMS హెచ్చరికలు',
    digitalTwin: 'డిజిటల్ ట్విన్ సిమ్యులేటర్',
    aiAssistant: 'AI భద్రతా సహాయకుడు',
    analytics: 'విశ్లేషణలు & నివేదికలు',
    systemHealth: 'సిస్టమ్ విశ్వసనీయత',
    triggerEmergencySos: 'అత్యవసర SOS పంపండి',
    offlineQueueReady: 'ఆఫ్‌లైన్ క్యూ & సురక్షిత నిల్వ సిద్ధంగా ఉంది',
    installApp: 'యాప్ ఇన్‌స్టాల్ చేయండి',
    roleLabels: {
      admin: 'విపత్తు నిర్వహణ అధికారి (Admin)',
      citizen: 'పౌరుల పోర్టల్ (Citizen)',
      rescue: 'రెస్క్యూ బృందం (Rescue Team)',
      shelter: 'షెల్టర్ మేనేజర్ (Shelter)',
    },
    registration: {
      title: 'పౌరుల నమోదు, లాగిన్ & ప్రాంతీయ హెచ్చరిక ప్రొఫైల్',
      subtitle: 'మీ ప్రాంతంలో వరద హెచ్చరికలను తెలుగులో పొందడానికి మీ మొబైల్ నంబర్ మరియు ప్రాంతాన్ని నమోదు చేయండి.',
      fullName: 'పూర్తి పేరు',
      mobileNumber: 'మొబైల్ నంబర్ (SMS హెచ్చరికల కోసం)',
      emailAddress: 'ఇమెయిల్ చిరునామా',
      state: 'రాష్ట్రం',
      city: 'నగరం / జిల్లా',
      locality: 'ప్రాంతం / కాలనీ',
      preferredLanguage: 'ప్రాధాన్య భాష (Preferred Language)',
      gpsPermissionTitle: 'ఖచ్చితమైన వరద హెచ్చరికల కోసం లొకేషన్ అనుమతి',
      gpsPermissionDesc: 'మీ ప్రాంత వరద తీవ్రతను మరియు దగ్గరలోని సురక్షిత షెల్టర్లను చూపడానికి GPS అనుమతించండి.',
      captureGpsBtn: 'GPS లొకేషన్ అనుమతించండి',
      registerBtn: 'నమోదు చేయండి & హెచ్చరికలు పొందండి',
      loginExistingBtn: 'ఇతర పౌరుల ప్రొఫైల్ ఎంచుకోండి',
      updateProfileBtn: 'భాష & ప్రాంత మార్పులను సేవ్ చేయండి',
      savedSuccess: 'మీ ప్రొఫైల్, ఎంచుకున్న భాష మరియు ప్రాంతం విజయవంతంగా సేవ్ చేయబడ్డాయి.',
      presetScenariosTitle: 'డెమో పౌరుల ప్రొఫైల్స్ (ఒక క్లిక్‌తో మార్చండి)',
    },
    dashboard: {
      welcomePrefix: 'ప్రాంతీయ వరద సమాచారం:',
      localityRiskTitle: 'మీ ప్రాంతంలో ప్రస్తుత వరద ప్రమాద స్థాయి',
      riskScoreLabel: 'వరద ప్రమాద స్కోరు (0–100)',
      stayIndoorsBanner: 'అధికారిక సూచన: ఇంట్లోనే సురక్షితంగా ఉండండి. అధికారిక వార్తలను గమనిస్తూ ఉండండి.',
      evacuateNowBanner: 'అత్యవసర అధికారిక సూచన: వెంటనే సురక్షిత పునరావాస కేంద్రానికి వెళ్లండి! నీటి మట్టం ప్రమాదకరంగా పెరుగుతోంది.',
      prepareEvacuationBanner: 'అధికారిక సూచన: పై అంతస్తులకు వెళ్లండి. అత్యవసర వస్తువులతో సిద్ధంగా ఉండండి.',
      weatherRainfallLabel: 'ప్రస్తుత వాతావరణం & వర్షపాతం',
      nearbyFloodedTitle: 'దగ్గరలోని వరద ప్రభావిత ప్రాంతాలు (వెళ్లకండి)',
      nearbySaferTitle: 'దగ్గరలోని సురక్షిత ఎత్తైన ప్రాంతాలు',
      verifiedSheltersTitle: 'ధృవీకరించబడిన సురక్షిత పునరావాస కేంద్రాలు',
      verifiedHospitalsTitle: 'అత్యవసర ఆసుపత్రులు & వైద్య కేంద్రాలు',
      latestAlertsTitle: 'మీ ప్రాంతానికి వచ్చిన అత్యవసర వరద హెచ్చరికలు',
      originalOfficialMsg: 'అధికారిక సందేశం (Original)',
      translatedMsgLabel: 'తెలుగు అనువాదం (Translated Alert)',
      offlineSafetyTitle: 'ఆఫ్‌లైన్ వరద భద్రతా మార్గదర్శకాలు',
    },
    community: {
      title: 'ప్రాంతీయ పౌరుల కమ్యూనిటీ చాట్',
      subtitle: 'మీ ప్రాంతంలోని ఇతర పౌరులతో వరద పరిస్థితి, మూసుకుపోయిన రోడ్లు మరియు సహాయ అభ్యర్థనలను పంచుకోండి.',
      selectLocality: 'ఎంచుకున్న ప్రాంతం',
      postPlaceholder: 'మీ ప్రాంతంలో నీటి మట్టం, రోడ్డు పరిస్థితి లేదా సహాయ అభ్యర్థనను ఇక్కడ రాయండి...',
      postUpdateBtn: 'సందేశం పంపండి',
      typeUpdate: 'వరద పరిస్థితి అప్‌డేట్',
      typeHelpRequest: 'అత్యవసర సహాయ అభ్యర్థన',
      typeHazardReport: 'ప్రమాదకర రోడ్డు / నీటి నివేదిక',
      typeDirectAssist: 'సహాయం అందించడానికి సిద్ధం',
      flagMisinfoBtn: 'తప్పుడు సమాచారాన్ని రిపోర్ట్ చేయండి',
      verifiedBadge: 'ధృవీకరించబడిన నివేదిక',
      flaggedBadge: 'సమీక్ష కోసం ఫ్లాగ్ చేయబడింది',
    },
    volunteer: {
      title: 'వాలంటీర్ నమోదు & సహాయ సమన్వయం',
      subtitle: 'పునరావాస కేంద్రాలలో ఆహార పంపిణీ, ప్రథమ చికిత్స మరియు అనువాద సహాయం అందించండి.',
      safetyWarningTitle: 'ముఖ్యమైన వాలంటీర్ భద్రతా నియమం',
      safetyWarningDesc: 'శిక్షణ లేని వాలంటీర్లు లోతైన వరద నీటిలోకి లేదా ప్రమాదకర ప్రవాహంలోకి వెళ్లకూడదు. కేవలం NDRF/SDRF బృందాలు మాత్రమే నీటిలో రెస్క్యూ నిర్వహిస్తాయి.',
      skillsLabel: 'మీ నైపుణ్యాలు (ప్రథమ చికిత్స, ఆహార పంపిణీ, అనువాదం)',
      availabilityLabel: 'అందుబాటులో ఉండే సమయం',
      acknowledgeSafetyCheckbox: 'నేను కేవలం సురక్షిత ప్రాంతాలలో మాత్రమే అధికారుల సూచనల మేరకు సేవ చేస్తానని అంగీకరిస్తున్నాను.',
      registerVolunteerBtn: 'వాలంటీర్‌గా నమోదు చేసుకోండి',
    },
    alertsEngine: {
      title: 'ఆటోమేటిక్ ప్రాంతీయ SMS & పుష్ హెచ్చరికల సిస్టమ్',
      subtitle: 'వరద ప్రభావిత ప్రాంతాలలోని పౌరులకు వారి భాషలో (English, తెలుగు, हिंदी) ఆటోమేటిక్ హెచ్చరికలు పంపుతుంది.',
      triggerAutoAlertBtn: 'ప్రాంతీయ అత్యవసర హెచ్చరికలను పంపండి',
      smsEnglishCount: 'ఇంగ్లీష్ SMS లు',
      smsTeluguCount: 'తెలుగు SMS లు',
      smsHindiCount: 'హిందీ SMS లు',
      dedupProtected: 'డూప్లికేట్ హెచ్చరికల నివారణ సక్రియంగా ఉంది',
      retryFailedBtn: 'విఫలమైన SMS లను మళ్లీ పంపండి',
    },
    offlineNotice: {
      bannerTitle: 'ఆఫ్‌లైన్ అత్యవసర మోడ్ — INDEXEDDB నిల్వ పనిచేస్తోంది',
      bannerDesc: 'ముఖ్య గమనిక: నెట్‌వర్క్ కనెక్షన్ వచ్చే వరకు ఆఫ్‌లైన్ SOS అభ్యర్థనలు రెస్క్యూ బృందాలకు చేరవు. మీ SOS ఫోన్‌లో సురక్షితంగా సేవ్ చేయబడింది మరియు నెట్‌వర్క్ రాగానే ఆటోమేటిక్‌గా పంపబడుతుంది.',
      statusSavedOffline: 'ఆఫ్‌లైన్‌లో సేవ్ చేయబడింది',
      statusWaitingNetwork: 'నెట్‌వర్క్ కోసం వేచి ఉంది',
      statusSent: 'కమాండ్ సెంటర్‌కు పంపబడింది',
      statusFailed: 'పంపడం విఫలమైంది (మళ్లీ ప్రయత్నిస్తుంది)',
    },
  },
  hi: {
    appTitle: 'अलर्टनेट कमांड (AlertNet)',
    commandCenter: 'कमांड सेंटर',
    floodMonitoring: 'बाढ़ पूर्वानुमान और GIS',
    citizenDashboard: 'मेरा क्षेत्रीय डैशबोर्ड',
    citizenRegistration: 'नागरिक पंजीकरण / प्रोफ़ाइल',
    citizenSos: 'नागरिक SOS पोर्टल',
    communityChat: 'क्षेत्रीय सामुदायिक चैट',
    volunteerHub: 'स्वयंसेवक समन्वय',
    rescueOps: 'बचाव और ट्रायज',
    shelters: 'राहत शिविर और अस्पताल',
    massAlerts: 'क्षेत्रीय SMS चेतावनी',
    digitalTwin: 'डिजिटल ट्विन सिम्युलेटर',
    aiAssistant: 'AI सुरक्षा चैटबॉट',
    analytics: 'विश्लेषण और ऑडिट',
    systemHealth: 'सिस्टम विश्वसनीयता',
    triggerEmergencySos: 'आपातकालीन SOS भेजें',
    offlineQueueReady: 'ऑफ़लाइन क्यू और सुरक्षित स्टोरेज सक्रिय',
    installApp: 'ऐप इंस्टॉल करें',
    roleLabels: {
      admin: 'आपदा प्रबंधन प्राधिकरण (Admin)',
      citizen: 'नागरिक पोर्टल (Citizen)',
      rescue: 'एनडीआरएफ बचाव दल (Rescue)',
      shelter: 'राहत शिविर प्रबंधक (Shelter)',
    },
    registration: {
      title: 'नागरिक पंजीकरण, लॉगिन और क्षेत्रीय अलर्ट प्रोफ़ाइल',
      subtitle: 'अपने क्षेत्र की बाढ़ चेतावनी अपनी भाषा (हिंदी, తెలుగు, English) में पाने के लिए मोबाइल नंबर और क्षेत्र दर्ज करें।',
      fullName: 'पूरा नाम',
      mobileNumber: 'मोबाइल नंबर (SMS अलर्ट के लिए)',
      emailAddress: 'ईमेल पता',
      state: 'राज्य',
      city: 'शहर / जिला',
      locality: 'क्षेत्र / कॉलोनी (Locality)',
      preferredLanguage: 'पसंदीदा भाषा (Preferred Language)',
      gpsPermissionTitle: 'सटीक स्थानीय बाढ़ अलर्ट के लिए लोकेशन अनुमति',
      gpsPermissionDesc: 'अपने क्षेत्र के बाढ़ जोखिम और निकटतम सुरक्षित राहत शिविर देखने के लिए GPS अनुमति दें।',
      captureGpsBtn: 'GPS लोकेशन अनुमति दें',
      registerBtn: 'पंजीकरण करें और अलर्ट सक्रिय करें',
      loginExistingBtn: 'पंजीकृत नागरिक प्रोफ़ाइल बदलें',
      updateProfileBtn: 'भाषा और क्षेत्र परिवर्तन सहेजें',
      savedSuccess: 'नागरिक प्रोफ़ाइल, पसंदीदा भाषा और क्षेत्र सुरक्षित रूप से सहेज लिए गए हैं।',
      presetScenariosTitle: 'डेमो नागरिक प्रोफ़ाइल (1-क्लिक स्विच)',
    },
    dashboard: {
      welcomePrefix: 'क्षेत्रीय बाढ़ सुरक्षा जानकारी:',
      localityRiskTitle: 'आपके क्षेत्र में वर्तमान बाढ़ जोखिम',
      riskScoreLabel: 'बाढ़ जोखिम स्कोर (0–100)',
      stayIndoorsBanner: 'आधिकारिक निर्देश: घर के अंदर सुरक्षित रहें और आधिकारिक अपडेट पर नज़र रखें।',
      evacuateNowBanner: 'आपातकालीन निर्देश: तुरंत निकटतम सुरक्षित राहत शिविर में जाएं! जल स्तर खतरनाक रूप से बढ़ रहा है।',
      prepareEvacuationBanner: 'आधिकारिक निर्देश: ऊपरी मंजिल पर जाएं और आपातकालीन किट तैयार रखें।',
      weatherRainfallLabel: 'वर्तमान मौसम और वर्षा डेटा',
      nearbyFloodedTitle: 'आस-पास के बाढ़ प्रभावित और खतरनाक क्षेत्र (बचें)',
      nearbySaferTitle: 'आस-पास के सुरक्षित ऊंचे क्षेत्र',
      verifiedSheltersTitle: 'सत्यापित आपातकालीन राहत शिविर',
      verifiedHospitalsTitle: 'सत्यापित आपातकालीन अस्पताल और ट्रॉमा सेंटर',
      latestAlertsTitle: 'आपके क्षेत्र के लिए स्वचालित आपातकालीन सूचनाएं',
      originalOfficialMsg: 'आधिकारिक संदेश (Original)',
      translatedMsgLabel: 'हिंदी अनुवाद (Translated Alert)',
      offlineSafetyTitle: 'ऑफ़लाइन सुरक्षित बाढ़ सुरक्षा निर्देश',
    },
    community: {
      title: 'क्षेत्रीय नागरिक सामुदायिक चैट',
      subtitle: 'बाढ़ अपडेट साझा करने, मदद मांगने और बंद सड़कों की सूचना देने के लिए अपने क्षेत्र के नागरिकों से जुड़ें।',
      selectLocality: 'सक्रिय क्षेत्रीय चैनल',
      postPlaceholder: 'जल स्तर, बंद सड़कें या सहायता अनुरोध यहाँ साझा करें...',
      postUpdateBtn: 'क्षेत्रीय चैनल में पोस्ट करें',
      typeUpdate: 'सत्यापित बाढ़ अपडेट',
      typeHelpRequest: 'आपातकालीन सहायता अनुरोध',
      typeHazardReport: 'खतरनाक सड़क / जलभराव रिपोर्ट',
      typeDirectAssist: 'सीधी सहायता उपलब्ध',
      flagMisinfoBtn: 'अफवाह / गलत जानकारी रिपोर्ट करें',
      verifiedBadge: 'सत्यापित स्थानीय रिपोर्ट',
      flaggedBadge: 'समीक्षा के लिए चिह्नित',
    },
    volunteer: {
      title: 'पंजीकृत स्वयंसेवक समन्वय केंद्र',
      subtitle: 'राहत शिविरों में भोजन वितरण, प्राथमिक उपचार और बहुभाषी सहायता में योगदान दें।',
      safetyWarningTitle: 'अनिवार्य स्वयंसेवक सुरक्षा निर्देश',
      safetyWarningDesc: 'अप्रशिक्षित स्वयंसेवकों को गहरे या तेज बहते बाढ़ के पानी में जाने की सख्त मनाही है। जल बचाव केवल प्रशिक्षित NDRF/SDRF टीमों द्वारा किया जाता है।',
      skillsLabel: 'कौशल (प्राथमिक उपचार, अनुवाद, राहत सामग्री वितरण)',
      availabilityLabel: 'उपलब्धता समय',
      acknowledgeSafetyCheckbox: 'मैं पुष्टि करता/करती हूँ कि मैं केवल सुरक्षित क्षेत्रों में आधिकारिक निर्देशों के तहत सहायता करूँगा/करूँगी।',
      registerVolunteerBtn: 'स्वयंसेवक के रूप में पंजीकरण करें',
    },
    alertsEngine: {
      title: 'स्वचालित क्षेत्रीय बहुभाषी SMS और पुश अलर्ट इंजन',
      subtitle: 'प्रभावित क्षेत्रों के पंजीकृत नागरिकों को उनकी चुनी हुई भाषा (English, తెలుగు, हिंदी) में स्वचालित बाढ़ चेतावनी भेजता है।',
      triggerAutoAlertBtn: 'क्षेत्रीय स्वचालित अलर्ट अभी भेजें',
      smsEnglishCount: 'अंग्रेजी SMS वितरित',
      smsTeluguCount: 'तेलुगु (తెలుగు) SMS वितरित',
      smsHindiCount: 'हिंदी SMS वितरित',
      dedupProtected: 'डुप्लिकेट अलर्ट रोकथाम सक्रिय',
      retryFailedBtn: 'विफल संदेशों को पुनः भेजें',
    },
    offlineNotice: {
      bannerTitle: 'ऑफ़लाइन आपातकालीन मोड — INDEXEDDB स्टोरेज सक्रिय',
      bannerDesc: 'महत्वपूर्ण सूचना: जब तक नेटवर्क कनेक्शन उपलब्ध नहीं होता, ऑफ़लाइन SOS अनुरोध बचाव दल तक नहीं पहुँच सकते। आपका SOS इस डिवाइस पर सुरक्षित है और नेटवर्क आते ही स्वतः भेज दिया जाएगा।',
      statusSavedOffline: 'ऑफ़लाइन सहेजा गया (IndexedDB)',
      statusWaitingNetwork: 'नेटवर्क की प्रतीक्षा में',
      statusSent: 'कमांड सेंटर को भेजा गया',
      statusFailed: 'भेजने में विफल (पुनः प्रयास होगा)',
    },
  },
};

export interface LocalityMetadata {
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  baseRiskScore: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  rainfallMmHr: number;
  riverLevelM: number;
  floodedZones: string[];
  saferZones: string[];
  evacuationRoute: string;
  officialAction: 'STAY_INDOORS' | 'PREPARE' | 'EVACUATE';
}

export const LOCALITY_DIRECTORY: LocalityMetadata[] = [
  {
    name: 'Lower Delta Sector 4',
    city: 'Hyderabad',
    state: 'Telangana',
    lat: 17.3616,
    lon: 78.4747,
    baseRiskScore: 89,
    riskLevel: 'Critical',
    rainfallMmHr: 118,
    riverLevelM: 6.85,
    floodedZones: ['Old River Bridge Approach (3.2 ft water)', 'Sector 4 Low-Line Market', 'Musi South Embankment'],
    saferZones: ['St. Jude High Ground Relief Camp', 'East Arterial Elevated Corridor', 'Highland Ridge Plaza'],
    evacuationRoute: 'Take Sector 4 Ring Road North -> East Arterial Elevated Corridor -> St. Jude High Ground Camp (Verified Passable)',
    officialAction: 'EVACUATE',
  },
  {
    name: 'Central Basin',
    city: 'Hyderabad',
    state: 'Telangana',
    lat: 17.385,
    lon: 78.4867,
    baseRiskScore: 76,
    riskLevel: 'High',
    rainfallMmHr: 94,
    riverLevelM: 5.9,
    floodedZones: ['Central Underpass #2 (Submerged)', 'Basin Lane 4 Ground Floor Zone'],
    saferZones: ['Central Civic Dome Shelter', 'Secretariat Hill High Road', 'NIMS Elevated Campus'],
    evacuationRoute: 'Proceed via Tank Bund Upper Boulevard -> Central Civic Dome Shelter (Avoid Underpass #2)',
    officialAction: 'PREPARE',
  },
  {
    name: 'Riverfront Industrial',
    city: 'Hyderabad',
    state: 'Telangana',
    lat: 17.4065,
    lon: 78.4772,
    baseRiskScore: 68,
    riskLevel: 'High',
    rainfallMmHr: 82,
    riverLevelM: 5.4,
    floodedZones: ['West Culvert Service Road', 'Dockyard Warehouse Sector B'],
    saferZones: ['East Causeway Elevated Highway', 'Gandhi Hospital High Ground'],
    evacuationRoute: 'Use East Causeway Corridor -> Gandhi Emergency Relief Complex',
    officialAction: 'PREPARE',
  },
  {
    name: 'Southern Floodplain',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    lat: 16.5062,
    lon: 80.648,
    baseRiskScore: 84,
    riskLevel: 'Critical',
    rainfallMmHr: 112,
    riverLevelM: 6.5,
    floodedZones: ['Prakasam Barrage Downstream Low Bank', 'Canal Road Ward 12'],
    saferZones: ['Gunadala Hill Relief Shelter', 'NH-16 Elevated Bypass'],
    evacuationRoute: 'Evacuate via MG Road Elevated Stretch -> Gunadala High Ground Shelter',
    officialAction: 'EVACUATE',
  },
  {
    name: 'Highland East',
    city: 'Hyderabad',
    state: 'Telangana',
    lat: 17.441,
    lon: 78.532,
    baseRiskScore: 28,
    riskLevel: 'Low',
    rainfallMmHr: 31,
    riverLevelM: 3.1,
    floodedZones: ['None — Drainage operating at normal capacity'],
    saferZones: ['Highland East Community Hall', 'Uppal Elevated Metro Corridor', 'Highland Multi-Specialty Hub'],
    evacuationRoute: 'All arterial roads open and verified safe; remain indoors during heavy rain squalls.',
    officialAction: 'STAY_INDOORS',
  },
];
