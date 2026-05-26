import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { uploadPhoto } from '../lib/uploadUtils';
import { generateDayMemories } from '../lib/memoryService';

export default function CityDetail({ cityName, goBack }) {
  const [scrollY, setScrollY] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentCity, setCurrentCity] = useState({ mainImage: '', description: '', gallery: [], galleryData: [] });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadMsg, setUploadMsg] = useState('');
  const [deletingUrl, setDeletingUrl] = useState(null);
  const [editingTimeUrl, setEditingTimeUrl] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [memories, setMemories] = useState({});
  const [genMemDate, setGenMemDate] = useState(null);
  const [activeSection, setActiveSection] = useState('hero');
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragIdxRef = useRef(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimerRef = useRef(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const progressRef = useRef({ current: 0, total: 0, lastUpdate: 0 });

  // Hero 轮播图片列表
  const heroPhotos = useMemo(() => {
    const all = currentCity.mainImage
      ? [currentCity.mainImage, ...currentCity.gallery.filter(u => u !== currentCity.mainImage)]
      : currentCity.gallery;
    return all.slice(0, 5);
  }, [currentCity.mainImage, currentCity.gallery]);

  // 从 Supabase 加载城市数据
  useEffect(() => {
    const loadCityData = async () => {
      console.log(`[CityDetail] Loading data for city: "${cityName}"`);
      setLoading(true);
      try {
        console.log(`[CityDetail] Fetching city metadata for name: "${cityName.trim()}"`);
        const { data: cityData, error: cityError } = await supabase
          .from('cities')
          .select('*')
          .eq('name', cityName.trim())
          .single();

        if (cityError || !cityData) {
          console.error(`[CityDetail] Failed to load city "${cityName}":`, cityError);
          setLoading(false);
          return;
        }

        console.log(`[CityDetail] City found:`, cityData);

        const { data: imagesData, error: imagesError } = await supabase
          .from('city_images')
          .select('*')
          .eq('city_id', cityData.id)
          .order('sort_order', { ascending: true });

        if (imagesError) {
          console.error(`[CityDetail] Failed to load images for city ID ${cityData.id}:`, imagesError);
        } else {
          console.log(`[CityDetail] Successfully fetched ${imagesData?.length || 0} images for city ID ${cityData.id}:`, imagesData);
        }

        const imgs = imagesData || [];

        // 加载回忆（表可能还不存在）
        try {
          const { data: memData } = await supabase.from('city_memories').select('date, text').eq('city_id', cityData.id);
          const memMap = {};
          if (memData) memData.forEach(m => { memMap[m.date] = m.text; });
          setMemories(memMap);
        } catch { /* 表不存在则跳过 */ }

        setCurrentCity({
          id: cityData.id,
          mainImage: cityData.main_image,
          description: cityData.description || '',
          departure: cityData.departure || '',
          lng: cityData.lng,
          lat: cityData.lat,
          gallery: imgs.map(img => img.url),
          galleryData: imgs.map(img => {
            const localNote = (() => { try { return localStorage.getItem(`note_${cityData.id}_${img.url}`) || ''; } catch { return ''; } })();
            return { url: img.url, takenAt: img.taken_at, note: img.note || localNote };
          }),
        });
      } catch (e) {
        console.error(`[CityDetail] Unexpected error loading city "${cityName}":`, e);
      }
      setLoading(false);
    };

    if (cityName) {
      loadCityData();
    }
  }, [cityName]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsDarkMode(currentScrollY < window.innerHeight);

      // 检测当前在哪个区域
      const gallery = document.getElementById('gallery-section');
      const timeline = document.getElementById('timeline-section');
      if (timeline && currentScrollY >= timeline.offsetTop - 200) {
        setActiveSection('timeline');
      } else if (gallery && currentScrollY >= gallery.offsetTop - 200) {
        setActiveSection('gallery');
      } else {
        setActiveSection('hero');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hero 轮播
  useEffect(() => {
    if (heroPhotos.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIdx(prev => (prev + 1) % heroPhotos.length);
    }, 5000);
    return () => clearInterval(heroTimerRef.current);
  }, [heroPhotos.length]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const timelineData = useMemo(() => {
    const groups = new Map();
    const undated = [];
    for (const item of currentCity.galleryData) {
      if (item.takenAt) {
        const date = item.takenAt.split('T')[0];
        if (!groups.has(date)) groups.set(date, []);
        groups.get(date).push(item.url);
      } else {
        undated.push(item.url);
      }
    }
    const dated = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return { dated, undated };
  }, [currentCity.galleryData]);

  const hasTimeline = timelineData.dated.length > 0 || timelineData.undated.length > 0;

  const handleImageError = (e) => {
    e.target.style.display = 'none';
  };

  // 从 Supabase Storage URL 提取文件路径
  const extractStoragePath = (url) => {
    const match = url.match(/\/city-images\/(.+?)(\?|$)/);
    return match ? match[1] : null;
  };

  // 删除照片
  const handleDeletePhoto = async (url) => {
    if (deletingUrl) return;
    if (!window.confirm('确定要删除这张照片吗？')) return;
    setDeletingUrl(url);
    try {
      // 从 storage 删除
      const path = extractStoragePath(url);
      if (path) {
        await supabase.storage.from('city-images').remove([path]);
      }
      // 从数据库删除
      const { error } = await supabase.from('city_images').delete().eq('url', url).eq('city_id', currentCity.id);
      if (error) throw error;
      // 更新本地状态
      const newGallery = currentCity.gallery.filter(u => u !== url);
      const newGalleryData = currentCity.galleryData.filter(d => d.url !== url);
      const newMainImage = currentCity.mainImage === url ? (newGallery[0] || '') : currentCity.mainImage;
      // 如果主图被删，更新cities表
      if (currentCity.mainImage === url && newMainImage) {
        await supabase.from('cities').update({ main_image: newMainImage }).eq('id', currentCity.id);
      } else if (currentCity.mainImage === url && !newMainImage) {
        await supabase.from('cities').update({ main_image: null }).eq('id', currentCity.id);
      }
      setCurrentCity(prev => ({ ...prev, mainImage: newMainImage, gallery: newGallery, galleryData: newGalleryData }));
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
    setDeletingUrl(null);
  };

  // 修正拍摄时间
  const handleEditTimestamp = async (url, newTakenAt) => {
    try {
      const { error } = await supabase.from('city_images').update({ taken_at: newTakenAt }).eq('url', url).eq('city_id', currentCity.id);
      if (error) throw error;
      setCurrentCity(prev => ({
        ...prev,
        galleryData: prev.galleryData.map(d => d.url === url ? { ...d, takenAt: newTakenAt } : d),
      }));
    } catch (err) {
      alert('更新时间失败: ' + err.message);
    }
    setEditingTimeUrl(null);
  };

  // 编辑备注
  const handleEditNote = async (url, newNote) => {
    const noteVal = newNote || '';
    // 先存 localStorage 兜底
    const key = `note_${currentCity.id}_${url}`;
    try { localStorage.setItem(key, noteVal); } catch { /* ignore */ }

    // 更新本地状态
    setCurrentCity(prev => ({
      ...prev,
      galleryData: prev.galleryData.map(d => d.url === url ? { ...d, note: noteVal } : d),
    }));
    setEditingNote(null);

    // 尝试写入 Supabase（静默失败）
    try {
      const { error } = await supabase.from('city_images').update({ note: noteVal || null }).eq('url', url).eq('city_id', currentCity.id);
      if (error && !error.message?.includes('column')) console.warn('Supabase 备注保存:', error.message);
    } catch { /* 网络等错误不影响使用 */ }
  };

  // 设为封面
  const handleSetCover = async (url) => {
    try {
      await supabase.from('cities').update({ main_image: url }).eq('id', currentCity.id);
      setCurrentCity(prev => ({ ...prev, mainImage: url }));
    } catch (err) {
      alert('设置封面失败: ' + err.message);
    }
  };

  // AI 生成回忆
  const handleGenerateMemory = async (date) => {
    setGenMemDate(date || 'all');
    try {
      const datesToGen = date
        ? timelineData.dated.filter(([d]) => d === date)
        : timelineData.dated;
      if (datesToGen.length === 0) { setGenMemDate(null); return; }

      const items = datesToGen.map(([d, photos]) => ({
        date: d,
        cityName,
        photoCount: photos.length,
        description: currentCity.description || '',
      }));

      const results = await generateDayMemories(items);

      // 保存到 Supabase
      const records = results.map(r => ({
        city_id: currentCity.id,
        date: r.date,
        text: r.text,
      }));
      for (const r of records) {
        await supabase.from('city_memories').upsert(r, { onConflict: 'city_id, date' });
      }

      // 更新本地状态
      const newMem = { ...memories };
      results.forEach(r => { newMem[r.date] = r.text; });
      setMemories(newMem);
    } catch (err) {
      alert('AI 生成失败: ' + err.message);
    }
    setGenMemDate(null);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 拖拽排序
  const handleDragStart = (index) => {
    dragIdxRef.current = index;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (toIdx) => {
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === toIdx) { setDragOverIdx(null); return; }

    const newGallery = [...currentCity.gallery];
    const newGalleryData = [...currentCity.galleryData];
    // 移动元素
    const [movedUrl] = newGallery.splice(fromIdx, 1);
    newGallery.splice(toIdx, 0, movedUrl);
    const [movedData] = newGalleryData.splice(fromIdx, 1);
    newGalleryData.splice(toIdx, 0, movedData);

    setCurrentCity(prev => ({ ...prev, gallery: newGallery, galleryData: newGalleryData }));
    setDragOverIdx(null);

    // 批量更新 sort_order
    const records = newGalleryData.map((d, i) => ({
      url: d.url, sort_order: i, city_id: currentCity.id, taken_at: d.takenAt,
    }));
    supabase.from('city_images').upsert(records, { onConflict: 'url, city_id' });
  };

  const openImageViewer = (image, index) => {
    setSelectedImage(image);
    setCurrentImageIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    document.body.style.overflow = 'auto';
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploadFiles(files);
    setUploadMsg('');
    setUploadProgress({ current: 0, total: files.length });
    // 立即开始上传
    startUpload(files);
  };

  const uploadAbortRef = useRef(false);

  const startUpload = async (files) => {
    setUploading(true);
    setUploadMsg('');
    setUploadProgress({ current: 0, total: files.length });
    uploadAbortRef.current = false;

    try {
      const total = files.length;
      let uploaded = 0;
      let failed = 0;
      const records = [];
      // 使用 ref 跟踪进度避免闭包问题
      const state = { uploaded: 0, failed: 0, lastUpdate: 0 };

      // 并发上传 worker pool（3 个并发）
      const pool = async (file) => {
        if (uploadAbortRef.current) return;
        try {
          const result = await uploadPhoto(file);
          records.push({ city_id: currentCity.id, url: result.url, sort_order: currentCity.gallery.length + state.uploaded, taken_at: result.takenAt });
          state.uploaded++;
        } catch (err) {
          console.warn('单张上传失败:', file.name, err.message);
          state.failed++;
        }
        // 节流更新 UI
        const now = Date.now();
        const done = state.uploaded + state.failed;
        if (done % 2 === 0 || now - state.lastUpdate > 300 || done === total) {
          state.lastUpdate = now;
          setUploadProgress({ current: state.uploaded, total });
        }
      };

      // 并发控制：同时最多 3 个
      const CONCURRENCY = 3;
      for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(pool));
        if (uploadAbortRef.current) break;
      }

      uploaded = state.uploaded;
      failed = state.failed;

      // 如果有成功上传的，写入数据库
      if (records.length > 0) {
        const { error: insertErr } = await supabase.from('city_images').insert(records);
        if (insertErr) throw insertErr;

        if (!currentCity.mainImage && records.length > 0) {
          await supabase.from('cities').update({ main_image: records[0].url }).eq('id', currentCity.id);
        }

        // 刷新画廊
        const { data: newImgs } = await supabase.from('city_images').select('*').eq('city_id', currentCity.id).order('sort_order');
        const galleryUrls = (newImgs || []).map(img => img.url);
        const galleryData = (newImgs || []).map(img => {
          const localNote = (() => { try { return localStorage.getItem(`note_${currentCity.id}_${img.url}`) || ''; } catch { return ''; } })();
          return { url: img.url, takenAt: img.taken_at, note: img.note || localNote };
        });
        setCurrentCity(prev => ({
          ...prev,
          mainImage: prev.mainImage || records[0]?.url || '',
          gallery: galleryUrls,
          galleryData,
        }));
      }

      setUploadProgress({ current: uploaded, total });
      const msg = failed > 0
        ? `✅ ${uploaded} 张成功${failed > 0 ? `，${failed} 张失败` : ''}`
        : `✅ 已上传 ${uploaded} 张`;
      setUploadMsg(msg);
    } catch (err) {
      setUploadMsg(`❌ ${err.message}`);
    }
    setTimeout(() => {
      setUploading(false);
      setUploadMsg('');
      setUploadFiles([]);
      setUploadProgress({ current: 0, total: 0 });
    }, 2500);
  };

  const showPreviousImage = () => {
    const allImages = currentCity.gallery.length > 0 ? currentCity.gallery : [currentCity.mainImage];
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : allImages.length - 1;
    setCurrentImageIndex(newIndex);
    setSelectedImage(allImages[newIndex]);
  };

  const showNextImage = () => {
    const allImages = currentCity.gallery.length > 0 ? currentCity.gallery : [currentCity.mainImage];
    const newIndex = currentImageIndex < allImages.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setSelectedImage(allImages[newIndex]);
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!selectedImage) return;

      if (e.key === 'Escape') {
        closeImageViewer();
      } else if (e.key === 'ArrowLeft') {
        showPreviousImage();
      } else if (e.key === 'ArrowRight') {
        showNextImage();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedImage, currentImageIndex]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0f1a 0%, #0d1525 40%, #111d35 100%)', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>加载中...</div>
          <div style={{ fontSize: '1rem', opacity: 0.6 }}>{cityName}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="city-detail">
      <button
        className={`back-button ${isDarkMode ? 'dark' : 'light'}`}
        onClick={goBack}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        返回
      </button>

      {/* 锚点导航 — 灰条全宽 */}
      <div style={{
        position: 'fixed', top: scrollY > window.innerHeight * 0.8 ? '0' : '-56px',
        left: 0, right: 0,
        zIndex: 99,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 0',
        display: 'flex', justifyContent: 'center', gap: '4px',
        transition: 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {[
          { id: 'hero-section', label: '封面' },
          { id: 'gallery-section', label: '精彩瞬间' },
          ...(hasTimeline ? [{ id: 'timeline-section', label: '时间轴' }] : []),
        ].map(item => (
          <button
            key={item.id}
            onClick={() => scrollToSection(item.id)}
            style={{
              padding: '8px 18px', borderRadius: '50px', border: 'none',
              background: activeSection === item.id ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: activeSection === item.id ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '13px', fontWeight: activeSection === item.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
          >{item.label}</button>
        ))}
      </div>

      {/* 全屏主页面 */}
      <div id="hero-section" className="hero-section">
        {/* 轮播背景 */}
        {heroPhotos.map((url, i) => (
          <div
            key={url}
            className="hero-background"
            style={{
              backgroundImage: `url("${url}")`,
              transform: `translateY(${scrollY * 0.5}px)`,
              opacity: i === heroIdx ? 1 : 0,
              transition: 'opacity 1.2s ease-in-out',
            }}
            onClick={() => openImageViewer(url, i)}
          />
        ))}
        <div className="hero-overlay" />
        {/* 轮播指示器 */}
        {heroPhotos.length > 1 && (
          <div style={{
            position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, display: 'flex', gap: '8px',
          }}>
            {heroPhotos.map((_, i) => (
              <button
                key={i}
                onClick={() => { setHeroIdx(i); clearInterval(heroTimerRef.current); }}
                style={{
                  width: i === heroIdx ? '24px' : '8px', height: '8px',
                  borderRadius: '4px', border: 'none',
                  background: i === heroIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
        )}

        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          style={{ width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <h1 className="city-name">{cityName}</h1>
          <div className="location-meta" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            {currentCity.description && (
              <div className="meta-item" style={{ fontSize: '1.4rem', opacity: 0.9, fontWeight: 300, letterSpacing: '1px' }}>
                {currentCity.description}
              </div>
            )}
          </div>
        </motion.div>

        <div className="scroll-indicator">
          <span>向下滑动查看更多</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* 图片流区域 */}
      <div id="gallery-section" className="gallery-section">
        <div className="gallery-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '60px' }}>
            <h2 className="gallery-title" style={{ marginBottom: 0 }}>精彩瞬间</h2>
            {currentCity.gallery.length > 0 && (
              <button
                onClick={() => { setSelectMode(!selectMode); setSelectedUrls(new Set()); }}
                style={{
                  padding: '4px 14px', borderRadius: '14px', border: '1px solid rgba(102,126,234,0.4)',
                  background: selectMode ? '#667eea' : 'transparent',
                  color: selectMode ? '#fff' : '#667eea', fontSize: '12px', cursor: 'pointer', fontWeight: 500,
                }}
              >{selectMode ? '取消选择' : '批量选择'}</button>
            )}
          </div>
          {selectMode && selectedUrls.size > 0 && (
            <div style={{
              position: 'sticky', top: '60px', zIndex: 20, marginBottom: '20px',
              background: 'rgba(220,38,38,0.95)', borderRadius: '12px',
              padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
              color: 'white', fontSize: '14px', fontWeight: 600, backdropFilter: 'blur(8px)',
            }}>
              <span>已选 {selectedUrls.size} 张</span>
              <button
                onClick={async () => {
                  if (!window.confirm(`确定删除选中的 ${selectedUrls.size} 张照片吗？此操作不可撤销。`)) return;
                  for (const url of selectedUrls) await handleDeletePhoto(url);
                  setSelectedUrls(new Set());
                  setSelectMode(false);
                }}
                style={{
                  padding: '6px 16px', borderRadius: '8px', border: 'none',
                  background: 'white', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                }}
              >删除所选</button>
            </div>
          )}

          <div className="gallery-grid">
            {currentCity.gallery.length > 0 ? (
              currentCity.gallery.map((image, index) => {
                // 如果画廊里的第一张图和主图一样，可以选择性跳过或者保留。
                // 这里我们保留，但确保显示正常。
                return (
                  <motion.div
                    key={image}
                    className="gallery-item"
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    style={{ position: 'relative', opacity: dragOverIdx === index ? 0.5 : 1 }}
                    draggable={!selectMode}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(index)}
                    onClick={() => {
                      if (selectMode) {
                        const next = new Set(selectedUrls);
                        next.has(image) ? next.delete(image) : next.add(image);
                        setSelectedUrls(next);
                      } else {
                        openImageViewer(image, index);
                      }
                    }}
                  >
                    <img
                      src={image}
                      alt={`${cityName} 精彩记录 ${index + 1}`}
                      loading="lazy"
                      onError={handleImageError}
                    />
                    {selectMode && (
                      <div style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: selectedUrls.has(image) ? '#667eea' : 'rgba(255,255,255,0.3)',
                        border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '12px', fontWeight: 700,
                      }}>
                        {selectedUrls.has(image) ? '✓' : ''}
                      </div>
                    )}
                    {/* 悬浮操作按钮（选择模式下隐藏） */}
                    {!selectMode && (
                    <div className="photo-actions" onClick={e => e.stopPropagation()}>
                      {image !== currentCity.mainImage && (
                        <button className="photo-action-btn cover-btn" title="设为封面" onClick={() => handleSetCover(image)}>⭐</button>
                      )}
                      <button className="photo-action-btn" title="备注" onClick={() => {
                        const d = currentCity.galleryData.find(g => g.url === image);
                        setEditingNote({ url: image, note: d?.note || '' });
                      }}>📝</button>
                      <button className="photo-action-btn" title="修正时间" onClick={() => setEditingTimeUrl(image)}>🕐</button>
                      <button className="photo-action-btn delete-btn" title="删除" disabled={deletingUrl === image} onClick={() => handleDeletePhoto(image)}>{deletingUrl === image ? '...' : '✕'}</button>
                    </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div style={{ columnSpan: 'all', textAlign: 'center', padding: '100px 0', color: '#999', fontSize: '1.1rem', letterSpacing: '1px' }}>
                照片都被藏起来了哦，自己去上传试试吧～
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 时间轴 */}
      {hasTimeline && (
        <div id="timeline-section" className="timeline-section" style={{ background: 'white', padding: '60px 0', minHeight: '60vh' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <h2 style={{ fontSize: '2.5rem', color: '#333', margin: '0 0 16px' }}>时间轴</h2>
              {timelineData.dated.length > 0 && (
                <button
                  onClick={() => handleGenerateMemory(null)}
                  disabled={genMemDate === 'all'}
                  style={{
                    padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(102,126,234,0.4)',
                    background: genMemDate === 'all' ? 'rgba(102,126,234,0.1)' : 'white',
                    color: genMemDate === 'all' ? '#999' : '#667eea', cursor: genMemDate === 'all' ? 'default' : 'pointer',
                    fontSize: '13px', fontWeight: 600, letterSpacing: '1px',
                    transition: 'all 0.2s',
                  }}
                >{genMemDate === 'all' ? '⏳ AI 正在生成...' : '✨ AI 生成全部回忆'}</button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              {/* 竖线 */}
              <div style={{
                position: 'absolute', left: '28px', top: 0, bottom: 0,
                width: '2px', background: 'linear-gradient(to bottom, #667eea, #764ba2, #f093fb)',
              }} />

              {timelineData.dated.map(([date, photos], di) => (
                <div key={date} style={{ position: 'relative', marginBottom: '48px', paddingLeft: '68px' }}>
                  {/* 日期圆点 */}
                  <div style={{
                    position: 'absolute', left: '20px', top: '6px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    border: '3px solid white',
                    boxShadow: '0 0 0 2px #667eea',
                    zIndex: 2,
                  }} />
                  {/* 日期标签 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px',
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#555', letterSpacing: '1px' }}>
                      {date.replace(/-/g, ' / ')}
                    </span>
                    {!memories[date] && (
                      <button
                        onClick={() => handleGenerateMemory(date)}
                        disabled={genMemDate === date}
                        style={{
                          padding: '2px 10px', borderRadius: '10px', border: '1px dashed rgba(102,126,234,0.3)',
                          background: 'transparent', color: '#667eea', cursor: 'pointer',
                          fontSize: '11px', fontWeight: 500,
                        }}
                      >{genMemDate === date ? '生成中...' : 'AI 生成'}</button>
                    )}
                  </div>
                  {/* AI 回忆文本 */}
                  {memories[date] && (
                    <div style={{
                      marginBottom: '16px', padding: '12px 16px',
                      background: 'linear-gradient(135deg, rgba(102,126,234,0.06), rgba(118,75,162,0.06))',
                      borderRadius: '12px', border: '1px solid rgba(102,126,234,0.15)',
                      fontSize: '13px', color: '#666', lineHeight: '1.7',
                      position: 'relative',
                    }}>
                      <span style={{ fontSize: '16px', marginRight: '6px' }}>💭</span>
                      {memories[date]}
                      <button
                        onClick={() => handleGenerateMemory(date)}
                        disabled={genMemDate === date}
                        style={{
                          position: 'absolute', bottom: '6px', right: '10px',
                          background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
                          fontSize: '11px',
                        }}
                        title="重新生成"
                      >{genMemDate === date ? '...' : '🔄'}</button>
                    </div>
                  )}
                  {/* 照片瀑布流 */}
                  <div style={{
                    columnCount: 3,
                    columnGap: '10px',
                  }}>
                    {photos.map((url, pi) => (
                      <motion.div
                        key={`${di}-${pi}`}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: pi * 0.08 }}
                        style={{
                          breakInside: 'avoid',
                          marginBottom: '10px',
                          borderRadius: '10px', overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={url} alt="" loading="lazy"
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                          onError={handleImageError}
                          onClick={() => {
                            const allPhotos = [...timelineData.dated.flatMap(([_, urls]) => urls), ...timelineData.undated];
                            const idx = allPhotos.indexOf(url);
                            openImageViewer(url, idx >= 0 ? idx : 0);
                          }}
                        />
                        <div className="photo-actions" onClick={e => e.stopPropagation()}>
                          {url !== currentCity.mainImage && (
                            <button className="photo-action-btn cover-btn" title="设为封面" onClick={() => handleSetCover(url)}>⭐</button>
                          )}
                          <button className="photo-action-btn" title="备注" onClick={() => {
                            const d = currentCity.galleryData.find(g => g.url === url);
                            setEditingNote({ url, note: d?.note || '' });
                          }}>📝</button>
                          <button className="photo-action-btn" title="修正时间" onClick={() => setEditingTimeUrl(url)}>🕐</button>
                          <button className="photo-action-btn delete-btn" title="删除" disabled={deletingUrl === url} onClick={() => handleDeletePhoto(url)}>{deletingUrl === url ? '...' : '✕'}</button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 未标注日期的照片 */}
              {timelineData.undated.length > 0 && (
                <div style={{ position: 'relative', paddingLeft: '68px' }}>
                  <div style={{
                    position: 'absolute', left: '20px', top: '6px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#ccc', border: '3px solid white',
                    boxShadow: '0 0 0 2px #ccc', zIndex: 2,
                  }} />
                  <div style={{
                    fontSize: '1.1rem', fontWeight: 700, color: '#999',
                    marginBottom: '16px', letterSpacing: '1px',
                  }}>时间未知</div>
                  <div style={{
                    columnCount: 3,
                    columnGap: '10px',
                  }}>
                    {timelineData.undated.map((url, pi) => (
                      <motion.div
                        key={`u-${pi}`}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: pi * 0.08 }}
                        style={{
                          breakInside: 'avoid',
                          marginBottom: '10px',
                          borderRadius: '10px', overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          opacity: 0.6,
                          position: 'relative',
                        }}
                      >
                        <img
                          src={url} alt="" loading="lazy"
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                          onError={handleImageError}
                          onClick={() => {
                            const allPhotos = [...timelineData.dated.flatMap(([_, urls]) => urls), ...timelineData.undated];
                            const idx = allPhotos.indexOf(url);
                            openImageViewer(url, idx >= 0 ? idx : 0);
                          }}
                        />
                        <div className="photo-actions" onClick={e => e.stopPropagation()}>
                          {url !== currentCity.mainImage && (
                            <button className="photo-action-btn cover-btn" title="设为封面" onClick={() => handleSetCover(url)}>⭐</button>
                          )}
                          <button className="photo-action-btn" title="备注" onClick={() => {
                            const d = currentCity.galleryData.find(g => g.url === url);
                            setEditingNote({ url, note: d?.note || '' });
                          }}>📝</button>
                          <button className="photo-action-btn" title="修正时间" onClick={() => setEditingTimeUrl(url)}>🕐</button>
                          <button className="photo-action-btn delete-btn" title="删除" disabled={deletingUrl === url} onClick={() => handleDeletePhoto(url)}>{deletingUrl === url ? '...' : '✕'}</button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 图片查看器模态框 */}
      {selectedImage && (
        <div className="image-viewer-overlay" onClick={closeImageViewer}>
          <div className="image-viewer-container" onClick={(e) => e.stopPropagation()}>
            <button className="image-viewer-close" onClick={closeImageViewer}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button className="image-viewer-nav prev" onClick={showPreviousImage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button className="image-viewer-nav next" onClick={showNextImage}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <img
              src={selectedImage}
              alt="放大查看"
              className="image-viewer-img"
              onError={handleImageError}
            />

            <div className="image-viewer-counter">
              {currentImageIndex + 1} / {[currentCity.mainImage, ...currentCity.gallery].length}
            </div>

            {/* Viewer actions */}
            <div style={{ position: 'absolute', bottom: '-50px', right: '-50px', display: 'flex', gap: '8px' }}>
              {selectedImage !== currentCity.mainImage && (
                <button
                  onClick={() => { handleSetCover(selectedImage); }}
                  style={{
                    background: 'rgba(255,215,0,0.25)', border: 'none', color: '#ffd700',
                    width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(10px)', fontSize: '14px',
                  }}
                  title="设为封面"
                >⭐</button>
              )}
              <button
                onClick={() => { setEditingTimeUrl(selectedImage); }}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(10px)', fontSize: '14px',
                }}
                title="修正时间"
              >🕐</button>
              <button
                onClick={() => {
                  closeImageViewer();
                  setTimeout(() => handleDeletePhoto(selectedImage), 100);
                }}
                disabled={deletingUrl === selectedImage}
                style={{
                  background: 'rgba(220,38,38,0.3)', border: 'none', color: 'white',
                  width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(10px)', fontSize: '14px',
                }}
                title="删除"
              >{deletingUrl === selectedImage ? '...' : '✕'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 时间修正弹窗 */}
      {editingTimeUrl && (() => {
        const photo = currentCity.galleryData.find(d => d.url === editingTimeUrl);
        const currentTime = photo?.takenAt || '';
        let defaultInput = '';
        if (currentTime) {
          const d = new Date(currentTime);
          const offset = d.getTimezoneOffset();
          defaultInput = new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
        }
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setEditingTimeUrl(null)}>
            <div style={{
              background: '#1e1e2e', borderRadius: '16px', padding: '28px 24px',
              minWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>修正拍摄时间</h3>
              <p style={{ color: '#999', margin: '0 0 16px', fontSize: '12px' }}>
                {currentTime ? `当前: ${new Date(currentTime).toLocaleString('zh-CN')}` : '当前: 无时间信息'}
              </p>
              <input
                type="datetime-local"
                defaultValue={defaultInput}
                id="time-edit-input"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: '14px', boxSizing: 'border-box',
                  marginBottom: '16px',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {currentTime && (
                  <button
                    onClick={() => handleEditTimestamp(editingTimeUrl, null)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,100,100,0.4)',
                      background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '13px',
                    }}
                  >清除时间</button>
                )}
                <button
                  onClick={() => setEditingTimeUrl(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '13px',
                  }}
                >取消</button>
                <button
                  onClick={() => {
                    const input = document.getElementById('time-edit-input');
                    if (!input || !input.value) {
                      alert('请选择时间');
                      return;
                    }
                    handleEditTimestamp(editingTimeUrl, new Date(input.value).toISOString());
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  }}
                >保存</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 备注编辑弹窗 */}
      {editingNote && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setEditingNote(null)}>
          <div style={{
            background: '#1e1e2e', borderRadius: '16px', padding: '28px 24px',
            width: '400px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>📝 照片备注</h3>
            <textarea
              defaultValue={editingNote.note}
              id="note-edit-input"
              placeholder="写下这张照片的故事..."
              rows={4}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: '14px', boxSizing: 'border-box',
                resize: 'vertical', marginBottom: '16px', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingNote(null)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '13px',
                }}
              >取消</button>
              <button
                onClick={() => {
                  const input = document.getElementById('note-edit-input');
                  handleEditNote(editingNote.url, input?.value || '');
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                }}
              >保存</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .city-detail {
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }

        .hero-section {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-background {
          position: absolute;
          top: -10%;
          left: -10%;
          width: 120%;
          height: 120%;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          cursor: pointer;
        }

        .hero-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
        }

        .back-button {
          position: fixed;
          top: 30px;
          left: 30px;
          padding: 12px 24px;
          border-radius: 30px;
          border: none;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          z-index: 100;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .back-button.dark {
          background: rgba(0, 0, 0, 0.7);
          color: white;
          backdrop-filter: blur(10px);
        }

        .back-button.dark:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: translateY(-2px);
        }

        .back-button.light {
          background: rgba(255, 255, 255, 0.9);
          color: black;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .back-button.light:hover {
          background: rgba(255, 255, 255, 1);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .hero-content {
          position: relative;
          z-index: 5;
          text-align: center;
          color: white;
          max-width: 80%;
        }

        .city-name {
          font-size: clamp(3rem, 10vw, 6rem);
          font-weight: 800;
          margin: 0 0 20px 0;
          letter-spacing: -2px;
          text-shadow: 0 2px 20px rgba(0,0,0,0.5);
        }

        .meta-item {
          display: flex;
          align-items: center;
        }

        .scroll-indicator {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          color: white;
          text-align: center;
          z-index: 10;
          animation: bounce 2s infinite;
        }

        .scroll-indicator span {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          opacity: 0.8;
        }

        .gallery-section {
          background: white;
          padding: 80px 0;
          min-height: 100vh;
        }

        .gallery-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px;
        }

        .gallery-title {
          font-size: 3rem;
          text-align: center;
          margin-bottom: 60px;
          color: #333;
        }

        .gallery-grid {
          column-count: 3;
          column-gap: 20px;
          margin-bottom: 80px;
        }

        .gallery-item {
          break-inside: avoid;
          margin-bottom: 20px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
          cursor: pointer;
        }

        .gallery-item:hover {
          transform: translateY(-4px);
        }

        .gallery-item img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.3s ease;
        }

        .gallery-item:hover img {
          transform: scale(1.03);
        }

        .photo-actions {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .gallery-item:hover .photo-actions,
        div:hover > .photo-actions {
          opacity: 1;
        }

        .photo-action-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          transition: background 0.2s;
        }

        .photo-action-btn:hover {
          background: rgba(0, 0, 0, 0.85);
        }

        .photo-action-btn.delete-btn:hover {
          background: rgba(220, 38, 38, 0.85);
        }

        .photo-action-btn.cover-btn:hover {
          background: rgba(255, 215, 0, 0.7);
        }

        .photo-action-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          40% {
            transform: translateX(-50%) translateY(-10px);
          }
          60% {
            transform: translateX(-50%) translateY(-5px);
          }
        }

        /* 图片查看器样式 */
        .image-viewer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.95);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }

        .image-viewer-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-viewer-img {
          max-width: 90vw;
          max-height: 90vh;
          width: auto;
          height: auto;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .image-viewer-close {
          position: absolute;
          top: -50px;
          right: -50px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          z-index: 1001;
          flex-shrink: 0;
        }

        .image-viewer-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .image-viewer-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          z-index: 1001;
        }

        .image-viewer-nav:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-50%) scale(1.1);
        }

        .image-viewer-nav.prev {
          left: -80px;
        }

        .image-viewer-nav.next {
          right: -80px;
        }

        .image-viewer-counter {
          position: absolute;
          bottom: -50px;
          left: 50%;
          transform: translateX(-50%);
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          backdrop-filter: blur(10px);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (max-width: 1024px) {
          .gallery-grid {
            column-count: 2;
          }
        }

        @media (max-width: 768px) {
          .city-name {
            font-size: 4rem;
          }
          .city-description {
            font-size: 1.2rem;
          }
          .gallery-container {
            padding: 0 20px;
          }
          .gallery-grid {
            column-count: 1;
          }
          .back-button {
            top: 20px;
            left: 20px;
            padding: 8px 16px;
            font-size: 14px;
          }
          
          .image-viewer-close {
            top: 20px;
            right: 20px;
          }
          
          .image-viewer-nav.prev {
            left: 20px;
          }
          
          .image-viewer-nav.next {
            right: 20px;
          }
          
          .image-viewer-counter {
            bottom: 20px;
          }
        }
      `}</style>

      {/* 悬浮上传按钮 */}
      <div style={{
        position: 'fixed', bottom: '32px', right: '32px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px',
      }}>
        {/* 上传进度提示 */}
        {(uploading || uploadMsg) && (
          <div style={{
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            color: 'white', padding: '10px 18px', borderRadius: '20px',
            fontSize: '13px', fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {uploading
              ? `上传中 ${uploadProgress.current}/${uploadProgress.total}...`
              : uploadMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* 清除上传 */}
          {uploadFiles.length > 0 && !uploading && (
            <button onClick={() => { setUploadFiles([]); setUploadMsg(''); setUploadProgress({ current: 0, total: 0 }); }}
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
                fontSize: '16px', cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}>✕</button>
          )}
          <label style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: uploading
              ? 'rgba(255,255,255,0.2)'
              : 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: uploading ? 'default' : 'pointer',
            boxShadow: '0 4px 20px rgba(102,126,234,0.5)',
            color: 'white', fontSize: '22px', fontWeight: 300,
            transition: 'all 0.3s ease',
            border: 'none',
          }}>
            {uploading ? '⏳' : '＋'}
            <input type="file" multiple accept="image/*" onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
}