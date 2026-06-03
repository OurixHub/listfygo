import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Component, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import { translations } from '../../i18n';
import { supabase } from '../../lib/supabase';

const STORAGE_KEY = 'shopix_clean_v2';

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const { width: screenWidth } = Dimensions.get('window');
const logoWidth = Math.min(screenWidth * 0.70, 460);
const logoHeight = logoWidth * 0.38;
const topBarHeight = logoHeight + 20;

const SECTORS = [
  { key: 'general', color: '#64748b' },

  { key: 'fruits', color: '#22c55e' },
  { key: 'meat', color: '#ef4444' },
  { key: 'fridge', color: '#e5e7eb' },
  { key: 'bakery', color: '#facc15' },
  { key: 'grocery', color: '#fde68a' },
  { key: 'drinks', color: '#38bdf8' },
  { key: 'frozen', color: '#60a5fa' },
  { key: 'cleaning', color: '#f97316' },
  { key: 'hygiene', color: '#a78bfa' },
  { key: 'baby', color: '#f9a8d4' },
  { key: 'pet', color: '#a3a3a3' },
  { key: 'other', color: '#94a3b8' },
];

const LOCATION_COLORS = [
  '#facc15',
  '#1e3a8a',
  '#ef4444',
  '#166534',
  '#f97316',
  '#7c3aed',
  '#64748b',
];

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#071120', padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '900', marginBottom: 16 }}>
            ShopLink crashed
          </Text>
          <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '700', marginBottom: 12 }}>
            {this.state.error.message}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}>
            {this.state.info?.componentStack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function App() {

  const [lang, setLang] = useState('en');
  const t = translations?.[lang] || translations.en;

  // carrega idioma salvo

  useEffect(() => {
    const loadLang = async () => {
      const savedLang = await AsyncStorage.getItem('lang');
      if (savedLang) {
        setLang(savedLang);
      }
    };

    loadLang();
  }, []);
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
      const rawGuest = await AsyncStorage.getItem('guestSession');
      if (rawGuest) {
        try { setGuestSession(JSON.parse(rawGuest)); } catch {}
      }
      setAppReady(true);
    };

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  // função para trocar idioma
  const changeLang = (newLang) => {
    setLang(newLang);
    AsyncStorage.setItem('lang', newLang);
  };

  const handleAuth = async () => {
    const email = authEmail.trim();

    if (!email || !authPassword) {
      alert('Enter email and password');
      return;
    }

    const result =
      authMode === 'login'
        ? await supabase.auth.signInWithPassword({
          email,
          password: authPassword,
        })
        : await supabase.auth.signUp({
          email,
          password: authPassword,
        });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setUser(result.data.user || result.data.session?.user || null);
  };
  const [locations, setLocations] = useState([]);
  const [locationName, setLocationName] = useState('');
  const [activeLocationId, setActiveLocationId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activeSectorId, setActiveSectorId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftNote, setDraftNote] = useState('');
  const [newSectorName, setNewSectorName] = useState('');
  const [movingItem, setMovingItem] = useState(null);
  const [user, setUser] = useState(null);
  const [guestSession, setGuestSession] = useState(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [mockRole, setMockRole] = useState('owner');
  const canEdit   = r => r === 'owner' || r === 'writer';
  const canShop   = r => r === 'owner' || r === 'shopper';
  const canFinish = r => r === 'owner' || r === 'shopper';
  const canShare  = r => r === 'owner';
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [expandedReceiptId, setExpandedReceiptId] = useState(null);
  const [reuseReceipt, setReuseReceipt] = useState(null);
  const [reuseSelectedIds, setReuseSelectedIds] = useState([]);
  const [showRenameReceipt, setShowRenameReceipt] = useState(false);
  const [receiptNameDraft, setReceiptNameDraft] = useState('');
  const [autoReceiptNameDraft, setAutoReceiptNameDraft] = useState('');
  const [editingSector, setEditingSector] = useState(null);
  const [editingSectorLabel, setEditingSectorLabel] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [missingAlert, setMissingAlert] = useState(null);
  const [notifBanner, setNotifBanner] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [replyingToItemId, setReplyingToItemId] = useState(null);
  const [replacementDraft, setReplacementDraft] = useState('');
  const [inviteRole, setInviteRole] = useState(null);
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [sharedListIds, setSharedListIds] = useState([]);
  const [showInviteFeedback, setShowInviteFeedback] = useState(false);
  const [inviteFeedbackDraft, setInviteFeedbackDraft] = useState('');
  const [showSharingCenter, setShowSharingCenter] = useState(false);
  const [inviteWriterName, setInviteWriterName] = useState('');
  const [inviteShopperName, setInviteShopperName] = useState('');
  const [inviteViewerName, setInviteViewerName] = useState('');
  const [householdMembers, setHouseholdMembers] = useState({
    writers: [],
    shoppers: [],
    viewers: [],
  });
  const [profileName, setProfileName] = useState('You');
  const [householdName, setHouseholdName] = useState('My Household');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showRenameHousehold, setShowRenameHousehold] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [householdNameDraft, setHouseholdNameDraft] = useState('');
  const [showPresencePanel, setShowPresencePanel] = useState(false);
  const connectedUsers = useMemo(() => [
    ...householdMembers.writers.map(m => ({ ...m, role: 'writer', online: m.status === 'Live' })),
    ...householdMembers.shoppers.map(m => ({ ...m, role: 'shopper', online: m.status === 'Live' })),
    ...householdMembers.viewers.map(m => ({ ...m, role: 'viewer', online: m.status === 'Live' })),
  ], [householdMembers]);


  useEffect(() => {
    const load = async () => {
      try {
        const rawGuest = await AsyncStorage.getItem('guestSession');
        if (rawGuest) return; // guest: skip old local lists, applyGuestSession handles it

        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLocations(parsed);
            setReceipts([]);
          } else if (parsed.locations) {
            setLocations(parsed.locations);
            setReceipts(parsed.receipts || []);
          }
        }
      } catch {
        setLocations([]);
      }
    };

    load();
  }, []);

  // Upsert active list to Supabase whenever invite panel opens
  useEffect(() => {
    if (!showInviteBox || !activeLocation) return;
    const upsertSharedList = async () => {
      try {
        await supabase.from('shared_lists').upsert({
          id: activeLocation.id,
          owner_id: user?.id || null,
          name: activeLocation.name,
          data_json: activeLocation,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        setSharedListIds(prev =>
          prev.includes(activeLocation.id) ? prev : [...prev, activeLocation.id]
        );
      } catch {
        // silently ignore — invite still works locally
      }
    };
    upsertSharedList();
  }, [showInviteBox]);

  // Load guestSession and apply role/list on mount
  useEffect(() => {
    const applyGuestSession = async () => {
      try {
        const raw = await AsyncStorage.getItem('guestSession');
        if (!raw) return;
        const session = JSON.parse(raw);
        const { role, listId } = session;
        if (!role) return;

        setGuestSession(session);
        if (['writer', 'shopper', 'viewer'].includes(role)) setMockRole(role);

        if (listId) {
          setGuestLoading(true);
          try {
            const fetchPromise = supabase
              .from('shared_lists')
              .select('*')
              .eq('id', listId)
              .single();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 10000)
            );
            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
            if (error || !data || !data.data_json) {
              console.error('[guestSession] fetch failed or data_json missing', { error, data });
              setGuestError('This shared list is not available. Try the invite link again.');
            } else {
              const raw = data.data_json;
              const fetched = {
                ...raw,
                id: raw.id || listId,
                sectors: Array.isArray(raw.sectors) ? raw.sectors : [],
              };
              if (!fetched.id) {
                console.error('[guestSession] fetched.id missing', raw);
                setGuestError('Could not load shared list. Please try the invite link again.');
              } else {
                setLocations([fetched]);
                setActiveLocationId(fetched.id);
                setActiveSectorId(fetched.sectors[0]?.id || null);
                setSharedListIds([fetched.id]);
              }
            }
          } catch (e) {
            console.error('[guestSession] fetch threw', e);
            setGuestError('Could not load shared list. Please check your connection and try again.');
          } finally {
            setGuestLoading(false);
          }
        } else {
          setGuestError('This invite link is incomplete. Please use the full invite link.');
        }

        const key = role === 'writer' ? 'writers' : role === 'shopper' ? 'shoppers' : 'viewers';
        setHouseholdMembers(prev => {
          const list = [...prev[key]];
          for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].status === 'Pending Invite' || list[i].status === 'Connected') {
              list[i] = { ...list[i], status: 'Live' };
              break;
            }
          }
          return { ...prev, [key]: list };
        });
      } catch {
        setGuestLoading(false);
      }
    };
    applyGuestSession();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ locations, receipts })
    ).catch(() => { });

    // Sync any shared lists back to Supabase
    if (sharedListIds.length > 0) {
      locations.forEach(loc => {
        if (!sharedListIds.includes(loc.id)) return;
        supabase.from('shared_lists').upsert({
          id: loc.id,
          owner_id: user?.id || null,
          name: loc.name,
          data_json: loc,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }).catch(() => { });
      });
    }
  }, [locations, receipts]);

  const activeLocation = useMemo(
    () => locations.find((loc) => loc.id === activeLocationId) || null,
    [locations, activeLocationId]
  );

  const safeActiveLocation = activeLocation && Array.isArray(activeLocation.sectors) ? activeLocation : null;

  const addLocation = () => {
    const cleanName = locationName.trim();
    if (!cleanName) return;

    const color = LOCATION_COLORS[locations.length % LOCATION_COLORS.length];

    const newLocation = {
      id: uid(),
      name: cleanName,
      color,
      sectors: [],
    };

    setLocations((prev) => [...prev, newLocation]);
    setActiveLocationId(newLocation.id);
    setLocationName('');
    clearDraft();
  };

  const clearDraft = () => {
    setDraftName('');
    setDraftQty('1');
    setDraftNote('');
  };

  const addItem = () => {
    if (!activeLocationId) return;

    if (!activeSectorId) {
      alert('Create a section first');
      return;
    }

    const name = draftName.trim();
    const note = draftNote.trim();
    const qty = Math.max(1, parseInt(draftQty, 10) || 1);

    if (!name) return;

    const newItem = {
      id: uid(),
      name,
      qty,
      description: note,
      price: '',
      unitType: 'unit',
      pricePerKg: '',
      weight: ''
    };

    setLocations((prev) =>
      prev.map((loc) => {
        if (loc.id !== activeLocationId) return loc;

        return {
          ...loc,
          sectors: loc.sectors.map((sector) => {
            if (sector.id !== activeSectorId) return sector;

            return {
              ...sector,
              items: [...sector.items, newItem],
            };
          }),
        };
      })
    );

    clearDraft();
    logAction(`${name} added`);
  };

  const sendReplacement = (locationId, sectorId, missingItem) => {
    const name = replacementDraft.trim();
    if (!name) return;
    const newItem = {
      id: uid(),
      name,
      qty: 1,
      description: '',
      price: '',
      unitType: 'unit',
      pricePerKg: '',
      weight: '',
      status: 'pending',
      linkedMissingItemId: missingItem.id,
      replacementFor: missingItem.name,
    };
    setLocations(prev => prev.map(loc => {
      if (loc.id !== locationId) return loc;
      return {
        ...loc,
        sectors: loc.sectors.map(sec => {
          if (sec.id !== sectorId) return sec;
          return { ...sec, items: [...sec.items, newItem] };
        }),
      };
    }));
    const actor = mockRole === 'owner' ? 'Owner' : mockRole[0].toUpperCase() + mockRole.slice(1);
    logAction(`${actor} suggested replacement for ${missingItem.name}`);
    const replacementNotif = {
      id: uid(),
      type: 'replacement',
      itemName: name,
      originalItemName: missingItem.name,
      listName: activeLocation?.name || 'List',
      fromRole: mockRole,
      toRole: 'shopper',
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [replacementNotif, ...prev]);
    if (mockRole === 'shopper') {
      Vibration.vibrate([0, 300, 150, 300]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotifBanner({ text: `Replacement suggested: ${name}`, type: 'replacement' });
    }
    setReplacementDraft('');
    setReplyingToItemId(null);
  };

  const recalcWeightItem = (item, changes) => {
    const next = { ...item, ...changes };

    const total =
      next.price === ''
        ? null
        : parseFloat(next.price);

    const perKg =
      next.pricePerKg === ''
        ? null
        : parseFloat(next.pricePerKg);

    const weight =
      next.weight === ''
        ? null
        : parseFloat(next.weight);

    // 2 valores definidos → calcula o terceiro

    if (total !== null && weight !== null && perKg === null) {
      next.pricePerKg = (total / weight).toFixed(2);
    }

    if (perKg !== null && weight !== null && total === null) {
      next.price = (perKg * weight).toFixed(2);
    }

    if (total !== null && perKg !== null && weight === null) {
      next.weight = (total / perKg).toFixed(3);
    }

    return next;
  };

  const updateItem = (locationId, sectorId, itemId, changes) => {
    setLocations((prev) =>
      prev.map((loc) => {
        if (loc.id !== locationId) return loc;

        return {
          ...loc,
          sectors: loc.sectors.map((sector) => {
            if (sector.id !== sectorId) return sector;

            return {
              ...sector,
              items: sector.items.map((item) =>
                item.id === itemId
                  ? (item.unitType === 'weight'
                    ? recalcWeightItem(item, changes)
                    : { ...item, ...changes })
                  : item
              ),
            };
          }),
        };
      })
    );
  };

  const deleteItem = (locationId, sectorId, itemId) => {
    setLocations((prev) =>
      prev.map((loc) => {
        if (loc.id !== locationId) return loc;

        return {
          ...loc,
          sectors: loc.sectors.map((sector) => {
            if (sector.id !== sectorId) return sector;

            return {
              ...sector,
              items: sector.items.filter((item) => item.id !== itemId),
            };
          }),
        };
      })
    );
  };

  const deleteSector = (locationId, sectorId) => {
    setLocations(prev =>
      prev.map(loc => {
        if (loc.id !== locationId) return loc;

        return {
          ...loc,
          sectors: loc.sectors.filter(sec => sec.id !== sectorId)
        };
      })
    );

    logAction(`Sector deleted`);
  };

  const renameSector = (locationId, sectorId, newLabel) => {
    const newKey = newLabel.trim().toLowerCase().replace(/\s+/g, '-');
    setLocations(prev =>
      prev.map(loc => {
        if (loc.id !== locationId) return loc;
        return {
          ...loc,
          sectors: loc.sectors.map(sec => {
            if (sec.id !== sectorId) return sec;
            return { ...sec, key: newKey, label: newLabel.trim() };
          })
        };
      })
    );
  };

  const moveItem = (locationId, fromSectorId, toSectorId, itemId) => {
    setLocations(prev =>
      prev.map(loc => {
        if (loc.id !== locationId) return loc;

        let itemToMove = null;

        const updatedSectors = loc.sectors.map(sector => {
          // REMOVE do setor atual
          if (sector.id === fromSectorId) {
            const remaining = sector.items.filter(item => {
              if (item.id === itemId) {
                itemToMove = item;
                return false;
              }
              return true;
            });

            return { ...sector, items: remaining };
          }

          return sector;
        });

        // ADICIONA no novo setor
        return {
          ...loc,
          sectors: updatedSectors.map(sector => {
            if (sector.id === toSectorId && itemToMove) {
              return {
                ...sector,
                items: [...sector.items, itemToMove],
              };
            }
            return sector;
          }),
        };
      })
    );
  };

  const toggleStatus = (locationId, sectorId, itemId, status) => {
    const location = locations.find((loc) => loc.id === locationId);
    const sector = location?.sectors.find((sec) => sec.id === sectorId);
    const item = sector?.items.find((it) => it.id === itemId);

    if (!item) return;

    const nextStatus = item.status === status ? 'pending' : status;
    updateItem(locationId, sectorId, itemId, { status: nextStatus });

    if (nextStatus === 'missing') {
      const actor = mockRole === 'owner' ? 'Owner' : mockRole[0].toUpperCase() + mockRole.slice(1);
      logAction(`${actor} marked ${item.name} as missing`);
      setMissingAlert(item.name);
      const liveShopper = householdMembers.shoppers.find(m => m.status === 'Live');
      const toRole = liveShopper?.invitedByRole || 'owner';
      const missingNotif = {
        id: uid(),
        type: 'missing',
        itemName: item.name,
        listName: activeLocation?.name || 'List',
        fromRole: mockRole,
        toRole,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setNotifications(prev => [missingNotif, ...prev]);
      const visibleNow = mockRole === 'owner' || (mockRole === 'writer' && toRole === 'writer');
      if (visibleNow) {
        Vibration.vibrate([0, 300, 150, 300]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNotifBanner({ text: `Missing item: ${item.name}`, type: 'missing' });
      }
    }
  };

  const cleanPrice = (value) => {
    return value.replace(/[^0-9.]/g, '');
  };

  const logAction = (text) => {
    setActivity(prev => [
      {
        id: uid(),
        text,
        time: new Date().toLocaleTimeString()
      },
      ...prev
    ]);
  };

  const handleShareList = () => {
    if (!activeLocation) {
      alert('Create a list first');
      return;
    }
    setShowSharingCenter(true);
  };

  const itemTotal = (item) => {
    if (item.unitType === 'weight') {
      const price = parseFloat(item.pricePerKg || 0);
      const weight = parseFloat(item.weight || 0);
      return price * weight;
    }

    const price = parseFloat(item.price || 0);
    return price * item.qty;
  };

  const locationTotal = (location) => {
    return location.sectors.reduce((locSum, sector) => {
      return (
        locSum +
        (sector.items || []).reduce((sectorSum, item) => {
          if (item.status !== 'cart') return sectorSum;
          return sectorSum + itemTotal(item);
        }, 0)
      );
    }, 0);
  };

  const globalTotal = locations.reduce((sum, loc) => sum + locationTotal(loc), 0);
  const repeatPurchase = (receipt) => {
    const newLocation = {
      id: uid(),
      name: receipt.locationNames?.length
        ? `${receipt.locationNames.join(' + ')} (Repeat)`
        : 'Repeat Purchase',
      color: LOCATION_COLORS[0],
      sectors: [],
    };

    const itemsToRepeat = [
      ...(receipt.bought || []),
      ...(receipt.missing || []),
    ];

    itemsToRepeat.forEach(item => {
      const key = item.sectionKey || 'general';
      const label = item.sectionLabel || item.sectionKey || 'General';

      let sector = newLocation.sectors.find(s => s.key === key);

      if (!sector) {
        sector = {
          id: uid(),
          key,
          label,
          color: '#64748b',
          items: [],
        };
        newLocation.sectors.push(sector);
      }

      sector.items.push({
        ...item,
        id: uid(),
        status: 'pending',
        price: '',
      });
    });

    setLocations(prev => [...prev, newLocation]);
    setActiveLocationId(newLocation.id);
    setActiveSectorId(newLocation.sectors[0]?.id || null);
  };
  const openRenameReceiptModal = () => {
    const autoName = locations
      .filter(loc => loc.sectors.some(sec =>
        sec.items.some(it => it.status === 'cart' || it.status === 'missing')
      ))
      .map(loc => loc.name)
      .join(', ') || 'Shopping receipt';
    setAutoReceiptNameDraft(autoName);
    setReceiptNameDraft(autoName);
    setShowRenameReceipt(true);
  };

  const finishShopping = (overrideLocationNames) => {

    const bought = [];
    const missing = [];

    locations.forEach(loc => {
      loc.sectors.forEach(sector => {
        sector.items.forEach(item => {
          if (item.status === 'cart') bought.push({ ...item, sectionKey: sector.key, sectionLabel: sector.label || sector.key });
          if (item.status === 'missing') missing.push({ ...item, sectionKey: sector.key, sectionLabel: sector.label || sector.key });
        });
      });
    });

    const total = bought.reduce((sum, item) => {
      return sum + itemTotal(item);
    }, 0);

    const locationNames = overrideLocationNames || locations
      .filter(loc => loc.sectors.some(sec =>
        sec.items.some(it => it.status === 'cart' || it.status === 'missing')
      ))
      .map(loc => loc.name);

    const receipt = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      locationNames,
      bought,
      missing,
      total
    };

    setReceipts(prev => [...prev, receipt]);
    setLocations([]);
    setActiveLocationId(null);
    setActiveSectorId(null);
    setActiveSession(null);
    clearDraft();
    setActivity([]);
  };

  if (!appReady) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#334155', fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  if (guestError) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 20 }}>
          {guestError}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.removeItem('guestSession');
            setGuestSession(null);
            setGuestError(null);
          }}
          style={{ backgroundColor: '#0A1E3C', borderWidth: 1, borderColor: '#0A63FF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 }}
        >
          <Text style={{ color: '#60a5fa', fontWeight: '800' }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (guestLoading || (guestSession && locations.length === 0)) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#60a5fa', fontSize: 16, fontWeight: '700' }}>
          Loading shared list...
        </Text>
      </View>
    );
  }

  if (guestSession && locations.length > 0 && !safeActiveLocation) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 20 }}>
          Could not open this shared list. Please ask the owner to send a new invite link.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await AsyncStorage.removeItem('guestSession');
            setGuestSession(null);
            setGuestError(null);
          }}
          style={{ backgroundColor: '#0A1E3C', borderWidth: 1, borderColor: '#0A63FF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 }}
        >
          <Text style={{ color: '#60a5fa', fontWeight: '800' }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!user && !guestSession) {
    return (
      <View style={styles.screen}>
        <View style={{ padding: 20, marginTop: 80 }}>
          <Image
            source={require('../../assets/images/listfygo-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />

          <Text style={{ color: '#94a3b8', marginBottom: 20 }}>
            Sign in to save and share your lists
          </Text>

          <TextInput
            value={authEmail}
            onChangeText={setAuthEmail}
            placeholder="Email"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Password"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={[styles.input, { marginTop: 10 }]}
          />

          <TouchableOpacity
            onPress={handleAuth}
            style={[styles.primaryButton, { marginTop: 14 }]}
          >
            <Text style={styles.primaryButtonText}>
              {authMode === 'login' ? 'Login' : 'Create account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              setAuthMode(authMode === 'login' ? 'signup' : 'login')
            }
            style={{ marginTop: 14 }}
          >
            <Text style={{ color: '#22c55e', fontWeight: '800' }}>
              {authMode === 'login'
                ? 'Create free account'
                : 'Already have an account? Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  const ownerUsers = connectedUsers.filter(u => u.role === 'owner');
  const writerUsers = connectedUsers.filter(u => u.role === 'writer');
  const shopperUsers = connectedUsers.filter(u => u.role === 'shopper');

  const firstOwner = ownerUsers[0];
  const firstWriter = writerUsers[0];
  const firstShopper = shopperUsers[0];

  const extraShoppers = Math.max(0, shopperUsers.length - 1);

  const visibleNotifs = notifications.filter(n => {
    if (mockRole === 'owner') return true;
    if (mockRole === 'writer') return n.toRole === 'writer';
    if (mockRole === 'shopper') return n.toRole === 'shopper' && n.type === 'replacement';
    return false;
  });
  const unreadCount = visibleNotifs.filter(n => !n.read).length;

  return (

    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.topBar}>

          <TouchableOpacity
            onPress={() => setShowMenu(!showMenu)}
            style={styles.topButton}
          >
            <Text style={styles.topButtonText}>☰</Text>
          </TouchableOpacity>

          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/images/listfygo-logo.png')}
              style={{ width: logoWidth, height: logoHeight }}
              resizeMode="contain"
            />
            {guestSession && (
              <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                Guest mode: {guestSession.role}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => {
              setShowNotifPanel(v => !v);
              setShowPresencePanel(false);
              if (!showNotifPanel) {
                setNotifications(prev => prev.map(n =>
                  visibleNotifs.some(vn => vn.id === n.id) ? { ...n, read: true } : n
                ));
              }
            }}
          >
            <Text style={styles.bellText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

        </View>
        {showMenu && (
          <View style={styles.menuDropdown}>

            <Text style={styles.menuSection}>Language</Text>

            <View style={styles.langRow}>
              <TouchableOpacity
                onPress={() => setLang('en')}
                style={[
                  styles.langButton,
                  lang === 'en' && styles.langButtonActive
                ]}
              >
                <Text style={styles.langButtonText}>EN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLang('pt')}
                style={[
                  styles.langButton,
                  lang === 'pt' && styles.langButtonActive
                ]}
              >
                <Text style={styles.langButtonText}>PT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLang('es')}
                style={[
                  styles.langButton,
                  lang === 'es' && styles.langButtonActive
                ]}
              >
                <Text style={styles.langButtonText}>ES</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuDivider} />

            <Text style={styles.menuSection}>Test Role</Text>
            <View style={styles.langRow}>
              {['owner', 'writer', 'shopper', 'viewer'].map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setMockRole(r)}
                  style={[styles.langButton, mockRole === r && styles.langButtonActive]}
                >
                  <Text style={styles.langButtonText}>{r[0].toUpperCase() + r.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuDivider} />
            <View style={styles.profileBox}>
              <Text style={styles.profileEmail}>
                {user?.email}
              </Text>
              <Text style={styles.profilePlan}>
                Plan: FREE
              </Text>
              <View style={styles.householdCard}>

                {guestSession ? (
                  <Text style={[styles.householdTitle, { color: '#f59e0b' }]}>
                    Guest {guestSession.role ? guestSession.role[0].toUpperCase() + guestSession.role.slice(1) : ''}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.householdTitle}>
                      {householdName}
                    </Text>

                    <Text style={styles.householdText}>Owner · {profileName}</Text>

                    {householdMembers.writers.map(m => (
                      <Text key={m.id} style={styles.householdText}>Writer · {m.name} · {m.status}</Text>
                    ))}
                    {householdMembers.shoppers.map(m => (
                      <Text key={m.id} style={styles.householdText}>Shopper · {m.name} · {m.status}</Text>
                    ))}
                    {householdMembers.viewers.map(m => (
                      <Text key={m.id} style={styles.householdText}>Viewer · {m.name} · {m.status}</Text>
                    ))}
                  </>
                )}

              </View>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setProfileNameDraft(profileName); setShowEditProfile(true); setShowMenu(false); }}
            >
              <Text style={styles.menuItemText}>Edit profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setHouseholdNameDraft(householdName); setShowRenameHousehold(true); setShowMenu(false); }}
            >
              <Text style={styles.menuItemText}>Rename household</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => {
                if (guestSession) {
                  await AsyncStorage.removeItem('guestSession');
                  setGuestSession(null);
                } else {
                  await supabase.auth.signOut();
                }
                setMockRole('owner');
                setShowMenu(false);
              }}
            >
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>
                {guestSession ? 'Exit guest mode' : 'Logout'}
              </Text>
            </TouchableOpacity>

          </View>
        )}
        {showPresencePanel && (
          <View style={styles.presencePanel}>
            <Text style={styles.presenceTitle}>Connected users</Text>

            {connectedUsers.map((u) => (
              <View key={u.id} style={styles.presenceRow}>
                <View
                  style={[
                    styles.presenceMiniDot,
                    u.role === 'owner' && styles.ownerBubble,
                    u.role === 'writer' && styles.writerBubble,
                    u.role === 'shopper' && styles.shopperBubble,
                    !u.online && styles.offlineBubble,
                  ]}
                />
                <Text style={styles.presenceName}>
                  {u.name}
                </Text>
                <Text style={[styles.presenceRole, u.status === 'Live' && { color: '#22c55e' }]}>
                  {u.role} · {u.status}
                </Text>
              </View>
            ))}
          </View>
        )}
        {showNotifPanel && (
          <View style={[styles.presencePanel, { maxHeight: 260 }]}>
            <Text style={styles.presenceTitle}>Notifications</Text>
            {visibleNotifs.length === 0 ? (
              <Text style={{ color: '#64748b', fontSize: 13 }}>No notifications</Text>
            ) : (
              visibleNotifs.map(n => (
                <View key={n.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                  <Text style={{ color: n.read ? '#64748b' : '#fca5a5', fontSize: 13, fontWeight: n.read ? '400' : '700' }}>
                    {n.type === 'replacement'
                      ? `${n.fromRole[0].toUpperCase() + n.fromRole.slice(1)} suggested ${n.itemName} for ${n.originalItemName}`
                      : n.type === 'horn'
                        ? `Shopper needs attention in ${n.listName}`
                        : `${n.fromRole[0].toUpperCase() + n.fromRole.slice(1)} marked ${n.itemName} as missing in ${n.listName}`
                    }
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
        <Text style={{ color: 'white', marginTop: 5 }}>
          {t.inProgress}
        </Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
        {mockRole !== 'owner' && (
          <View style={{ backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' }}>
            <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>
              Current role: {mockRole[0].toUpperCase() + mockRole.slice(1)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{t.totalCart}</Text>
        <Text style={styles.totalValue}>${globalTotal.toFixed(2)}</Text>
      </View>

      {notifBanner && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: notifBanner.type === 'replacement' ? '#1e3a5f' : notifBanner.type === 'horn' ? '#422006' : '#3f1d1d',
          borderWidth: 1,
          borderColor: notifBanner.type === 'replacement' ? '#0A63FF' : notifBanner.type === 'horn' ? '#f97316' : '#ef4444',
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
        }}>
          <Text style={{ color: notifBanner.type === 'replacement' ? '#93c5fd' : notifBanner.type === 'horn' ? '#fdba74' : '#fca5a5', fontWeight: '800', fontSize: 14, flex: 1 }}>
            {notifBanner.type === 'replacement' ? '↩ ' : notifBanner.type === 'horn' ? '📣 ' : '⚠ '}{notifBanner.text}
          </Text>
          <TouchableOpacity onPress={() => setNotifBanner(null)} style={{ marginLeft: 10 }}>
            <Text style={{ color: '#94a3b8', fontWeight: '900', fontSize: 18 }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {mockRole === 'shopper' && activeLocation && (
        <TouchableOpacity
          onPress={() => {
            const liveShopper = householdMembers.shoppers.find(m => m.status === 'Live');
            const toRole = liveShopper?.invitedByRole || 'owner';
            const hornNotif = {
              id: uid(),
              type: 'horn',
              message: 'Shopper needs attention',
              listName: activeLocation.name,
              fromRole: 'shopper',
              toRole,
              createdAt: new Date().toISOString(),
              read: false,
            };
            setNotifications(prev => [hornNotif, ...prev]);
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const visibleToRecipient = toRole === 'owner' || toRole === 'writer';
            setNotifBanner(visibleToRecipient
              ? { text: 'Shopper needs attention', type: 'horn' }
              : { text: '✋ Attention requested', type: 'horn' }
            );
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#422006', borderWidth: 1, borderColor: '#f97316', borderRadius: 12, paddingVertical: 12, marginBottom: 10 }}
        >
          <Text style={{ color: '#fdba74', fontWeight: '900', fontSize: 15 }}>📣  Alert Writer / Owner</Text>
        </TouchableOpacity>
      )}

      {canEdit(mockRole) && (
        <View style={styles.locationCreator}>
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t.addLocationPlaceholder}
            placeholderTextColor="#64748b"
            style={styles.input}
            onSubmitEditing={addLocation}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={addLocation}>
            <Text style={styles.primaryButtonText}>{t.addLocationButton}</Text>
          </TouchableOpacity>
        </View>
      )}

      {locations.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationBar}>
          {locations.map((loc) => (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginRight: 10
            }}>

              <TouchableOpacity
                onPress={() => {
                  setActiveLocationId(loc.id);
                  setActiveSectorId(null);
                }}
                style={[
                  styles.locationChip,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 10,
                    paddingRight: 6
                  }
                ]}
              >
                <Text style={styles.locationChipText}>
                  {loc.name}
                </Text>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    if (!canEdit(mockRole)) return;

                    setLocations(prev => prev.filter(l => l.id !== loc.id));

                    if (activeLocationId === loc.id) {
                      setActiveLocationId(null);
                      setActiveSectorId(null);
                    }
                  }}
                  style={{
                    marginLeft: 6,
                    backgroundColor: '#7f1d1d',
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>X</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {safeActiveLocation ? (
        <View style={styles.locationPanel}>
          <View style={[styles.locationTopLine, { backgroundColor: activeLocation.color }]} />

          <View style={styles.locationHeader}>
            <Text style={styles.locationTitle}>{activeLocation.name}</Text>
            <Text style={styles.locationTotal}>${locationTotal(activeLocation).toFixed(2)}</Text>
          </View>

          {missingAlert && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#3f1d1d', marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#ef4444' }}>
              <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '700', flex: 1 }}>
                ⚠ Missing item: {missingAlert}
              </Text>
              <TouchableOpacity onPress={() => setMissingAlert(null)} style={{ marginLeft: 10 }}>
                <Text style={{ color: '#fca5a5', fontWeight: '900', fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </View>
          )}

          {canEdit(mockRole) && (
          <View style={{ marginHorizontal: 14, marginBottom: 10 }}>

            <TextInput
              value={newSectorName}
              onChangeText={setNewSectorName}
              placeholder="New section"
              placeholderTextColor="#64748b"
              style={styles.input}
            />

            <TouchableOpacity
              style={{
                marginTop: 8,
                backgroundColor: '#1f2937',
                padding: 10,
                borderRadius: 10,
                alignItems: 'center'
              }}
              onPress={() => {
                const name = newSectorName.trim();
                if (!name) return;

                const newSector = {
                  id: uid(),
                  key: name.toLowerCase(),   // só chave limpa
                  label: name,               // nome real do usuário
                  color: '#64748b',
                  items: []
                };

                setLocations(prev =>
                  prev.map(loc => {
                    if (loc.id !== activeLocation.id) return loc;

                    return {
                      ...loc,
                      sectors: [...loc.sectors, newSector],
                    };
                  })
                );

                setActiveSectorId(newSector.id);
                setNewSectorName('');
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>
                + Add Section
              </Text>
            </TouchableOpacity>

          </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectorBar}>
            {activeLocation.sectors.map((sector) => (
              <TouchableOpacity
                key={sector.id}
                onPress={() => setActiveSectorId(sector.id)}
                style={[
                  styles.sectorChip,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 8,
                    paddingRight: 6
                  },
                  activeSectorId === sector.id && {
                    backgroundColor: sector.color,
                    borderColor: sector.color,
                  }
                ]}
              >

                <Text style={styles.sectorChipText}>
                  {sector.label || t.sectors?.[sector.key] || sector.key}
                </Text>

                {canEdit(mockRole) && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setEditingSector({ locationId: activeLocation.id, sectorId: sector.id });
                    setEditingSectorLabel(sector.label || sector.key);
                  }}
                  style={{
                    marginLeft: 6,
                    backgroundColor: '#1e3a5f',
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: '#60a5fa', fontWeight: '900', fontSize: 11 }}>✎</Text>
                </TouchableOpacity>
                )}

                {canEdit(mockRole) && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();

                    if (sector.items.length === 0) {
                      deleteSector(activeLocation.id, sector.id);
                      if (activeSectorId === sector.id) setActiveSectorId(null);
                    } else {
                      Alert.alert(
                        'Delete section?',
                        'This section has items. Delete it anyway?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              deleteSector(activeLocation.id, sector.id);
                              if (activeSectorId === sector.id) setActiveSectorId(null);
                            }
                          }
                        ]
                      );
                    }
                  }}
                  style={{
                    marginLeft: 6,
                    backgroundColor: '#7f1d1d',
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '900' }}>X</Text>
                </TouchableOpacity>
                )}

              </TouchableOpacity>
            ))}
          </ScrollView>

          {canEdit(mockRole) && (
          <View style={styles.composer}>
            <View style={styles.composerRow}>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder={t.itemPlaceholder}
                placeholderTextColor="#64748b"
                style={[styles.input, styles.itemInput]}
              />

              <TextInput
                value={draftQty}
                onChangeText={(value) => setDraftQty(value.replace(/[^0-9]/g, ''))}
                placeholder={t.qtyPlaceholder}
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                style={[styles.input, styles.qtyInput]}
              />
            </View>

            <TextInput
              value={draftNote}
              onChangeText={setDraftNote}
              placeholder={t.notePlaceholder}
              placeholderTextColor="#64748b"
              style={styles.input}
            />

            <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
              <Text style={styles.addItemButtonText}>{t.addItem}</Text>
            </TouchableOpacity>
          </View>
          )}

          {activeLocation.sectors.map((sector) => {
            if (sector.id !== activeSectorId) return null;

            const visibleItems = Array.isArray(sector.items) ? sector.items : [];

            return (
              <View key={sector.id} style={styles.sectorBlock}>
                <View style={styles.sectorHeader}>
                  <View style={[styles.sectorLine, { backgroundColor: sector.color }]} />

                  <Text style={styles.sectorTitle}>
                    sector.label || t.sectors?.[sector.key] || sector.key
                  </Text>

                </View>

                {visibleItems.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor:
                        item.status === 'cart'
                          ? '#052e16'
                          : item.status === 'missing'
                            ? '#3f1d1d'
                            : '#1f2937',
                      padding: 12,
                      borderRadius: 10,
                      marginTop: 10
                    }}
                  >
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <View style={{ flex: 1 }}>

                        {item.replacementFor ? (
                          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                            ↳ Replacement for: {item.replacementFor}
                          </Text>
                        ) : null}

                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                          {item.name}
                        </Text>

                        {item.description ? (
                          <Text style={{
                            color: '#94a3b8',
                            fontSize: 13,
                            marginTop: 4
                          }}>
                            {item.description}
                          </Text>
                        ) : null}

                      </View>

                      {item.unitType === 'unit' && (
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginLeft: 10,
                          marginRight: 20
                        }}>

                          {canShop(mockRole) && (
                          <TouchableOpacity
                            onPress={() =>
                              updateItem(activeLocation.id, sector.id, item.id, {
                                qty: Math.max(1, item.qty - 1),
                              })
                            }
                          >
                            <Text style={{ color: 'white', fontSize: 18 }}>-</Text>
                          </TouchableOpacity>
                          )}

                          <Text style={{
                            color: 'white',
                            marginHorizontal: 8,
                            fontWeight: '800'
                          }}>
                            {item.qty}
                          </Text>

                          {canShop(mockRole) && (
                          <TouchableOpacity
                            onPress={() =>
                              updateItem(activeLocation.id, sector.id, item.id, {
                                qty: item.qty + 1,
                              })
                            }
                          >
                            <Text style={{ color: 'white', fontSize: 18 }}>+</Text>
                          </TouchableOpacity>
                          )}

                        </View>
                      )}

                      <View style={{ flexDirection: 'row' }}>
                        {canShop(mockRole) && (
                        <TouchableOpacity
                          onPress={() => toggleStatus(activeLocation.id, sector.id, item.id, 'cart')}
                          style={{ backgroundColor: '#064e3b', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: '#22c55e' }}>🛒</Text>
                        </TouchableOpacity>
                        )}

                        {canShop(mockRole) && (
                        <TouchableOpacity
                          onPress={() => toggleStatus(activeLocation.id, sector.id, item.id, 'missing')}
                          style={{ backgroundColor: '#3f1d1d', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: '#facc15' }}>×</Text>
                        </TouchableOpacity>
                        )}

                        {canEdit(mockRole) && (
                        <TouchableOpacity
                          onPress={() => {
                            if (movingItem?.itemId === item.id) {
                              setMovingItem(null);
                            } else {
                              setMovingItem({
                                locationId: activeLocation.id,
                                sectorId: sector.id,
                                itemId: item.id
                              });
                            }
                          }}
                          style={{ backgroundColor: '#0ea5e9', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: 'white' }}>📦</Text>
                        </TouchableOpacity>
                        )}

                        {canEdit(mockRole) && (
                        <TouchableOpacity
                          onPress={() => deleteItem(activeLocation.id, sector.id, item.id)}
                          style={{ backgroundColor: '#7f1d1d', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: 'white' }}>🗑</Text>
                        </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 12
                    }}>
                      <Text style={{ color: '#22c55e', fontSize: 16, fontWeight: '800' }}>
                        ${Number(itemTotal(item) || 0).toFixed(2)}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {item.unitType === 'unit' && (
                          <TextInput
                            value={item.price}
                            editable={canShop(mockRole) && item.status === 'cart'}
                            onChangeText={(v) =>
                              updateItem(activeLocation.id, sector.id, item.id, {
                                price: cleanPrice(v)
                              })
                            }
                            placeholder="$/unit"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            style={{
                              width: 70,
                              color: 'white',
                              backgroundColor: '#111827',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 6,
                              marginRight: 6
                            }}
                          />
                        )}

                        {item.unitType === 'weight' && (
                          <>
                            <TextInput
                              value={item.weight}
                              editable={canShop(mockRole) && item.status === 'cart'}
                              onChangeText={(v) =>
                                updateItem(activeLocation.id, sector.id, item.id, {
                                  weight: v
                                })
                              }
                              placeholder="kg"
                              placeholderTextColor="#64748b"
                              keyboardType="numeric"
                              style={{
                                width: 60,
                                color: 'white',
                                backgroundColor: '#111827',
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 6,
                                marginRight: 6
                              }}
                            />

                            <TextInput
                              value={item.pricePerKg}
                              editable={canShop(mockRole) && item.status === 'cart'}
                              onChangeText={(v) =>
                                updateItem(activeLocation.id, sector.id, item.id, {
                                  pricePerKg: cleanPrice(v)
                                })
                              }
                              placeholder="$/kg"
                              placeholderTextColor="#64748b"
                              keyboardType="numeric"
                              style={{
                                width: 75,
                                color: 'white',
                                backgroundColor: '#111827',
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 6,
                                marginRight: 6
                              }}
                            />
                          </>
                        )}

                        <TouchableOpacity
                          onPress={() =>
                            updateItem(activeLocation.id, sector.id, item.id, {
                              unitType: 'unit',
                              weight: '',
                              pricePerKg: ''
                            })
                          }
                          style={{
                            backgroundColor: item.unitType === 'unit' ? '#22c55e' : '#111827',
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                            borderRadius: 6,
                            marginRight: 4
                          }}
                        >
                          <Text style={{ color: 'white', fontSize: 12, fontWeight: '800' }}>UNIT</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            updateItem(activeLocation.id, sector.id, item.id, {
                              unitType: 'weight',
                              price: ''
                            })
                          }
                          style={{
                            backgroundColor: item.unitType === 'weight' ? '#22c55e' : '#111827',
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                            borderRadius: 6
                          }}
                        >
                          <Text style={{ color: 'white', fontSize: 12, fontWeight: '800' }}>KG</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {movingItem?.itemId === item.id && (
                      <View style={{
                        marginTop: 10,
                        backgroundColor: '#111827',
                        padding: 10,
                        borderRadius: 8
                      }}>
                        <Text style={{ color: '#94a3b8', marginBottom: 6 }}>
                          Move to:
                        </Text>

                        {activeLocation.sectors.map(s => (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => {
                              moveItem(activeLocation.id, sector.id, s.id, item.id);
                              setMovingItem(null);
                            }}
                            style={{ paddingVertical: 6 }}
                          >
                            <Text style={{ color: 'white' }}>
                              {s.label || s.key}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {item.status === 'missing' && !item.linkedMissingItemId && canEdit(mockRole) && (
                      <View style={{ marginTop: 8 }}>
                        {replyingToItemId === item.id ? (
                          <View style={{ backgroundColor: '#111827', borderRadius: 8, padding: 10 }}>
                            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Replacement item:</Text>
                            <TextInput
                              value={replacementDraft}
                              onChangeText={setReplacementDraft}
                              placeholder="Replacement name..."
                              placeholderTextColor="#64748b"
                              style={{ backgroundColor: '#1f2937', color: 'white', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 }}
                              autoFocus
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                onPress={() => { setReplyingToItemId(null); setReplacementDraft(''); }}
                                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                              >
                                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => sendReplacement(activeLocation.id, sector.id, item)}
                                style={{ backgroundColor: '#0A63FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
                              >
                                <Text style={{ color: 'white', fontWeight: '900' }}>Send</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => { setReplyingToItemId(item.id); setReplacementDraft(''); }}
                            style={{ alignSelf: 'flex-start', backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                          >
                            <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Reply</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          })}
          <TouchableOpacity
            style={{
              color: '#22c55e',
              backgroundColor: '#14532d',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              fontWeight: '800',
              fontSize: 16
            }}
            onPress={() => canFinish(mockRole) && setShowFinishConfirm(true)}
          >
            <Text style={{ color: '#0f1115', fontWeight: '900' }}>
              {t.finish}
            </Text>
          </TouchableOpacity>

          {canShare(mockRole) && (
          <TouchableOpacity
            style={[styles.shareListButton, { marginHorizontal: 14, marginTop: 10, marginBottom: 14 }]}
            onPress={handleShareList}
          >
            <Text style={styles.shareListButtonText}>Share list</Text>
          </TouchableOpacity>
          )}

          {showSharingCenter && (
            <View style={[styles.sharingCenter, { marginHorizontal: 14, marginBottom: 14 }]}>

              <Text style={styles.sharingTitle}>
                Sharing Center
              </Text>

              <Text style={styles.sharingSection}>
                Writers
              </Text>

              <View style={styles.inviteRow}>
                <TextInput
                  value={inviteWriterName}
                  onChangeText={setInviteWriterName}
                  placeholder="Name or email"
                  placeholderTextColor="#64748b"
                  style={[styles.input, styles.inviteRowInput]}
                />
                <TouchableOpacity
                  style={styles.inviteRowButton}
                  onPress={() => {
                    const val = inviteWriterName.trim();
                    if (!val) { alert('Enter a name or email'); return; }
                    setHouseholdMembers(prev => ({
                      ...prev,
                      writers: [...prev.writers, { id: uid(), name: val, status: 'Pending Invite', invitedByRole: mockRole }]
                    }));
                    setInviteWriterName('');
                    setInviteRole('writer');
                    setShowSharingCenter(false);
                    setShowInviteBox(true);
                  }}
                >
                  <Text style={styles.inviteRowButtonText}>Invite writer</Text>
                </TouchableOpacity>
              </View>

              {householdMembers.writers.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={{ color: m.status === 'Live' ? '#22c55e' : '#94a3b8', fontSize: 12 }}>{m.status}</Text>
                </View>
              ))}

              <Text style={styles.sharingSection}>
                Shoppers
              </Text>

              <View style={styles.inviteRow}>
                <TextInput
                  value={inviteShopperName}
                  onChangeText={setInviteShopperName}
                  placeholder="Name or email"
                  placeholderTextColor="#64748b"
                  style={[styles.input, styles.inviteRowInput]}
                />
                <TouchableOpacity
                  style={styles.inviteRowButton}
                  onPress={() => {
                    const val = inviteShopperName.trim();
                    if (!val) { alert('Enter a name or email'); return; }
                    setHouseholdMembers(prev => ({
                      ...prev,
                      shoppers: [...prev.shoppers, { id: uid(), name: val, status: 'Pending Invite', invitedByRole: mockRole }]
                    }));
                    setInviteShopperName('');
                    setInviteRole('shopper');
                    setShowSharingCenter(false);
                    setShowInviteBox(true);
                  }}
                >
                  <Text style={styles.inviteRowButtonText}>Invite shopper</Text>
                </TouchableOpacity>
              </View>

              {householdMembers.shoppers.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={{ color: m.status === 'Live' ? '#22c55e' : '#94a3b8', fontSize: 12 }}>{m.status}</Text>
                </View>
              ))}

              <Text style={styles.sharingSection}>
                Viewers
              </Text>

              <View style={styles.inviteRow}>
                <TextInput
                  value={inviteViewerName}
                  onChangeText={setInviteViewerName}
                  placeholder="Name or email"
                  placeholderTextColor="#64748b"
                  style={[styles.input, styles.inviteRowInput]}
                />
                <TouchableOpacity
                  style={styles.inviteRowButton}
                  onPress={() => {
                    const val = inviteViewerName.trim();
                    if (!val) { alert('Enter a name or email'); return; }
                    setHouseholdMembers(prev => ({
                      ...prev,
                      viewers: [...prev.viewers, { id: uid(), name: val, status: 'Pending Invite', invitedByRole: mockRole }]
                    }));
                    setInviteViewerName('');
                    setInviteRole('viewer');
                    setShowSharingCenter(false);
                    setShowInviteBox(true);
                  }}
                >
                  <Text style={styles.inviteRowButtonText}>Invite viewer</Text>
                </TouchableOpacity>
              </View>

              {householdMembers.viewers.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={{ color: m.status === 'Live' ? '#22c55e' : '#94a3b8', fontSize: 12 }}>{m.status}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSharingCenter(false)}
              >
                <Text style={styles.closeButtonText}>
                  Close
                </Text>
              </TouchableOpacity>

            </View>
          )}

          {showInviteBox && (
            <View style={[styles.inviteBox, { marginHorizontal: 14, marginBottom: 14 }]}>
              <Text style={styles.inviteTitle}>
                Invite {inviteRole}
              </Text>

              <Text style={styles.inviteText}>
                Share this link so the person can join this list as {inviteRole}.
              </Text>

              <View style={styles.inviteLinkBox}>
                <Text style={styles.inviteLinkText} selectable>
                  https://listfygo.com/invite?role={inviteRole}&listId={activeLocationId}
                </Text>
              </View>

              {!showInviteFeedback ? (
                <TouchableOpacity
                  onPress={() => { setShowInviteFeedback(true); setInviteFeedbackDraft(''); }}
                  style={{ alignItems: 'center', marginTop: 4, marginBottom: 10 }}
                >
                  <Text style={{ color: '#475569', fontSize: 11, textDecorationLine: 'underline' }}>
                    Help us improve your sharing experience
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ marginBottom: 10, backgroundColor: '#081A33', borderRadius: 10, padding: 10 }}>
                  <TextInput
                    value={inviteFeedbackDraft}
                    onChangeText={setInviteFeedbackDraft}
                    placeholder="What would make sharing easier for you?"
                    placeholderTextColor="#475569"
                    multiline
                    style={{ color: '#e2e8f0', fontSize: 13, minHeight: 56, textAlignVertical: 'top' }}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => setShowInviteFeedback(false)}>
                      <Text style={{ color: '#64748b', fontWeight: '700', fontSize: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const text = inviteFeedbackDraft.trim();
                        if (!text) return;
                        logAction(`Feedback: ${text}`);
                        setInviteFeedbackDraft('');
                        setShowInviteFeedback(false);
                      }}
                    >
                      <Text style={{ color: '#60a5fa', fontWeight: '700', fontSize: 12 }}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={[styles.inviteActionButton, styles.copyButton]}
                  onPress={async () => {
                    const inviteLink = `https://listfygo.com/invite?role=${inviteRole}&listId=${activeLocationId}`;
                    try {
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(inviteLink);
                        Alert.alert('Copied', 'Invite link copied to clipboard.');
                      } else {
                        Alert.alert('Copy not available', 'Use Share Link to send the invite.');
                      }
                    } catch (e) {
                      Alert.alert('Copy failed', 'Use Share Link instead.');
                    }
                  }}
                >
                  <Text style={styles.inviteActionText}>Copy link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.inviteActionButton, styles.shareButton]}
                  onPress={async () => {
                    const inviteLink = `https://listfygo.com/invite?role=${inviteRole}&listId=${activeLocationId}`;
                    try {
                      await Share.share({ message: inviteLink, title: 'ListfyGo invite' });
                    } catch (e) {
                      Alert.alert('Error', e.message);
                    }
                  }}
                >
                  <Text style={styles.inviteActionText}>Share link</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInviteBox(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      ) : (
        <View style={styles.emptyState}>
          <Text style={{ color: '#94a3b8', marginTop: 8 }}>
            {t.emptyTitle}
          </Text>

          <Text style={{ color: '#64748b' }}>
            {t.emptySubtitle}
          </Text>
        </View>
      )
      }
      {mockRole === 'writer' && activeLocation && (
        <TouchableOpacity
          onPress={async () => {
            try {
              await supabase.from('shared_lists').upsert({
                id: activeLocation.id,
                owner_id: null,
                name: activeLocation.name,
                data_json: activeLocation,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' });
            } catch {
              // silently ignore — link still works
            }
            Alert.alert('List saved', 'You can now send it to the shopper.');
            setInviteRole('shopper');
            setShowSharingCenter(false);
            setShowInviteBox(true);
          }}
          style={{
            backgroundColor: '#0A1E3C',
            borderWidth: 1,
            borderColor: '#0A63FF',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 16,
            marginBottom: 4,
          }}
        >
          <Text style={{ color: '#60a5fa', fontWeight: '900', fontSize: 15 }}>
            Save and Send to Shopper
          </Text>
        </TouchableOpacity>
      )}

      {
        activity.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: 'white', fontWeight: '900', marginBottom: 6 }}>
              Activity
            </Text>

            {activity.slice(0, 10).map((a) => (
              <Text key={a.id} style={{ color: '#94a3b8', fontSize: 12 }}>
                {a.time} - {a.text}
              </Text>
            ))}
          </View>
        )
      }

      {/* 👉 HISTÓRICO */}
      {
        receipts.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: 'white', fontWeight: '900', marginBottom: 10 }}>
              {t.history}
            </Text>

            {receipts.map((r) => (
              <TouchableOpacity
                key={r.id}
                activeOpacity={0.85}
                onPress={() => setExpandedReceiptId(prev => prev === r.id ? null : r.id)}
                style={{
                  backgroundColor: '#111827',
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >

                {/* SUMMARY ROW */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>

                  {/* ESQUERDA */}
                  <View>
                    <Text style={{ color: '#22c55e', fontWeight: '800' }}>
                      Total: ${r.total.toFixed(2)}
                    </Text>

                    <Text style={{ color: '#cbd5e1', fontWeight: '700', fontSize: 13 }}>
                      {r.locationNames?.length ? r.locationNames.join(', ') : 'Shopping receipt'}
                    </Text>

                    <Text style={{ color: '#94a3b8' }}>
                      {t.bought}: {r.bought.length} | {t.missing}: {r.missing.length}
                    </Text>

                    <Text style={{ color: '#64748b', fontSize: 12 }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  {/* DIREITA (BOTÕES) */}
                  <View style={{ flexDirection: 'row' }}>

                    {/* 🔁 REUSE */}
                    <TouchableOpacity
                      onPress={() => {
                        const allIds = [
                          ...r.bought.map(it => it.id),
                          ...r.missing.map(it => it.id),
                        ];
                        setReuseReceipt(r);
                        setReuseSelectedIds(allIds);
                      }}
                      style={{
                        backgroundColor: '#2563eb',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        marginRight: 8
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '900' }}>
                        🔁
                      </Text>
                    </TouchableOpacity>

                    {/* 🗑 DELETE */}
                    <TouchableOpacity
                      onPress={() => {
                        setReceipts(prev => prev.filter(x => x.id !== r.id));
                      }}
                      style={{
                        backgroundColor: '#7f1d1d',
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '900' }}>
                        🗑
                      </Text>
                    </TouchableOpacity>

                  </View>

                </View>

                {/* EXPANDED DETAIL */}
                {expandedReceiptId === r.id && (
                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#1f2937', paddingTop: 10 }}>

                    {r.bought.length > 0 && (
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: '#22c55e', fontWeight: '900', marginBottom: 6 }}>
                          {t.bought}
                        </Text>
                        {r.bought.map(item => (
                          <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                            <Text style={{ color: '#cbd5e1', flex: 1 }}>
                              {item.name}{item.unitType === 'weight' && item.weight ? ` · ${item.weight}kg` : item.qty > 1 ? ` × ${item.qty}` : ''}
                            </Text>
                            <Text style={{ color: '#94a3b8', marginLeft: 8 }}>
                              {item.price ? `$${item.price}` : item.pricePerKg ? `$${item.pricePerKg}/kg` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {r.missing.length > 0 && (
                      <View>
                        <Text style={{ color: '#facc15', fontWeight: '900', marginBottom: 6 }}>
                          {t.missing}
                        </Text>
                        {r.missing.map(item => (
                          <View key={item.id} style={{ paddingVertical: 4 }}>
                            <Text style={{ color: '#94a3b8' }}>
                              {item.name}{item.unitType === 'weight' && item.weight ? ` · ${item.weight}kg` : item.qty > 1 ? ` × ${item.qty}` : ''}
                            </Text>
                            {item.description ? (
                              <Text style={{ color: '#64748b', fontSize: 12 }}>{item.description}</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                  </View>
                )}

              </TouchableOpacity>
            ))}
          </View>
        )
      }
      {showFinishConfirm && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>

          <View style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 380
          }}>
            <Text style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '800',
              marginBottom: 10
            }}>
              Finish shopping?
            </Text>

            <Text style={{
              color: '#94a3b8',
              marginBottom: 20
            }}>
              You can repeat this purchase later.
            </Text>

            <View style={{
              flexDirection: 'row',
              justifyContent: 'flex-end'
            }}>

              <TouchableOpacity
                onPress={() => setShowFinishConfirm(false)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginRight: 10
                }}
              >
                <Text style={{
                  color: '#94a3b8',
                  fontWeight: '700'
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const pendingCount = locations.reduce((sum, loc) =>
                    sum + loc.sectors.reduce((s2, sec) =>
                      s2 + sec.items.filter(it => it.status === 'pending').length, 0), 0);

                  setShowFinishConfirm(false);

                  if (pendingCount === 0) {
                    openRenameReceiptModal();
                  } else {
                    Alert.alert(
                      'Finish shopping?',
                      `You still have ${pendingCount} pending item(s). They will not be saved in the receipt.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Finish', style: 'destructive', onPress: openRenameReceiptModal }
                      ]
                    );
                  }
                }}
                style={{
                  backgroundColor: '#22c55e',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8
                }}
              >
                <Text style={{
                  color: '#0f1115',
                  fontWeight: '900'
                }}>
                  Finish
                </Text>
              </TouchableOpacity>

            </View>

          </View>

        </View>
      )
      }

      {editingSector && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 380
          }}>

            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 14 }}>
              Rename section
            </Text>

            <TextInput
              value={editingSectorLabel}
              onChangeText={setEditingSectorLabel}
              placeholderTextColor="#64748b"
              autoFocus
              style={[styles.input, { marginBottom: 16 }]}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>

              <TouchableOpacity
                onPress={() => {
                  setEditingSector(null);
                  setEditingSectorLabel('');
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 10, marginRight: 10 }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const newLabel = editingSectorLabel.trim();
                  if (!newLabel) { setEditingSector(null); setEditingSectorLabel(''); return; }
                  const newKey = newLabel.toLowerCase().replace(/\s+/g, '-');
                  const loc = locations.find(l => l.id === editingSector.locationId);
                  const conflict = loc?.sectors.some(
                    s => s.id !== editingSector.sectorId && s.key === newKey
                  );
                  if (conflict) {
                    Alert.alert('Section already exists');
                    return;
                  }
                  renameSector(editingSector.locationId, editingSector.sectorId, newLabel);
                  setEditingSector(null);
                  setEditingSectorLabel('');
                }}
                style={{
                  backgroundColor: '#0A63FF',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Save</Text>
              </TouchableOpacity>

            </View>

          </View>
        </View>
      )}

      {showRenameReceipt && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 380
          }}>

            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 8 }}>
              Change list name?
            </Text>

            <Text style={{ color: '#94a3b8', marginBottom: 14 }}>
              Do you want to change the receipt name before saving?
            </Text>

            <TextInput
              value={receiptNameDraft}
              onChangeText={setReceiptNameDraft}
              placeholderTextColor="#64748b"
              style={[styles.input, { marginBottom: 16 }]}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>

              <TouchableOpacity
                onPress={() => {
                  setShowRenameReceipt(false);
                  finishShopping();
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 10, marginRight: 10 }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>No</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const name = receiptNameDraft.trim() || autoReceiptNameDraft;
                  setShowRenameReceipt(false);
                  finishShopping(name ? [name] : undefined);
                }}
                style={{
                  backgroundColor: '#22c55e',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8
                }}
              >
                <Text style={{ color: '#0f1115', fontWeight: '900' }}>Yes</Text>
              </TouchableOpacity>

            </View>

          </View>
        </View>
      )}

      {reuseReceipt && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            backgroundColor: '#111827',
            borderRadius: 16,
            padding: 20,
            width: '100%',
            maxWidth: 380,
            maxHeight: '80%',
          }}>

            <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4 }}>
              Reuse List?
            </Text>

            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
              {reuseReceipt.locationNames?.length
                ? reuseReceipt.locationNames.join(', ')
                : 'Shopping receipt'}
            </Text>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>

              {reuseReceipt.bought.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#22c55e', fontWeight: '900', marginBottom: 6 }}>Bought</Text>
                  {reuseReceipt.bought.map(item => {
                    const selected = reuseSelectedIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setReuseSelectedIds(prev =>
                          prev.includes(item.id)
                            ? prev.filter(x => x !== item.id)
                            : [...prev, item.id]
                        )}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          paddingHorizontal: 4,
                          borderRadius: 8,
                          backgroundColor: selected ? '#052e16' : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ color: selected ? '#22c55e' : '#334155', fontWeight: '900', marginRight: 10, fontSize: 16 }}>
                          {selected ? '☑' : '☐'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: selected ? 'white' : '#64748b', fontWeight: '700' }}>
                            {item.name}
                          </Text>
                          <Text style={{ color: '#64748b', fontSize: 12 }}>
                            {item.unitType === 'weight' && item.weight
                              ? `${item.weight}kg`
                              : item.qty > 1 ? `×${item.qty}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {reuseReceipt.missing.length > 0 && (
                <View>
                  <Text style={{ color: '#facc15', fontWeight: '900', marginBottom: 6 }}>Missing</Text>
                  {reuseReceipt.missing.map(item => {
                    const selected = reuseSelectedIds.includes(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setReuseSelectedIds(prev =>
                          prev.includes(item.id)
                            ? prev.filter(x => x !== item.id)
                            : [...prev, item.id]
                        )}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          paddingHorizontal: 4,
                          borderRadius: 8,
                          backgroundColor: selected ? '#1c1007' : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <Text style={{ color: selected ? '#facc15' : '#334155', fontWeight: '900', marginRight: 10, fontSize: 16 }}>
                          {selected ? '☑' : '☐'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: selected ? 'white' : '#64748b', fontWeight: '700' }}>
                            {item.name}
                          </Text>
                          <Text style={{ color: '#64748b', fontSize: 12 }}>
                            {item.unitType === 'weight' && item.weight
                              ? `${item.weight}kg`
                              : item.qty > 1 ? `×${item.qty}` : ''}
                            {item.description ? `  ${item.description}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>

              <TouchableOpacity
                onPress={() => {
                  setReuseReceipt(null);
                  setReuseSelectedIds([]);
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 10, marginRight: 10 }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>No</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const allReuseItems = [
                    ...(reuseReceipt.bought || []),
                    ...(reuseReceipt.missing || []),
                  ];
                  const selectedItems = allReuseItems.filter(it => reuseSelectedIds.includes(it.id));
                  if (selectedItems.length === 0) {
                    Alert.alert('Select at least one item');
                    return;
                  }
                  const filteredReceipt = {
                    ...reuseReceipt,
                    bought: selectedItems,
                    missing: [],
                  };
                  repeatPurchase(filteredReceipt);
                  setReuseReceipt(null);
                  setReuseSelectedIds([]);
                }}
                style={{
                  backgroundColor: '#0A63FF',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Yes</Text>
              </TouchableOpacity>

            </View>

          </View>
        </View>
      )}

      {showEditProfile && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 20, width: '100%' }}>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, marginBottom: 14 }}>Edit Profile</Text>
            <TextInput
              value={profileNameDraft}
              onChangeText={setProfileNameDraft}
              placeholder="Your name"
              placeholderTextColor="#64748b"
              style={{ backgroundColor: '#1f2937', color: 'white', borderRadius: 10, padding: 12, marginBottom: 14 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowEditProfile(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (profileNameDraft.trim()) setProfileName(profileNameDraft.trim()); setShowEditProfile(false); }}
                style={{ backgroundColor: '#0A63FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showRenameHousehold && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 20, width: '100%' }}>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, marginBottom: 14 }}>Rename Household</Text>
            <TextInput
              value={householdNameDraft}
              onChangeText={setHouseholdNameDraft}
              placeholder="Household name"
              placeholderTextColor="#64748b"
              style={{ backgroundColor: '#1f2937', color: 'white', borderRadius: 10, padding: 12, marginBottom: 14 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity onPress={() => setShowRenameHousehold(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (householdNameDraft.trim()) setHouseholdName(householdNameDraft.trim()); setShowRenameHousehold(false); }}
                style={{ backgroundColor: '#0A63FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: 'white', fontWeight: '900' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </ScrollView >
  );
}

export default function WrappedApp() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 0,
    marginBottom: 20,
    backgroundColor: '#071B38',
    borderBottomWidth: 1,
    borderBottomColor: '#123768',
    shadowColor: '#1D9BFF',
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },

  topButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellText: {
    fontSize: 22,
  },

  topButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
  },

  presenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },

  presenceFlow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  presenceDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },

  presenceLine: {
    width: 16,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 4,
  },
  screen: {
    flex: 1,
    backgroundColor: '#041224',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  header: {
    marginBottom: 14,
  },
  logo: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerLogo: {
    width: 220,
    height: 60,
    alignSelf: 'center',
    marginBottom: 16,
  },

  subtitle: {
    color: '#94a3b8',
    marginTop: 2,
  },
  totalCard: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#123768',
    shadowColor: '#1D9BFF',
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  totalLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  totalValue: {
    color: '#22c55e',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 3,
  },
  locationCreator: {
    gap: 8,
  },
  input: {
    backgroundColor: '#081A33',
    borderWidth: 1,
    borderColor: '#123768',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#0A63FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#1D9BFF',
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  locationBar: {
    marginTop: 14,
    marginBottom: 10,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#111827',
  },
  locationChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  locationPanel: {
    marginTop: 8,
    backgroundColor: '#0b1728',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#173154',
    overflow: 'hidden',
  },
  locationTopLine: {
    height: 6,
  },
  locationHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  locationTotal: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: '900',
  },
  sectorBar: {
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sectorChip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#111827',
  },
  sectorChipText: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 12,
  },
  composer: {
    padding: 14,
    borderTopWidth: 1,
    borderColor: '#27344a',
    gap: 8,
  },
  composerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  itemInput: {
    flex: 1,
  },
  qtyInput: {
    width: 76,
    textAlign: 'center',
  },
  addItemButton: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  presenceUsers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },

  userBubble: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
    borderWidth: 1,
    borderColor: '#ffffff55',
  },

  ownerBubble: {
    backgroundColor: '#2563eb',
  },

  writerBubble: {
    backgroundColor: '#22c55e',
  },

  shopperBubble: {
    backgroundColor: '#f97316',
  },

  offlineBubble: {
    backgroundColor: '#334155',
  },

  userBubbleText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
  },

  extraBadge: {
    position: 'absolute',
    right: -7,
    bottom: -7,
    backgroundColor: '#0A63FF',
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },

  extraBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
  },

  presencePanel: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },

  presenceTitle: {
    color: 'white',
    fontWeight: '900',
    marginBottom: 8,
  },

  presenceName: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 4,
  },
  menuDropdown: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  menuSection: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '700',
  },

  langRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  langButton: {
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#081A33',
  },

  langButtonActive: {
    backgroundColor: '#0A63FF',
  },

  langButtonText: {
    color: 'white',
    fontWeight: '800',
  },

  menuDivider: {
    height: 1,
    backgroundColor: '#123768',
    marginVertical: 10,
  },

  menuItem: {
    paddingVertical: 10,
  },

  menuItemText: {
    color: 'white',
    fontWeight: '700',
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },

  presenceMiniDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 8,
  },

  presenceRole: {
    color: '#64748b',
    fontSize: 12,
    marginLeft: 'auto',
  },
  profileBox: {
    backgroundColor: '#081A33',
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },

  profileEmail: {
    color: 'white',
    fontWeight: '800',
    fontSize: 13,
  },

  profilePlan: {
    color: '#22c55e',
    fontWeight: '900',
    fontSize: 12,
    marginTop: 4,
  },
  householdCard: {
    backgroundColor: '#081A33',
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },

  householdTitle: {
    color: 'white',
    fontWeight: '900',
    marginBottom: 8,
  },

  householdText: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 4,
  },
  inviteBox: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },

  inviteTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'capitalize',
  },

  inviteText: {
    color: '#94a3b8',
    marginBottom: 14,
  },

  inviteLinkBox: {
    backgroundColor: '#081A33',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },

  inviteLinkText: {
    color: '#cbd5e1',
    fontSize: 12,
    textAlign: 'center',
  },

  inviteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 14,
  },

  inviteActionText: {
    color: '#ffffff',
    fontWeight: '900',
    textAlign: 'center',
  },


  inviteActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  copyButton: {
    backgroundColor: '#0A63FF',
  },

  shareButton: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#0A63FF',
  },

  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },

  closeButtonText: {
    color: '#94a3b8',
    fontWeight: '900',
  },

  listActions: {
    marginTop: 18,
    marginBottom: 10,
  },

  shareListButton: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#0A63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',

    shadowColor: '#1D9BFF',
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },

  shareListButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },
  sharingCenter: {
    backgroundColor: '#0A1E3C',
    borderWidth: 1,
    borderColor: '#123768',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  sharingTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
  },

  sharingSection: {
    color: '#94a3b8',
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 8,
  },

  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#081A33',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },

  memberName: {
    color: 'white',
    fontWeight: '800',
  },

  addMemberButton: {
    borderWidth: 1,
    borderColor: '#0A63FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },

  addMemberText: {
    color: '#60a5fa',
    fontWeight: '900',
  },

  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },

  inviteRowInput: {
    flex: 1,
  },

  inviteRowButton: {
    backgroundColor: '#0A63FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  inviteRowButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
});