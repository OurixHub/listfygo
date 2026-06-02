import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { translations } from '../../i18n';

const STORAGE_KEY = 'shopix_clean_v2';

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

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

export default function App() {

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

  // função para trocar idioma
  const changeLang = (newLang) => {
    setLang(newLang);
    AsyncStorage.setItem('lang', newLang);
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
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {



        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // formato antigo
            setLocations(parsed);
            setReceipts([]);
          } else if (parsed.locations) {
            // formato novo
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

  useEffect(() => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        locations,
        receipts
      })
    ).catch(() => { });
  }, [locations, receipts]);

  const activeLocation = useMemo(
    () => locations.find((loc) => loc.id === activeLocationId) || null,
    [locations, activeLocationId]
  );

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

    updateItem(locationId, sectorId, itemId, {
      status: item.status === status ? 'pending' : status,
    });
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
        sector.items.reduce((sectorSum, item) => {
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
      name: 'Repeat Purchase',
      color: LOCATION_COLORS[0],
      sectors: []
    };

    // recriar setores baseado nos itens
    receipt.bought.forEach(item => {
      let sector = newLocation.sectors.find(s => s.key === item.section);

      if (!sector) {
        sector = {
          id: uid(),
          key: item.section || 'general',
          color: '#64748b',
          items: []
        };
        newLocation.sectors.push(sector);
      }

      sector.items.push({
        ...item,
        id: uid(),
        status: 'pending',
        price: ''
      });
    });

    setLocations([newLocation]);
    setActiveLocationId(newLocation.id);
  };
  const finishShopping = () => {

    const bought = [];
    const missing = [];

    locations.forEach(loc => {
      loc.sectors.forEach(sector => {
        sector.items.forEach(item => {
          if (item.status === 'cart') bought.push(item);
          if (item.status === 'missing') missing.push(item);
        });
      });
    });

    const total = bought.reduce((sum, item) => {
      return sum + itemTotal(item);
    }, 0);

    const receipt = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
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
  return (

    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>SHOPIX</Text>

        <View style={{ flexDirection: 'row', marginVertical: 10 }}>

          <TouchableOpacity onPress={() => changeLang('en')} style={{ marginRight: 8 }}>
            <Text style={{
              color: lang === 'en' ? '#0f1115' : 'white',
              backgroundColor: lang === 'en' ? '#22c55e' : 'transparent',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#334155',
              fontWeight: '700'
            }}>
              EN
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => changeLang('pt')} style={{ marginRight: 8 }}>
            <Text style={{
              color: lang === 'pt' ? '#0f1115' : 'white',
              backgroundColor: lang === 'pt' ? '#22c55e' : 'transparent',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#334155',
              fontWeight: '700'
            }}>
              PT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => changeLang('es')}>
            <Text style={{
              color: lang === 'es' ? '#0f1115' : 'white',
              backgroundColor: lang === 'es' ? '#22c55e' : 'transparent',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#334155',
              fontWeight: '700'
            }}>
              ES
            </Text>
          </TouchableOpacity>

        </View>

        <Text style={{ color: 'white', marginTop: 5 }}>
          {t.inProgress}
        </Text>
        <Text style={styles.subtitle}>{t.subtitle}</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{t.totalCart}</Text>
        <Text style={styles.totalValue}>${globalTotal.toFixed(2)}</Text>
      </View>

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

      {activeLocation ? (
        <View style={styles.locationPanel}>
          <View style={[styles.locationTopLine, { backgroundColor: activeLocation.color }]} />

          <View style={styles.locationHeader}>
            <Text style={styles.locationTitle}>{activeLocation.name}</Text>
            <Text style={styles.locationTotal}>${locationTotal(activeLocation).toFixed(2)}</Text>
          </View>

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

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();

                    deleteSector(activeLocation.id, sector.id);

                    if (activeSectorId === sector.id) {
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
            ))}
          </ScrollView>

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

          {activeLocation.sectors.map((sector) => {
            if (sector.id !== activeSectorId) return null;

            const visibleItems = sector.items;

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

                          <TouchableOpacity
                            onPress={() =>
                              updateItem(activeLocation.id, sector.id, item.id, {
                                qty: Math.max(1, item.qty - 1),
                              })
                            }
                          >
                            <Text style={{ color: 'white', fontSize: 18 }}>-</Text>
                          </TouchableOpacity>

                          <Text style={{
                            color: 'white',
                            marginHorizontal: 8,
                            fontWeight: '800'
                          }}>
                            {item.qty}
                          </Text>

                          <TouchableOpacity
                            onPress={() =>
                              updateItem(activeLocation.id, sector.id, item.id, {
                                qty: item.qty + 1,
                              })
                            }
                          >
                            <Text style={{ color: 'white', fontSize: 18 }}>+</Text>
                          </TouchableOpacity>

                        </View>
                      )}

                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity
                          onPress={() => toggleStatus(activeLocation.id, sector.id, item.id, 'cart')}
                          style={{ backgroundColor: '#064e3b', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: '#22c55e' }}>🛒</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => toggleStatus(activeLocation.id, sector.id, item.id, 'missing')}
                          style={{ backgroundColor: '#3f1d1d', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: '#facc15' }}>×</Text>
                        </TouchableOpacity>

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

                        <TouchableOpacity
                          onPress={() => deleteItem(activeLocation.id, sector.id, item.id)}
                          style={{ backgroundColor: '#7f1d1d', padding: 8, borderRadius: 8, marginLeft: 6 }}
                        >
                          <Text style={{ color: 'white' }}>🗑</Text>
                        </TouchableOpacity>
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
                            editable={item.status === 'cart'}
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
                              editable={item.status === 'cart'}
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
                              editable={item.status === 'cart'}
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
            onPress={() => setShowFinishConfirm(true)}
          >
            <Text style={{ color: '#0f1115', fontWeight: '900' }}>
              {t.finish}
            </Text>
          </TouchableOpacity>
        </View>

      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t.emptyTitle}</Text>
          <Text style={styles.emptyText}>{t.emptyText}</Text>
        </View>
      )
      }
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
              <View
                key={r.id}
                style={{
                  backgroundColor: '#111827',
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >

                {/* ESQUERDA */}
                <View>
                  <Text style={{ color: '#22c55e', fontWeight: '800' }}>
                    Total: ${r.total.toFixed(2)}
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

                  {/* 🔁 REPEAT */}
                  <TouchableOpacity
                    onPress={() => repeatPurchase(r)}
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
                  setShowFinishConfirm(false);
                  finishShopping();
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
      )}
    </ScrollView >
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1115',
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
  subtitle: {
    color: '#94a3b8',
    marginTop: 2,
  },
  totalCard: {
    backgroundColor: '#171b24',
    borderWidth: 1,
    borderColor: '#263044',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
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
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#2f3a4f',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
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
    backgroundColor: '#151a23',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27344a',
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
});