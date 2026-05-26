import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { uploadPhoto } from '../lib/uploadUtils';

const BUCKET = 'city-images';

export default function AddCityModal({ isOpen, onClose, onCityAdded }) {
  const [mode, setMode] = useState('add'); // 'add' | 'manage'
  const [cityName, setCityName] = useState('');
  const [description, setDescription] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [message, setMessage] = useState('');

  // 管理模式状态
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [cityImages, setCityImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);

  // 加载城市列表
  useEffect(() => {
    if (isOpen) loadCities();
  }, [isOpen]);

  const loadCities = async () => {
    const { data } = await supabase.from('cities').select('*').order('sort_order');
    if (data) setCities(data);
  };

  const loadCityImages = async (cityId) => {
    const { data } = await supabase.from('city_images').select('*').eq('city_id', cityId).order('sort_order');
    if (data) setCityImages(data);
  };

  // ========== 添加模式 ==========
  const handleGeocode = async () => {
    if (!cityName.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'zh-CN,zh' } }
      );
      const data = await res.json();
      if (data?.length > 0) {
        setLng(parseFloat(data[0].lon).toFixed(4));
        setLat(parseFloat(data[0].lat).toFixed(4));
      }
    } catch (err) { console.error('Geocode failed:', err); }
    setGeocoding(false);
  };

  const handleSubmit = async () => {
    if (!cityName.trim() || !lng || !lat) return;
    setLoading(true);
    setMessage('');
    try {
      // 去重：检查是否已存在同名城市
      const { data: existing } = await supabase.from('cities').select('id').ilike('name', cityName.trim()).maybeSingle();
      if (existing) {
        setMessage('❌ 该城市已存在，请勿重复添加');
        setLoading(false);
        return;
      }

      let imageUrl = '';
      let imageRecords = [];
      if (images.length > 0) {
        for (const img of images) {
          const result = await uploadPhoto(img);
          imageRecords.push({ url: result.url, taken_at: result.takenAt });
        }
        imageUrl = imageRecords[0].url;
      }

      const { data: maxOrder } = await supabase.from('cities').select('sort_order').order('sort_order', { ascending: false }).limit(1);
      const nextOrder = (maxOrder?.[0]?.sort_order || 0) + 1;

      const { data: cityData, error } = await supabase.from('cities').insert({
        name: cityName.trim(), description: description.trim() || null,
        main_image: imageUrl || null, lng: parseFloat(lng), lat: parseFloat(lat), sort_order: nextOrder,
      }).select().single();

      if (error) throw error;

      if (imageRecords.length > 0 && cityData) {
        const records = imageRecords.map((r, idx) => ({
          city_id: cityData.id, url: r.url, sort_order: idx, taken_at: r.taken_at,
        }));
        await supabase.from('city_images').insert(records);
      }

      setMessage('✅ 添加成功！');
      resetForm();
      if (onCityAdded) onCityAdded();
      setTimeout(() => { setMessage(''); onClose(); }, 1500);
    } catch (err) {
      setMessage(`❌ 失败: ${err.message}`);
    }
    setLoading(false);
  };

  // ========== 管理模式 ==========
  const handleSelectCity = async (city) => {
    setSelectedCity(city);
    setNewImages([]);
    setNewImagePreviews([]);
    await loadCityImages(city.id);
  };

  const handleBatchImageSelect = (e) => {
    const files = Array.from(e.target.files);
    setNewImages(files);
    setNewImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleBatchUpload = async () => {
    if (!selectedCity || newImages.length === 0) return;
    setLoading(true);
    setMessage('');
    try {
      const results = [];
      for (let i = 0; i < newImages.length; i++) {
        results.push(await uploadPhoto(newImages[i]));
      }

      const records = results.map((r, idx) => ({
        city_id: selectedCity.id,
        url: r.url,
        sort_order: cityImages.length + idx,
        taken_at: r.takenAt,
      }));

      const { error } = await supabase.from('city_images').insert(records);
      if (error) throw error;

      // 更新 main_image 如果还没有
      if (!selectedCity.main_image && results.length > 0) {
        await supabase.from('cities').update({ main_image: results[0].url }).eq('id', selectedCity.id);
      }

      setMessage(`✅ 成功上传 ${results.length} 张照片`);
      setNewImages([]);
      setNewImagePreviews([]);
      await loadCityImages(selectedCity.id);
      await loadCities();
      if (onCityAdded) onCityAdded();
    } catch (err) {
      setMessage(`❌ 上传失败: ${err.message}`);
    }
    setLoading(false);
  };

  const handleDeleteCity = async () => {
    if (!selectedCity) return;
    if (!window.confirm(`确定要删除「${selectedCity.name}」及其所有照片吗？`)) return;
    setLoading(true);
    try {
      // 先获取所有照片路径用于 storage 清理
      const { data: imgs } = await supabase.from('city_images').select('url').eq('city_id', selectedCity.id);
      const paths = (imgs || []).map(i => i.url.split('/').pop()).filter(Boolean);

      // 删除关联的照片记录
      const { error: imgError } = await supabase.from('city_images').delete().eq('city_id', selectedCity.id);
      if (imgError) throw imgError;

      // 删除城市
      const { error } = await supabase.from('cities').delete().eq('id', selectedCity.id);
      if (error) throw error;

      // 清理 storage 文件（不阻塞提示）
      if (paths.length > 0) {
        supabase.storage.from(BUCKET).remove(paths).then(
          () => console.log(`已清理 ${paths.length} 个 storage 文件`),
          (e) => console.error('Storage 清理失败:', e)
        );
      }

      setMessage(`✅ 已删除「${selectedCity.name}」`);
      setSelectedCity(null);
      setCityImages([]);
      await loadCities();
      if (onCityAdded) onCityAdded();
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage(`❌ 删除失败: ${err.message}`);
    }
    setLoading(false);
  };

  const handleDeleteFromList = async (e, city) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除「${city.name}」及其所有照片吗？`)) return;
    // 先删关联图片，再删城市
    await supabase.from('city_images').delete().eq('city_id', city.id);
    await supabase.from('cities').delete().eq('id', city.id);
    await loadCities();
    if (onCityAdded) onCityAdded();
  };

  const handleDeleteImage = async (img) => {
    if (!confirm('删除这张照片？')) return;
    const { error } = await supabase.from('city_images').delete().eq('id', img.id);
    if (!error) {
      setCityImages(prev => prev.filter(i => i.id !== img.id));
      // 清理 storage 文件
      const path = img.url.split('/').pop();
      if (path) supabase.storage.from(BUCKET).remove([path]);
      // 如果删的是封面图，更新封面
      if (selectedCity.main_image === img.url && cityImages.length > 1) {
        const nextImage = cityImages.find(i => i.id !== img.id);
        if (nextImage) {
          await supabase.from('cities').update({ main_image: nextImage.url }).eq('id', selectedCity.id);
        }
      }
    }
  };

  const resetForm = () => {
    setCityName(''); setDescription(''); setLng(''); setLat('');
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImages([]); setImagePreviews([]); setMessage('');
  };

  const switchToAdd = () => {
    setMode('add');
    setSelectedCity(null);
    resetForm();
  };

  // ========== 渲染 ==========
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { if (!loading) onClose(); }} style={overlayStyle}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()} style={modalStyle}>

            {/* Header */}
            <div style={headerStyle}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
                  {mode === 'add' ? '🌍 添加地点' : selectedCity ? `📍 ${selectedCity.name}` : '📋 地点管理'}
                </h2>
                {mode === 'manage' && (
                  <button onClick={switchToAdd} style={switchBtnStyle}>＋ 新建</button>
                )}
                {mode === 'add' && (
                  <button onClick={() => setMode('manage')} style={switchBtnStyle}>📋 管理</button>
                )}
              </div>
              <button onClick={onClose} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ padding: '0 24px 24px', maxHeight: '70vh', overflowY: 'auto' }}>

              {/* ====== 添加模式 ====== */}
              {mode === 'add' && (
                <>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>城市名称</label>
                    <div style={{ position: 'relative' }}>
                      <input value={cityName} onChange={(e) => setCityName(e.target.value)}
                        onBlur={handleGeocode} placeholder="输入城市名（如：杭州）" style={inputStyle} />
                      {geocoding && <span style={loadingStyle}>定位中...</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                      <label style={labelStyle}>经度</label>
                      <input value={lng} onChange={(e) => setLng(e.target.value)} style={inputStyle} placeholder="自动获取" />
                    </div>
                    <div style={{ ...fieldStyle, flex: 1 }}>
                      <label style={labelStyle}>纬度</label>
                      <input value={lat} onChange={(e) => setLat(e.target.value)} style={inputStyle} placeholder="自动获取" />
                    </div>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>描述</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="例如：2024年夏天一起去过" style={inputStyle} />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>照片 ({images.length > 0 ? `已选 ${images.length} 张` : '可批量选择，第一张为封面'})</label>
                    <input type="file" multiple accept="image/*" onChange={(e) => {
                      const files = Array.from(e.target.files);
                      if (files.length === 0) return;
                      imagePreviews.forEach(url => URL.revokeObjectURL(url));
                      setImages(prev => [...prev, ...files]);
                      setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
                      e.target.value = '';
                    }} style={{ fontSize: '14px', color: 'white' }} />
                    {imagePreviews.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {imagePreviews.map((preview, i) => (
                          <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
                            <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {i === 0 && (
                              <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(102,126,234,0.9)', color: 'white', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 600 }}>封面</span>
                            )}
                            <button onClick={() => {
                              URL.revokeObjectURL(preview);
                              setImages(prev => prev.filter((_, idx) => idx !== i));
                              setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
                            }} style={{
                              position: 'absolute', top: '2px', right: '2px',
                              width: '18px', height: '18px', borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                              fontSize: '11px', cursor: 'pointer', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                            }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {message && <MessageBox message={message} />}
                  <button onClick={handleSubmit} disabled={!cityName || !lng || !lat || loading}
                    style={primaryBtnStyle(!cityName || !lng || !lat || loading)}>
                    {loading ? '⏳ 保存中...' : '🚀 添加地点'}
                  </button>
                </>
              )}

              {/* ====== 管理模式 ====== */}
              {mode === 'manage' && !selectedCity && (
                <>
                  <p style={{ opacity: 0.6, marginBottom: '16px', fontSize: '14px' }}>点击城市进行管理</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cities.map(city => (
                      <div key={city.id} style={{ ...cityListItemStyle, overflow: 'visible' }}>
                        <div onClick={() => handleSelectCity(city)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', minWidth: 0 }}>
                          {city.main_image ? (
                            <img src={city.main_image} alt="" style={cityListImgStyle} />
                          ) : (
                            <div style={cityListPlaceholderStyle}>📍</div>
                          )}
                          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{city.name}</div>
                            <div style={{ fontSize: '12px', opacity: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city.description || '—'}</div>
                          </div>
                        </div>
                        <button onClick={(e) => handleDeleteFromList(e, city)}
                          style={{
                            background: 'rgba(244,67,54,0.2)', border: '1px solid rgba(244,67,54,0.4)',
                            color: '#f44336', padding: '4px 10px', borderRadius: '6px',
                            cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap',
                          }}
                        >删除</button>
                      </div>
                    ))}
                    {cities.length === 0 && <p style={{ opacity: 0.4, textAlign: 'center', padding: '40px 0' }}>暂无地点</p>}
                  </div>
                </>
              )}

              {/* ====== 城市详情管理 ====== */}
              {mode === 'manage' && selectedCity && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <button onClick={() => setSelectedCity(null)} style={backBtnStyle}>← 返回列表</button>
                    <button onClick={handleDeleteCity} disabled={loading} style={deleteBtnStyle}>
                      🗑️ 删除地点
                    </button>
                  </div>

                  {/* 现有照片 */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>现有照片 ({cityImages.length})</label>
                    {cityImages.length === 0 ? (
                      <p style={{ opacity: 0.4, fontSize: '13px' }}>暂无照片</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                        {cityImages.map(img => (
                          <div key={img.id} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => handleDeleteImage(img)} style={delImgBtnStyle}>×</button>
                            {img.url === selectedCity.main_image && (
                              <span style={coverBadgeStyle}>封面</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 批量上传 */}
                  <div style={{ ...fieldStyle, paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <label style={labelStyle}>批量上传新照片</label>
                    <input type="file" multiple accept="image/*" onChange={handleBatchImageSelect}
                      style={{ fontSize: '14px', color: 'white', marginBottom: '10px' }} />
                    {newImagePreviews.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {newImagePreviews.map((preview, i) => (
                          <div key={i} style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
                            <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={handleBatchUpload} disabled={newImages.length === 0 || loading}
                      style={primaryBtnStyle(newImages.length === 0 || loading)}>
                      {loading ? '⏳ 上传中...' : `📤 上传 ${newImages.length} 张照片`}
                    </button>
                  </div>

                  {message && <MessageBox message={message} />}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ========== 组件样式 ==========
function MessageBox({ message }) {
  const isSuccess = message.includes('✅');
  return (
    <div style={{
      padding: '12px', borderRadius: '8px',
      background: isSuccess ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
      color: isSuccess ? '#81c784' : '#e57373',
      marginBottom: '16px', textAlign: 'center', fontSize: '14px',
    }}>{message}</div>
  );
}

function primaryBtnStyle(disabled) {
  return {
    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
    background: disabled ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', fontSize: '16px', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px', backdropFilter: 'blur(4px)',
};
const modalStyle = {
  background: 'rgba(20, 25, 40, 0.98)', borderRadius: '20px',
  maxWidth: '520px', width: '100%', border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 25px 60px rgba(0,0,0,0.5)', color: 'white',
};
const headerStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const closeBtnStyle = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
  fontSize: '20px', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px',
};
const switchBtnStyle = {
  background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.8)',
  padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px',
};
const fieldStyle = { marginBottom: '16px' };
const labelStyle = {
  display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)',
  marginBottom: '6px', fontWeight: 500,
};
const inputStyle = {
  width: '100%', padding: '12px 14px', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none',
};
const loadingStyle = {
  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
  fontSize: '12px', color: '#4ECDC4',
};
const cityListItemStyle = {
  display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 14px',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px', cursor: 'pointer', color: 'white', textAlign: 'left',
  transition: 'all 0.2s',
};
const cityListImgStyle = {
  width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0,
};
const cityListPlaceholderStyle = {
  width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  fontSize: '18px',
};
const backBtnStyle = {
  background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white',
  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
};
const deleteBtnStyle = {
  background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.3)',
  color: '#e57373', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
};
const delImgBtnStyle = {
  position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px',
  background: 'rgba(244,67,54,0.8)', border: 'none', color: 'white', borderRadius: '50%',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '14px', lineHeight: '1',
};
const coverBadgeStyle = {
  position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(255,215,0,0.9)',
  color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
};
