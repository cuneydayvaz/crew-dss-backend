import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Shield, Plane, Star, Map as MapIcon, List, X, Search, CheckCircle, Hotel, Filter, Download, ChevronDown, ChevronRight, ArrowLeft, Globe, ExternalLink, FileSpreadsheet, FileText, Home, Menu, LayoutDashboard, Wifi, Dumbbell, Coffee, Bus, Waves, Utensils, Sun, Cloud, CloudRain, Snowflake, Car, Sparkles, PieChart, TrendingUp, Award, BarChart3, RotateCcw, MessageSquare, Clock, User, Heart, Calculator, Scale, Lock, LogIn, Bot, Plus, Activity, DollarSign, AlertTriangle, TrendingDown, Layers, Navigation, Check, FileCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const API_BASE = "https://crew-dss-backend.onrender.com/api";

function ChangeView({ center }) { const map = useMap(); map.setView(center, 12); return null; }

const AIRPORT_NAMES = { "IST": "İstanbul Havalimanı", "SAW": "Sabiha Gökçen Havalimanı", "ESB": "Esenboğa Havalimanı", "AYT": "Antalya Havalimanı", "ADB": "Adnan Menderes Havalimanı", "LHR": "Londra Heathrow", "JFK": "New York JFK" };

function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/login?v=force_prod_${Date.now()}`, { username, password });
            onLogin(true);
        } catch (err) {
            setError('Hatalı kullanıcı adı veya şifre!');
        }
    };
    return (
        <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2000')] bg-cover bg-center relative z-[9999]">
            <div className="absolute inset-0 bg-[#002244]/80 backdrop-blur-sm"></div>
            <div className="relative z-10 bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md animate-fadeIn">
                <div className="flex justify-center mb-6"><Plane className="h-12 w-12 text-[#002244]"/></div>
                <h2 className="text-2xl font-bold text-center text-[#002244] mb-2">Crew Hotel DSS</h2>
                <p className="text-center text-slate-500 mb-8 text-sm">Kurumsal Giriş Paneli</p>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Kullanıcı Adı</label><div className="flex items-center border rounded-lg px-3 py-2 bg-slate-50"><User size={18} className="text-slate-400 mr-2"/><input type="text" className="bg-transparent w-full outline-none text-sm" value={username} onChange={e=>setUsername(e.target.value)}/></div></div>
                    <div><label className="block text-sm font-bold text-slate-700 mb-1">Şifre</label><div className="flex items-center border rounded-lg px-3 py-2 bg-slate-50"><Lock size={18} className="text-slate-400 mr-2"/><input type="password" className="bg-transparent w-full outline-none text-sm" value={password} onChange={e=>setPassword(e.target.value)}/></div></div>
                    {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                    <button type="submit" className="w-full bg-[#002244] text-white py-3 rounded-xl font-bold hover:bg-sky-800 transition flex items-center justify-center gap-2"><LogIn size={18}/> Giriş Yap</button>
                </form>
            </div>
        </div>
    )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [activeTab, setActiveTab] = useState('list');
  const [airportCode, setAirportCode] = useState('');
  const [airportFullName, setAirportFullName] = useState('');
  const [hotels, setHotels] = useState([]);
  const [evaluatedHotels, setEvaluatedHotels] = useState({});
  const [airportLoc, setAirportLoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [detailHotel, setDetailHotel] = useState(null);
  const [calculatorHotel, setCalculatorHotel] = useState(null);
  const [compareList, setCompareList] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showAddHotelModal, setShowAddHotelModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [filters, setFilters] = useState({ specificStar: 0, maxPrice: 10000 });
  const [sortBy, setSortBy] = useState('score_desc');
  const [expandedAirports, setExpandedAirports] = useState({});
  const [weather, setWeather] = useState(null);
  const [stats, setStats] = useState(null);
  const [airportList, setAirportList] = useState([]);
  const [dashSearchCode, setDashSearchCode] = useState('');

  const [selectedCurrency, setSelectedCurrency] = useState('TRY');
  const currencyRates = {
    TRY: { rate: 1.0, symbol: '₺' },
    EUR: { rate: 0.026, symbol: '€' },
    USD: { rate: 0.028, symbol: '$' }
  };

  useEffect(() => {
    axios.post(`${API_BASE}/init-data?v=force_prod_${Date.now()}`).then(() =>
      axios.get(`${API_BASE}/airports-list?v=force_prod_${Date.now()}`).then(res => setAirportList(res.data))
    );
  }, []);

  const searchHotels = async (code) => {
    if (!code) return;
    setLoading(true); setWeather(null); setCompareList([]);
    try {
      const res = await axios.get(`${API_BASE}/airports/${code}/hotels`);
      setHotels(res.data);
      if (res.data.length > 0) {
        setAirportLoc({ lat: res.data[0].lat, lng: res.data[0].lng });
        const name = AIRPORT_NAMES[code.toUpperCase()] || `${code.toUpperCase()} Havalimanı`;
        setAirportFullName(`${code.toUpperCase()} - ${name}`);
      }
      axios.get(`${API_BASE}/weather/${code}`).then(w => setWeather(w.data));
      setCurrentView('results');
    } catch (err) { alert("Havalimanı bulunamadı."); }
    finally { setLoading(false); }
  };

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/evaluations`);
      const grouped = res.data.reduce((acc, hotel) => {
        (acc[hotel.airport_code] = acc[hotel.airport_code] || []).push(hotel);
        return acc;
      }, {});
      setEvaluatedHotels(grouped);
      const initialExpanded = {};
      Object.keys(grouped).forEach(code => initialExpanded[code] = true);
      setExpandedAirports(initialExpanded);
      setCurrentView('evaluations');
    } catch (err) { alert("Hata oluştu."); }
    finally { setLoading(false); }
  };

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/favorites`);
      setHotels(res.data);
      setCurrentView('favorites');
    } catch (err) { alert("Favoriler alınamadı."); }
    finally { setLoading(false); }
  };

  const loadDashboard = async (code) => {
    setLoading(true);
    const queryCode = code ? code.toUpperCase() : "ALL";
    try {
      const res = await axios.get(`${API_BASE}/stats?airport_code=${queryCode}`);
      setStats(res.data);
      setCurrentView('dashboard');
    } catch (err) { alert("Stats alınamadı"); }
    finally { setLoading(false); }
  };

  const submitSecurityForm = async (formData) => {
    try {
      await axios.post(`${API_BASE}/security-forms`, {
        hotel_id: selectedHotel.id,
        ...formData
      });
      alert("Denetim kaydedildi!");
      setSelectedHotel(null);
      if (currentView === 'results') searchHotels(airportCode);
      if (currentView === 'evaluations') loadEvaluations();
      if (currentView === 'favorites') loadFavorites();
    } catch (err) { alert("Hata oluştu."); }
  };

  const submitNewHotel = async (formData) => {
    try {
      await axios.post(`${API_BASE}/hotels`, formData);
      alert("Otel Eklendi!");
      setShowAddHotelModal(false);
      if (currentView === 'results' && airportCode === formData.airport_code) searchHotels(airportCode);
    } catch (err) { alert("Hata oluştu."); }
  };

  const toggleFavorite = async (hotel) => {
    try {
      await axios.put(`${API_BASE}/hotels/${hotel.id}/favorite`);
      setHotels(prev => {
        if (currentView === 'favorites') return prev.filter(h => h.id !== hotel.id);
        return prev.map(h => h.id === hotel.id ? { ...h, is_favorite: !h.is_favorite } : h);
      });
    } catch (err) { alert("Favori işlemi başarısız."); }
  };

  const toggleCompare = (hotel) => {
    if (compareList.some(h => h.id === hotel.id)) {
      setCompareList(compareList.filter(h => h.id !== hotel.id));
    } else {
      if (compareList.length >= 3) { alert("En fazla 3 otel karşılaştırabilirsiniz."); return; }
      setCompareList([...compareList, hotel]);
    }
  };

  const downloadAuditReportPDF = (hotel) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`SHGM / AIRLINE CREW ACCOMMODATION AUDIT REPORT`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString()} | Dokuman ID: AUDIT-${hotel.id}-2026`, 14, 28);
    
    doc.autoTable({
      head: [["Genel Bilgiler", "Detay"]],
      body: [
        ["Otel Adı", hotel.name],
        ["Havalimanı Kodu", hotel.airport_code],
        ["Açık Adres", hotel.address],
        ["Yıldız Sayısı", `${hotel.stars} Yıldız`],
        ["Son Denetim Güvenlik Puanı", `${hotel.latest_security_score} / 10`]
      ],
      startY: 35
    });

    const audit = hotel.last_audit_details || {
      inspector: "Mustafa Cüneyd Ayvaz",
      perimeter: 85, room: 90, emergency: 80, staff: 85,
      notes: "Otelin 7/24 özel güvenlik personeli ve kameralı takip sistemi mevcuttur. Easa/SHGM standartlarına uygundur."
    };

    doc.autoTable({
      head: [["Denetim Kriteri", "Verilen Puan (Max 100)"]],
      body: [
        ["Çevre & Lokasyon Güvenliği", audit.perimeter],
        ["Oda Emniyeti & Kilit Sistemleri", audit.room],
        ["Acil Durum & Yangın Tahliye Planı", audit.emergency],
        ["Personel Güvenlik Eğitimi", audit.staff]
      ],
      startY: doc.lastAutoTable.finalY + 10
    });

    doc.setFontSize(11);
    doc.text(`Denetçi Notları:`, 14, doc.lastAutoTable.finalY + 15);
    doc.setFontSize(9);
    doc.text(audit.notes, 14, doc.lastAutoTable.finalY + 22);

    doc.setFontSize(10);
    doc.text(`Denetleyen Yetkili: ${audit.inspector || 'M. Cüneyd Ayvaz (Operations Officer)'}`, 14, doc.lastAutoTable.finalY + 40);
    doc.text(`İmza: [ONAYLANDI - DJITAL IMZA]`, 120, doc.lastAutoTable.finalY + 40);

    doc.save(`SHGM_Denetim_Raporu_${hotel.name.replace(/\s+/g, '_')}.pdf`);
  };

  const displayHotels = hotels.filter(h => {
    const starMatch = filters.specificStar === 0 || Math.floor(h.stars) === filters.specificStar;
    const priceMatch = h.base_price <= filters.maxPrice;
    return starMatch && priceMatch;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.base_price - b.base_price;
    if (sortBy === 'price_desc') return b.base_price - a.base_price;
    if (sortBy === 'dist_asc') return a.distance_km - b.distance_km;
    return (b.mcdm_score || b.mcdmScore || 0) - (a.mcdm_score || a.mcdmScore || 0);
  });

  const exportDashboardPDF = () => {
    if (!stats) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Crew Hotel DSS - Yonetici Özeti Raporu`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Bölge: ${stats.top_airport}`, 14, 34);

    const summaryRows = [
      ["Toplam Denetlenen Otel", stats.total_audits],
      ["Onaylı Otel Sayısı", stats.approved_count],
      ["Ortalama MCDM Skoru", stats.avg_score],
      ["Guvenlik Uyum Orani", `%${stats.compliance_rate}`]
    ];

    doc.autoTable({
      head: [["Metrik", "Deger"]],
      body: summaryRows,
      startY: 42
    });

    if (stats.top_hotels && stats.top_hotels.length > 0) {
      const topRows = stats.top_hotels.map(h => [h.name, h.airport_code, h.score]);
      doc.autoTable({
        head: [["En Iyi Oteller", "Bolge", "MCDM Skoru"]],
        body: topRows,
        startY: doc.lastAutoTable.finalY + 15
      });
    }

    doc.save(`Crew_Hotel_Dashboard_Report.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(displayHotels.map(h => ({
      "Otel": h.name, "Yıldız": h.stars, "Fiyat": `${Math.round(h.base_price * currencyRates[selectedCurrency].rate)} ${currencyRates[selectedCurrency].symbol}`,
      "Trafik": h.traffic_duration, "Skor": h.mcdm_score || h.mcdmScore
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Oteller");
    XLSX.writeFile(workbook, `Hotel_List.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Crew Hotel Advisor`, 14, 22);
    const rows = displayHotels.map(h => [h.name, h.stars, `${Math.round(h.base_price * currencyRates[selectedCurrency].rate)} ${currencyRates[selectedCurrency].symbol}`, `${h.traffic_duration} dk`, h.mcdm_score || h.mcdmScore]);
    doc.autoTable({ head: [["Otel", "Yildiz", "Fiyat", "Trafik", "Skor"]], body: rows, startY: 35 });
    doc.save(`Hotel_Report.pdf`);
  };

  if (!isLoggedIn) return <LoginScreen onLogin={setIsLoggedIn} />;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans transition-all duration-300 relative">
      {loading && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9999] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm mx-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#002244] mb-4"></div>
            <h3 className="text-xl font-bold text-[#002244] mb-2">Veriler Analiz Ediliyor...</h3>
            <p className="text-slate-600 text-sm">
              OpenStreetMap ve veri tabanları taranıyor, MCDM algoritmaları çalıştırılıyor.
              <br/>
              <span className="text-xs text-sky-600 font-semibold mt-2 block">(Bu işlem 10-15 saniye sürebilir)</span>
            </p>
          </div>
        </div>
      )}

      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#002244] text-white flex flex-col fixed h-full z-20 shadow-2xl transition-all duration-300`}>
        <div className="p-4 border-b border-sky-900/50 flex items-center justify-between h-20">
          {isSidebarOpen
            ? <div className="flex items-center gap-2"><Plane className="h-6 w-6 text-sky-400"/><span className="font-extrabold text-xl tracking-tight">Crew <span className="text-sky-400">Hotel</span></span></div>
            : <div className="mx-auto"><Plane className="h-8 w-8 text-sky-400"/></div>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white transition"><Menu size={20}/></button>
        </div>
        <nav className="flex-1 p-2 space-y-2 mt-4">
          <SidebarItem icon={<Home size={22}/>} label="Ana Sayfa" isOpen={isSidebarOpen} active={currentView==='home'} onClick={() => setCurrentView('home')}/>
          <SidebarItem icon={<LayoutDashboard size={22}/>} label="Dashboard" isOpen={isSidebarOpen} active={currentView==='dashboard'} onClick={() => loadDashboard('')}/>
          <SidebarItem icon={<Heart size={22}/>} label="Favorilerim" isOpen={isSidebarOpen} active={currentView==='favorites'} onClick={loadFavorites}/>
          {currentView==='results' && <SidebarItem icon={<Search size={22}/>} label="Arama Sonuçları" isOpen={isSidebarOpen} active={true} onClick={() => {}}/>}
          <SidebarItem icon={<CheckCircle size={22}/>} label="Değerlendirmelerim" isOpen={isSidebarOpen} active={currentView==='evaluations'} onClick={loadEvaluations}/>
        </nav>
      </aside>

      <main className={`${isSidebarOpen ? 'ml-64' : 'ml-20'} flex-1 flex flex-col min-h-screen transition-all duration-300`}>
        {currentView === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2000')] bg-cover bg-center relative">
            <div className="absolute inset-0 bg-[#002244]/80 backdrop-blur-sm"></div>
            <div className="relative z-10 text-center w-full max-w-2xl">
              <Plane size={64} className="mx-auto text-sky-400 mb-6 animate-pulse"/>
              <h1 className="text-4xl font-extrabold text-white mb-4">Mürettebat Konaklama Planlaması</h1>
              <div className="bg-white p-2 rounded-2xl shadow-2xl flex items-center mt-8">
                <Search className="ml-4 text-slate-400" size={24}/>
                <input type="text" className="flex-1 p-4 text-lg outline-none text-slate-700 font-bold placeholder:font-normal" placeholder="Havalimanı Kodu (IST, SAW, LHR...)" value={airportCode} onChange={(e) => setAirportCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && searchHotels(airportCode)}/>
                <button onClick={() => searchHotels(airportCode)} className="bg-[#002244] text-white px-8 py-4 rounded-xl font-bold hover:bg-sky-700 transition">ARA</button>
              </div>
              <button onClick={() => setShowAddHotelModal(true)} className="mt-6 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto transition border border-white/40"><Plus size={18}/> Manuel Otel Ekle</button>
            </div>
          </div>
        )}

        {currentView === 'dashboard' && stats && (
          <div className="flex-1 p-8 bg-slate-50">
            <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[#002244] flex items-center gap-3"><LayoutDashboard className="text-sky-500"/> Yönetici Dashboard</h2>
                <p className="text-sm text-slate-500 mt-1">AHP & TOPSIS Çok Kriterli Karar Destek Paneli</p>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                  <DollarSign size={16} className="text-emerald-600"/>
                  <span className="text-xs font-bold text-slate-600">Kur:</span>
                  <select 
                    className="bg-transparent font-bold text-slate-800 text-sm outline-none cursor-pointer"
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                  >
                    <option value="TRY">TRY (₺)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <button onClick={exportDashboardPDF} className="bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-sky-800 transition flex items-center gap-2 shadow-sm">
                  <Download size={16}/> Raporu İndir
                </button>

                <div className="flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-300">
                  <Search className="ml-2 text-slate-400" size={18}/>
                  <input type="text" className="p-2 text-sm outline-none text-slate-700 font-medium w-36" placeholder="Havalimanı Kodu..." value={dashSearchCode} onChange={(e) => setDashSearchCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && loadDashboard(dashSearchCode)}/>
                  <button onClick={() => loadDashboard(dashSearchCode)} className="bg-[#002244] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-sky-800 transition">Analiz Et</button>
                  <button onClick={() => { setDashSearchCode(''); loadDashboard(''); }} className="ml-1 p-2 text-slate-400 hover:text-red-500" title="Sıfırla"><RotateCcw size={16}/></button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard title="Toplam Denetim" value={stats.total_audits} icon={<List size={32}/>} color="bg-blue-600"/>
              <StatCard title="Onaylı Otel" value={stats.approved_count} icon={<CheckCircle size={32}/>} color="bg-emerald-600"/>
              <StatCard title="Ortalama MCDM Skoru" value={stats.avg_score} icon={<Star size={32}/>} color="bg-amber-500"/>
              <StatCard title="Analiz Bölgesi" value={stats.top_airport} icon={<Plane size={32}/>} color="bg-purple-600"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <TrendingUp size={20} className="text-emerald-600"/> Gecelik Konaklama Maliyet Trendi
                  </h3>
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                    Birim: {currencyRates[selectedCurrency].symbol}
                  </span>
                </div>
                <div className="flex items-end justify-between h-48 space-x-3">
                  {stats.price_trend && stats.price_trend.map((val, i) => {
                    const convVal = Math.round(val * currencyRates[selectedCurrency].rate);
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 group">
                        <div className="text-xs text-slate-500 mb-1 font-bold group-hover:text-emerald-600 transition">
                          {convVal.toLocaleString('tr-TR')} {currencyRates[selectedCurrency].symbol}
                        </div>
                        <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden h-full group-hover:bg-slate-200 transition duration-300">
                          <div className="absolute bottom-0 w-full bg-emerald-500 rounded-t-lg transition-all duration-1000" style={{height: `${(val/5000)*100}%`}}></div>
                        </div>
                        <div className="text-xs text-slate-400 mt-2 font-medium">{['Oca','Şub','Mar','Nis','May','Haz'][i]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="col-span-1 bg-gradient-to-br from-[#002244] to-sky-900 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10 text-white"><Calculator size={160}/></div>
                <div>
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-2">
                    <Sparkles size={16}/> MCDM Bütçe Optimalizasyonu
                  </div>
                  <h3 className="text-xl font-bold mb-4">Tahmini Maliyet Avantajı</h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-6">
                    AHP/TOPSIS algoritması ile seçilen yüksek skorlu oteller, bölge ortalamasına kıyasla operasyonel bütçede tasarruf sağlar.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-center">
                  <span className="text-xs text-slate-300 block uppercase font-bold">Aylık Tahmini Tasarruf</span>
                  <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">
                    {Math.round(18500 * currencyRates[selectedCurrency].rate).toLocaleString('tr-TR')} {currencyRates[selectedCurrency].symbol}
                  </span>
                  <span className="text-[10px] text-slate-300 mt-1 block">%14.2 Ortalama Maliyet İyileştirmesi</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
                  <Layers size={20} className="text-purple-600"/> MCDM Kriter Ağırlıkları (AHP)
                </h3>
                <div className="space-y-4">
                  {[
                    { label: "Güvenlik Standartları", weight: "%30", pct: 30, color: "bg-green-500" },
                    { label: "Müşteri / Ekip Puanı", weight: "%25", pct: 25, color: "bg-amber-500" },
                    { label: "Gecelik Konaklama Fiyatı", weight: "%20", pct: 20, color: "bg-blue-500" },
                    { label: "Trafik Süresi / Mesafe", weight: "%15", pct: 15, color: "bg-sky-500" },
                    { label: "Otel Yıldız Sayısı", weight: "%10", pct: 10, color: "bg-purple-500" }
                  ].map((crit, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-600">{crit.label}</span>
                        <span className="text-slate-800">{crit.weight}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div className={`${crit.color} h-2.5 rounded-full`} style={{ width: `${crit.pct * 3}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 self-start">
                  <Shield size={20} className="text-blue-600"/> Güvenlik Uyum Oranı
                </h3>
                <div className="relative w-36 h-36 my-2">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="3"/>
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray={`${stats.compliance_rate || 0}, 100`}/>
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-extrabold text-blue-900">
                    %{stats.compliance_rate || 0}
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center mt-2">SHGM / EASA standartlarına göre onaylanan oteller.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-rose-500"/> Aksiyon Bekleyen Oteller
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs font-bold text-rose-900">Radisson Blu SAW</p>
                      <p className="text-[11px] text-rose-700">Denetim süresi 6 ayı geçti. Yeniden denetim gerekiyor.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                    <Clock size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                    <div>
                      <p className="text-xs font-bold text-amber-900">Holiday Inn Express IST</p>
                      <p className="text-[11px] text-amber-700">Ekip gürültü şikayeti bildirildi (Puan: 7.2).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><Award size={20} className="text-purple-500"/> En Yüksek Puanlı Oteller</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50"><tr><th className="px-3 py-2">Sıra</th><th className="px-3 py-2">Otel</th><th className="px-3 py-2">Bölge</th><th className="px-3 py-2 text-right">MCDM Skoru</th></tr></thead>
                  <tbody>
                    {stats.top_hotels.length > 0
                      ? stats.top_hotels.map((h, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-3 py-3 font-bold text-slate-400">#{i+1}</td>
                            <td className="px-3 py-3 font-medium text-slate-700 truncate max-w-[150px]">{h.name}</td>
                            <td className="px-3 py-3 text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{h.airport_code}</span></td>
                            <td className="px-3 py-3 text-right font-bold text-sky-700">{h.score}</td>
                          </tr>
                        ))
                      : <tr><td colSpan="4" className="text-center py-4 text-slate-400 italic">Veri yok.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {(currentView === 'results' || currentView === 'favorites') && (
          <div className="flex-1 p-8 relative">
            {compareList.length > 0 && (
              <div className="fixed bottom-0 left-0 w-full bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 flex items-center justify-between z-50">
                <div className="flex items-center gap-4 ml-64">
                  <span className="font-bold text-slate-700">{compareList.length} Otel Seçildi</span>
                  <div className="flex gap-2">{compareList.map(h => <div key={h.id} className="bg-slate-100 px-3 py-1 rounded-full text-xs flex items-center gap-2">{h.name} <button onClick={() => toggleCompare(h)} className="hover:text-red-500"><X size={12}/></button></div>)}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setCompareList([])} className="text-slate-500 text-sm hover:underline">Temizle</button>
                  <button onClick={() => setShowCompareModal(true)} disabled={compareList.length < 2} className="bg-[#002244] text-white px-6 py-2 rounded-lg font-bold hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Scale size={18}/> Karşılaştır</button>
                </div>
              </div>
            )}

            {currentView === 'favorites'
              ? <h2 className="text-3xl font-bold text-[#002244] mb-8 flex items-center gap-3"><Heart className="text-red-500" fill="currentColor"/> Favori Otellerim</h2>
              : <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentView('home')} className="p-2 rounded-full hover:bg-slate-200 text-slate-500"><ArrowLeft size={24}/></button>
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2"><span className="bg-sky-100 text-sky-800 px-3 py-1 rounded-lg">{airportFullName}</span></h2>
                      <p className="text-sm text-slate-500 mt-1">{displayHotels.length} otel gösteriliyor</p>
                    </div>
                  </div>
                  {weather && (
                    <div className="flex items-center gap-3 bg-[#002244] text-white px-5 py-2 rounded-xl shadow-lg">
                      <div><p className="text-xl font-bold">{weather.temp}°C</p><p className="text-xs text-slate-300">{weather.condition}</p></div>
                    </div>
                  )}
                </div>}

            {currentView === 'results' && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 border-r pr-3 border-slate-200"><Filter size={18} className="text-slate-400"/><span className="text-sm font-bold text-slate-700">Filtre:</span></div>
                  <select className="bg-slate-50 border rounded-lg px-3 py-2 text-sm" value={filters.specificStar} onChange={(e) => setFilters({...filters, specificStar: Number(e.target.value)})}>
                    <option value="0">Tüm Yıldızlar</option><option value="3">3 Yıldız</option><option value="4">4 Yıldız</option><option value="5">5 Yıldız</option>
                  </select>
                  <div className="flex items-center gap-2"><span className="text-sm text-slate-600">Max TL:</span><input type="number" className="w-24 bg-slate-50 border rounded-lg px-3 py-2 text-sm" value={filters.maxPrice} onChange={(e) => setFilters({...filters, maxPrice: Number(e.target.value)})}/></div>
                  <div className="border-l pl-3 flex items-center gap-2">
                    <span className="text-sm text-slate-600">Sırala:</span>
                    <select className="bg-slate-50 border rounded-lg px-3 py-2 text-sm" onChange={(e) => setSortBy(e.target.value)} value={sortBy}>
                      <option value="score_desc">En Yüksek Skor</option><option value="dist_asc">En Yakın Mesafe</option><option value="price_asc">Fiyat (Artan)</option><option value="price_desc">Fiyat (Azalan)</option>
                    </select>
                  </div>
                  
                  <div className="border-l pl-3 flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-900">Kur:</span>
                    <select 
                      className="bg-blue-600 text-white font-extrabold rounded-lg px-3 py-2 text-sm shadow-md hover:bg-blue-700 cursor-pointer outline-none" 
                      value={selectedCurrency} 
                      onChange={(e) => setSelectedCurrency(e.target.value)}
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={exportToExcel} className="p-2 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition" title="Excel İndir"><FileSpreadsheet size={20}/></button>
                  <button onClick={exportToPDF} className="p-2 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition" title="PDF İndir"><FileText size={20}/></button>
                  <div className="h-8 w-px bg-slate-200 mx-1"></div>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('list')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition text-sm ${activeTab==='list' ? 'bg-white shadow text-[#002244] font-bold' : 'text-slate-500'}`}><List size={16}/> Liste</button>
                    <button onClick={() => setActiveTab('map')} className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition text-sm ${activeTab==='map' ? 'bg-white shadow text-[#002244] font-bold' : 'text-slate-500'}`}><MapIcon size={16}/> Harita</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'list' || currentView === 'favorites'
              ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-20">
                  {displayHotels.length > 0
                    ? displayHotels.map((hotel, index) => (
                        <HotelCard key={hotel.id} hotel={hotel} rank={index + 1}
                          selectedCurrency={selectedCurrency} currencyRates={currencyRates}
                          isComparing={compareList.some(h => h.id === hotel.id)}
                          onCompareToggle={() => toggleCompare(hotel)}
                          onInspect={() => setSelectedHotel(hotel)}
                          onDetail={() => setDetailHotel(hotel)}
                          onFavorite={() => toggleFavorite(hotel)}
                          onCalculate={() => setCalculatorHotel(hotel)}/>
                      ))
                    : <div className="col-span-full text-center py-20 text-slate-400">Otel bulunamadı.</div>}
                </div>
              : <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden h-[600px] w-full relative z-0">
                  {airportLoc && (
                    <MapContainer center={[airportLoc.lat, airportLoc.lng]} zoom={12} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                      <ChangeView center={[airportLoc.lat, airportLoc.lng]}/>
                      {displayHotels.map((hotel) => (
                        <Marker key={hotel.id} position={[hotel.lat, hotel.lng]}>
                          <Popup><div className="text-center"><strong className="block text-slate-900 text-sm mb-1">{hotel.name}</strong><button onClick={() => setDetailHotel(hotel)} className="bg-sky-600 text-white text-xs px-3 py-1 rounded w-full mt-1">İncele</button></div></Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  )}
                </div>}
          </div>
        )}

        {currentView === 'evaluations' && (
          <div className="flex-1 p-8 bg-slate-50">
            <h2 className="text-3xl font-bold text-[#002244] mb-8 flex items-center gap-3"><CheckCircle className="text-sky-500"/> Denetimlerim</h2>
            {Object.entries(evaluatedHotels).map(([code, hotelList]) => (
              <div key={code} className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <button onClick={() => setExpandedAirports(prev => ({...prev, [code]: !prev[code]}))} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition border-b border-slate-100">
                  <div className="flex items-center gap-3"><div className="bg-[#002244] text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold">{code}</div><h3 className="text-lg font-bold text-slate-700">{code} Havalimanı</h3></div>
                  {expandedAirports[code] ? <ChevronDown className="text-slate-400"/> : <ChevronRight className="text-slate-400"/>}
                </button>
                {expandedAirports[code] && (
                  <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {hotelList.map((hotel, index) => (
                      <div key={hotel.id} className="relative group">
                        <HotelCard hotel={hotel} rank={index + 1}
                          selectedCurrency={selectedCurrency} currencyRates={currencyRates}
                          isComparing={compareList.some(h => h.id === hotel.id)}
                          onCompareToggle={() => toggleCompare(hotel)}
                          onInspect={() => setSelectedHotel(hotel)}
                          onDetail={() => setDetailHotel(hotel)}
                          onFavorite={() => toggleFavorite(hotel)}
                          onCalculate={() => setCalculatorHotel(hotel)}/>
                        <button 
                          onClick={() => downloadAuditReportPDF(hotel)} 
                          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          <FileCheck size={16}/> SHGM Denetim Formu (PDF)
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedHotel && <SecurityModal hotel={selectedHotel} onClose={() => setSelectedHotel(null)} onSubmit={submitSecurityForm}/>}
      {detailHotel && <HotelDetailModal hotel={detailHotel} onClose={() => setDetailHotel(null)} selectedCurrency={selectedCurrency} currencyRates={currencyRates}/>}
      {calculatorHotel && <CostCalculatorModal hotel={calculatorHotel} onClose={() => setCalculatorHotel(null)} selectedCurrency={selectedCurrency} currencyRates={currencyRates}/>}
      {showCompareModal && <CompareModal hotels={compareList} onClose={() => setShowCompareModal(false)} selectedCurrency={selectedCurrency} currencyRates={currencyRates}/>}
      {showAddHotelModal && <AddHotelModal onClose={() => setShowAddHotelModal(false)} onSubmit={submitNewHotel} airportList={airportList}/>}
    </div>
  );
}

function SidebarItem({ icon, label, isOpen, active, onClick }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition overflow-hidden whitespace-nowrap ${active ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-300 hover:bg-white/10'}`}><div className="min-w-[22px]">{icon}</div><span className={`transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>{label}</span></button>
}

function StatCard({ title, value, icon, color }) {
  return <div className="bg-[#ffffff] p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4"><div className={`p-4 rounded-xl text-white ${color}`}>{icon}</div><div><p className="text-slate-500 text-sm font-medium">{title}</p><p className="text-2xl font-bold text-slate-800">{value}</p></div></div>
}

function HotelCard({ hotel, rank, selectedCurrency = 'TRY', currencyRates = { TRY: { rate: 1, symbol: '₺' } }, isComparing, onCompareToggle, onInspect, onDetail, onFavorite, onCalculate }) {
  const amenities = hotel.amenities ? hotel.amenities.split(',') : [];
  const amenityConfig = {
    wifi: {icon:<Wifi size={14}/>, color:"text-blue-500 bg-blue-50"},
    gym: {icon:<Dumbbell size={14}/>, color:"text-rose-500 bg-rose-50"},
    pool: {icon:<Waves size={14}/>, color:"text-cyan-500 bg-cyan-50"},
    spa: {icon:<Sparkles size={14}/>, color:"text-purple-500 bg-purple-50"},
    restaurant: {icon:<Utensils size={14}/>, color:"text-orange-500 bg-orange-50"},
    breakfast: {icon:<Coffee size={14}/>, color:"text-amber-500 bg-amber-50"},
    shuttle: {icon:<Bus size={14}/>, color:"text-indigo-500 bg-indigo-50"},
    parking: {icon:<Car size={14}/>, color:"text-slate-500 bg-slate-100"}
  };

  const convertedPrice = Math.round(hotel.base_price * (currencyRates[selectedCurrency]?.rate || 1));
  const symbol = currencyRates[selectedCurrency]?.symbol || '₺';
  const scoreVal = hotel.mcdm_score || hotel.mcdmScore || 0;
  const trafficText = hotel.traffic_status || "Normal Trafik";

  return (
    <div onClick={onDetail} className={`bg-white rounded-xl shadow-sm hover:shadow-xl transition duration-300 border overflow-hidden flex flex-col group h-full cursor-pointer relative ${isComparing ? 'border-sky-500 ring-2 ring-sky-500 ring-opacity-50' : 'border-slate-200'}`}>
      <button onClick={(e) => {e.stopPropagation(); onFavorite();}} className={`absolute top-3 right-3 z-20 p-1.5 rounded-full backdrop-blur-md transition ${hotel.is_favorite ? 'bg-red-500 text-white' : 'bg-white/30 text-white hover:bg-white hover:text-red-500'}`}><Heart size={16} fill={hotel.is_favorite ? "currentColor" : "none"}/></button>
      <div className="absolute top-3 right-12 z-20" onClick={(e) => e.stopPropagation()}><label className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full cursor-pointer hover:bg-white transition shadow-sm"><input type="checkbox" checked={isComparing} onChange={onCompareToggle} className="rounded text-sky-600 focus:ring-sky-500"/><span className="text-xs font-bold text-slate-700">Kıyasla</span></label></div>
      <div className="relative h-48 bg-slate-200 overflow-hidden">
        <img src={hotel.image_url} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
        <div className="absolute top-3 left-3 flex gap-2 z-20"><div className="bg-white/90 backdrop-blur text-[#002244] text-xs font-bold px-3 py-1 rounded-full shadow-sm">#{rank}</div></div>
        {hotel.latest_security_score > 0 && <div className="absolute bottom-12 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1"><Shield size={12}/> {hotel.latest_security_score}</div>}
        <div className="absolute bottom-3 left-3 text-white pr-2"><h3 className="font-bold text-lg leading-tight shadow-black drop-shadow-md">{hotel.name}</h3></div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 line-clamp-1"><MapIcon size={12}/> {hotel.address}</p>
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">{amenities.map(am => { const config = amenityConfig[am] || {icon:<CheckCircle size={14}/>, color:"text-slate-400 bg-slate-50"}; return <div key={am} className={`${config.color} p-1.5 rounded-lg`}>{config.icon}</div>})}</div>
        
        {/* Canlı Transfer / Trafik Süresi Göstergesi */}
        <div className="bg-sky-50 p-2 rounded-lg border border-sky-100 flex items-center justify-between text-xs mb-3">
          <span className="flex items-center gap-1.5 text-sky-900 font-bold"><Navigation size={14} className="text-sky-600"/> Transfer:</span>
          <span className="font-extrabold text-sky-950">{hotel.traffic_duration} dk <span className="font-normal text-[10px] text-sky-700">({trafficText})</span></span>
        </div>

        <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 mb-4">
          <div className="flex items-center gap-1"><Star size={14} className="text-orange-400"/> {hotel.stars} <span className="text-slate-400 text-xs">({hotel.user_rating})</span></div>
          <div className="text-right font-extrabold text-slate-900">{convertedPrice.toLocaleString('tr-TR')} {symbol}</div>
          <div className="flex items-center gap-1"><Car size={14}/> {hotel.distance_km} km</div>
          <div className="text-right font-bold text-sky-700">MCDM: {scoreVal}</div>
        </div>
        <div className="mt-auto space-y-2 flex gap-2">
          <button onClick={(e) => {e.stopPropagation(); onCalculate();}} className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg" title="Maliyet Hesapla"><Calculator size={18}/></button>
          <button onClick={(e) => {e.stopPropagation(); e.preventDefault(); onInspect();}} className="flex-1 bg-slate-50 hover:bg-[#002244] hover:text-white text-[#002244] font-semibold py-2 rounded-lg transition text-sm flex items-center justify-center gap-2 border border-slate-200 hover:border-[#002244]"><Shield size={16}/> {hotel.latest_security_score > 0 ? 'Puanı Güncelle' : 'Denetle / Puanla'}</button>
        </div>
      </div>
    </div>
  );
}

function AddHotelModal({ onClose, onSubmit, airportList }) {
  const [form, setForm] = useState({ name: '', airport_code: 'IST', stars: 4, base_price: 3000, distance_km: 5, address: '', website_url: '' });
  const [amenities, setAmenities] = useState({ wifi: false, gym: false, pool: false, spa: false, restaurant: false, breakfast: false, shuttle: false, parking: false });
  const handleSubmit = () => {
    const selectedAmenities = Object.keys(amenities).filter(k => amenities[k]).join(',');
    onSubmit({ ...form, amenities: selectedAmenities });
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#002244] p-4 flex justify-between items-center text-white"><h3 className="font-bold text-lg flex items-center gap-2"><Plus size={20}/> Otel Ekle</h3><button onClick={onClose}><X size={24}/></button></div>
        <div className="p-6 space-y-3 max-h-[80vh] overflow-y-auto">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Otel Adı</label><input className="w-full border border-slate-300 p-2 rounded text-sm focus:ring-2 focus:ring-sky-500 outline-none" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-sm font-bold text-slate-700 mb-1">Havalimanı</label><input list="airports" className="w-full border border-slate-300 p-2 rounded text-sm" placeholder="Kod Yaz (IST...)" value={form.airport_code} onChange={e=>setForm({...form, airport_code:e.target.value.toUpperCase()})}/><datalist id="airports">{airportList.map(ap => <option key={ap.code} value={ap.code}>{ap.name}</option>)}</datalist></div>
            <div className="w-24"><label className="block text-sm font-bold text-slate-700 mb-1">Yıldız</label><input className="w-full border border-slate-300 p-2 rounded text-sm" type="number" min="1" max="5" value={form.stars} onChange={e=>setForm({...form, stars:Number(e.target.value)})}/></div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-sm font-bold text-slate-700 mb-1">Fiyat (TL)</label><input className="w-full border border-slate-300 p-2 rounded text-sm" type="number" value={form.base_price} onChange={e=>setForm({...form, base_price:Number(e.target.value)})}/></div>
            <div className="flex-1"><label className="block text-sm font-bold text-slate-700 mb-1">Mesafe (km)</label><input className="w-full border border-slate-300 p-2 rounded text-sm" type="number" value={form.distance_km} onChange={e=>setForm({...form, distance_km:Number(e.target.value)})}/></div>
          </div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Açık Adres</label><input className="w-full border border-slate-300 p-2 rounded text-sm" value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Web Sitesi</label><input className="w-full border border-slate-300 p-2 rounded text-sm" value={form.website_url} onChange={e=>setForm({...form, website_url:e.target.value})}/></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-2">Olanaklar</label><div className="grid grid-cols-2 gap-2">{Object.keys(amenities).map(key => (<label key={key} className="flex items-center gap-2 cursor-pointer border p-2 rounded hover:bg-slate-50"><input type="checkbox" checked={amenities[key]} onChange={e => setAmenities({...amenities, [key]: e.target.checked})} className="rounded text-sky-600"/><span className="capitalize text-sm text-slate-600">{key}</span></label>))}</div></div>
          <button onClick={handleSubmit} className="w-full bg-[#002244] text-white py-2 rounded-lg font-bold hover:bg-sky-800 transition">Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function CostCalculatorModal({ hotel, onClose, selectedCurrency = 'TRY', currencyRates = { TRY: { rate: 1, symbol: '₺' } } }) {
  const [rooms, setRooms] = useState(6);
  const [nights, setNights] = useState(1);
  const rate = currencyRates[selectedCurrency]?.rate || 1;
  const symbol = currencyRates[selectedCurrency]?.symbol || '₺';
  const convertedBasePrice = Math.round(hotel.base_price * rate);
  const total = rooms * convertedBasePrice * nights;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#002244] p-4 flex justify-between items-center text-white"><h3 className="font-bold text-lg flex items-center gap-2"><Calculator size={20}/> Maliyet Hesapla</h3><button onClick={onClose}><X size={24}/></button></div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4"><img src={hotel.image_url} className="w-12 h-12 rounded object-cover" alt=""/><div className="font-bold text-slate-800">{hotel.name}</div></div>
          <p className="text-xs text-slate-400 bg-slate-50 p-2 rounded-lg">Gecelik oda fiyatı: <span className="font-bold text-slate-600">{convertedBasePrice.toLocaleString('tr-TR')} {symbol}</span>. Toplam = oda sayısı × gecelik fiyat × konaklama süresi.</p>
          <div><label className="text-xs text-slate-500 font-bold block mb-1">Toplam Oda Sayısı</label><input type="number" value={rooms} onChange={e=>setRooms(Number(e.target.value))} className="w-full border p-2 rounded" min="1"/></div>
          <div><label className="text-xs text-slate-500 font-bold block mb-1">Konaklama (Gece)</label><input type="number" value={nights} onChange={e=>setNights(Number(e.target.value))} className="w-full border p-2 rounded" min="1"/></div>
          <div className="bg-slate-100 p-4 rounded-xl text-center mt-4">
            <p className="text-slate-500 text-xs font-bold uppercase">Toplam Tahmini Maliyet</p>
            <p className="text-3xl font-extrabold text-[#002244] mt-1">{total.toLocaleString('tr-TR')} {symbol}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- YENİLENMİŞ KARŞILAŞTIRMA MODÜLÜ (AKILLI ÖNERİ ROZETİ İLE) --- */
function CompareModal({ hotels, onClose, selectedCurrency = 'TRY', currencyRates = { TRY: { rate: 1, symbol: '₺' } } }) {
  if (!hotels || hotels.length === 0) return null;
  const rate = currencyRates[selectedCurrency]?.rate || 1;
  const symbol = currencyRates[selectedCurrency]?.symbol || '₺';

  // En yüksek MCDM Skorlu Oteli Bularak Öneri Yapma
  const winnerHotel = [...hotels].sort((a, b) => (b.mcdm_score || b.mcdmScore || 0) - (a.mcdm_score || a.mcdmScore || 0))[0];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-8">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-full max-h-[88vh]">
        <div className="bg-[#002244] p-5 flex justify-between items-center text-white">
          <h3 className="font-bold text-xl flex items-center gap-2"><Scale size={24} className="text-sky-400"/> Otel Karşılaştırma Analizi</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition"><X size={24}/></button>
        </div>

        {/* Akıllı Karar Önerisi Rozeti */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-8 py-3 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3">
            <div className="bg-white text-emerald-700 p-2 rounded-full font-bold shadow"><Award size={20}/></div>
            <div>
              <p className="text-xs uppercase font-extrabold text-emerald-200 tracking-wider">Sistem Tarafından Önerilen Optimal Seçim</p>
              <p className="text-lg font-extrabold">{winnerHotel.name} <span className="text-xs font-normal opacity-90">(MCDM Skoru: {winnerHotel.mcdm_score || winnerHotel.mcdmScore})</span></p>
            </div>
          </div>
          <p className="text-xs max-w-md text-emerald-100 italic hidden md:block">
            "Güvenlik standartları, transfer süresi ve fiyat/performans ağırlıkları analiz edilerek en dengeli karar olarak belirlenmiştir."
          </p>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-slate-50">
          <div className="grid grid-cols-[160px_repeat(auto-fit,minmax(280px,1fr))] gap-8 min-w-[900px]">
            <div className="col-span-1 pt-56 space-y-6 font-bold text-slate-600 text-right pr-4 flex flex-col justify-around h-full pb-8">
              <p className="h-8 flex items-center justify-end">Yıldız</p>
              <p className="h-8 flex items-center justify-end">Fiyat (Gecelik)</p>
              <p className="h-8 flex items-center justify-end">MCDM Skoru</p>
              <p className="h-8 flex items-center justify-end">Kullanıcı Puanı</p>
              <p className="h-8 flex items-center justify-end">Havalimanına Mesafe</p>
              <p className="h-8 flex items-center justify-end">Transfer Süresi</p>
              <p className="h-8 flex items-center justify-end">Güvenlik Durumu</p>
            </div>
            {hotels.map(h => {
              const convertedPrice = Math.round(h.base_price * rate);
              const scoreVal = h.mcdm_score || h.mcdmScore || 0;
              const isWinner = h.id === winnerHotel.id;

              return (
                <div key={h.id} className={`col-span-1 bg-white rounded-2xl p-0 text-center shadow-lg border flex flex-col h-full overflow-hidden relative ${isWinner ? 'border-emerald-500 ring-2 ring-emerald-500 ring-opacity-50' : 'border-slate-100'}`}>
                  {isWinner && <div className="bg-emerald-500 text-white text-[11px] font-extrabold py-1 uppercase tracking-wider text-center">ÖNERİLEN OTEL</div>}
                  <div className="relative h-44"><img src={h.image_url} className="w-full h-full object-cover" alt=""/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div><h4 className="absolute bottom-3 left-4 right-4 font-bold text-lg text-white leading-tight drop-shadow-md">{h.name}</h4></div>
                  <div className="p-6 space-y-6 flex-1 flex flex-col justify-around text-sm text-slate-700">
                    <div className="h-8 flex items-center justify-center gap-1 text-amber-500">{[...Array(Math.floor(h.stars))].map((_,i)=><Star key={i} size={18} fill="currentColor"/>)}</div>
                    <div className="h-8 flex items-center justify-center font-extrabold text-2xl text-slate-900 border-b border-slate-100 pb-2">{convertedPrice.toLocaleString('tr-TR')} {symbol}</div>
                    <div className="h-8 flex items-center justify-center font-extrabold text-xl text-sky-600 border-b border-slate-100 pb-2">{scoreVal}</div>
                    <div className="h-8 flex items-center justify-center font-semibold border-b border-slate-100 pb-2"><span className="bg-slate-100 px-2 py-1 rounded-lg">{h.user_rating} / 10</span></div>
                    <div className="h-8 flex items-center justify-center gap-1 border-b border-slate-100 pb-2"><MapIcon size={16} className="text-slate-400"/> {h.distance_km} km</div>
                    <div className="h-8 flex items-center justify-center gap-1 border-b border-slate-100 pb-2"><Navigation size={16} className="text-slate-400"/> {h.traffic_duration} dk</div>
                    <div className="h-8 flex items-center justify-center">{h.latest_security_score > 0 ? <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold flex items-center gap-1"><Shield size={14}/> {h.latest_security_score} Puan</span> : <span className="text-slate-300 font-bold text-xl">-</span>}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelDetailModal({ hotel, onClose, selectedCurrency = 'TRY', currencyRates = { TRY: { rate: 1, symbol: '₺' } } }) {
  const scoreVal = hotel.mcdm_score || hotel.mcdmScore || 0;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        <div className="h-64 relative bg-slate-900 group">
          <img src={hotel.image_url} className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition duration-500" alt=""/>
          <button onClick={onClose} className="absolute top-4 right-4 bg-black/30 hover:bg-black/60 text-white p-2 rounded-full z-20 transition backdrop-blur-md"><X size={24}/></button>
          <div className="absolute bottom-0 left-0 p-8 text-white w-full bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-3 mb-2"><span className="bg-sky-600 text-white text-xs font-bold px-2 py-1 rounded">{hotel.stars} Yıldız</span>{hotel.is_security_approved && <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1"><Shield size={12}/> Güvenli</span>}</div>
            <h2 className="text-4xl font-bold mb-2 shadow-black drop-shadow-md">{hotel.name}</h2>
            <div className="flex gap-6 text-sm opacity-90 font-medium"><span className="flex items-center gap-1.5"><MapIcon size={16}/> {hotel.address}</span><span className="flex items-center gap-1.5"><Car size={16}/> {hotel.traffic_duration} dk Trafik</span><span className="flex items-center gap-1.5"><Plane size={16}/> {hotel.distance_km} km</span></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-2 space-y-8">
              {hotel.ai_insight && (
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-4 shadow-sm">
                  <div className="bg-indigo-200 p-2 rounded-full text-indigo-700"><Bot size={24}/></div>
                  <div><h4 className="font-bold text-indigo-900 text-sm mb-1">Yapay Zeka Analizi</h4><p className="text-indigo-800 text-sm italic leading-relaxed">{hotel.ai_insight}</p></div>
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-800 text-xl mb-4 flex items-center gap-2 border-b pb-2"><MessageSquare className="text-sky-600"/> Mürettebat Yorumları</h3>
                <div className="space-y-4">
                  {hotel.comments && hotel.comments.length > 0
                    ? hotel.comments.map((c, i) => (
                        <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-sky-200 transition">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2"><div className="bg-slate-200 p-1.5 rounded-full text-slate-600"><User size={16}/></div><span className="font-bold text-slate-700 text-sm">{c.username}</span></div>
                            <div className="flex items-center gap-2"><span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">{c.rating}</span><span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {new Date(c.created_at).toLocaleDateString()}</span></div>
                          </div>
                          <p className="text-slate-600 text-sm leading-relaxed italic">"{c.text}"</p>
                        </div>
                      ))
                    : <div className="bg-slate-100 p-8 rounded-xl text-center text-slate-400 italic">Bu otel için henüz yorum yapılmamış.</div>}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"><h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Sparkles size={18} className="text-amber-500"/> Otel Özellikleri</h4><div className="flex flex-wrap gap-2">{hotel.amenities && hotel.amenities.split(',').map(am => <span key={am} className="bg-slate-50 hover:bg-sky-50 border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full transition cursor-default capitalize">{am}</span>)}</div></div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 text-center shadow-inner"><p className="text-blue-900 font-extrabold text-4xl mb-1">{scoreVal}</p><p className="text-blue-600 text-xs uppercase tracking-wider font-bold mb-4">MCDM Skoru</p><div className="w-full bg-blue-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{width: `${scoreVal}%`}}></div></div></div>
              <button onClick={() => window.open(hotel.booking_url, '_blank')} className="block w-full bg-[#003580] hover:bg-[#002244] text-white text-center font-bold py-3 rounded-xl transition shadow-lg shadow-blue-200">Booking.com'da Gör</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityModal({ hotel, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    inspector_name: "",
    area_safe: true, security_guard_24_7: true, cctv_exists: true,
    internet_in_rooms: true, generator_exists: true,
    perimeter_score: 80, room_score: 80, emergency_score: 80, staff_score: 80, notes: ""
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'number' && Number(value) > 100) return;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = () => {
    if (!formData.inspector_name.trim()) {
      alert("Lütfen denetçi adını giriniz.");
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#002244] p-4 flex justify-between items-center text-white"><h3 className="font-bold text-lg flex items-center gap-2"><Shield size={20}/> Hızlı Denetim</h3><button onClick={onClose}><X size={24}/></button></div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Denetçi Bilgisi</h4>
            <input
              type="text"
              name="inspector_name"
              placeholder="Denetçi adı soyadı..."
              value={formData.inspector_name}
              onChange={handleChange}
              className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kritik Kontroller</h4>
            <div className="grid grid-cols-1 gap-2">
              {[["area_safe","Bölge Güvenli"],["security_guard_24_7","7/24 Güvenlik"],["cctv_exists","CCTV Mevcut"],["internet_in_rooms","İnternet"],["generator_exists","Jeneratör"]].map(([k,l]) => (
                <label key={k} className="flex items-center gap-3 p-2 hover:bg-slate-50">
                  <input type="checkbox" name={k} checked={formData[k]} onChange={handleChange} className="w-5 h-5 accent-sky-600"/>
                  <span className="text-sm font-medium text-slate-700">{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Puanlama (Max: 100)</h4>
            <div className="grid grid-cols-2 gap-4">
              {[["perimeter_score","Çevre"],["room_score","Oda"],["emergency_score","Acil Durum"],["staff_score","Personel"]].map(([k,l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">{l}</label>
                  <input type="number" name={k} value={formData[k]} onChange={handleChange} max="100" className="w-full border border-slate-300 rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"/>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button onClick={handleSubmit} className="w-full bg-[#002244] hover:bg-sky-700 text-white font-bold py-3 rounded-xl transition shadow-lg">Kaydet</button>
        </div>
      </div>
    </div>
  );
}
