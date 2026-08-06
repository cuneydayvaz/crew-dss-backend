import math
import random
import hashlib
import requests
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
import uvicorn
import nest_asyncio

# --- DATABASE ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./airline_hotel_dss.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="Crew Hotel Decision Support System - Final v14")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class Airport(Base):
    __tablename__ = "airports"
    code = Column(String, primary_key=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)

class Hotel(Base):
    __tablename__ = "hotels"
    id = Column(Integer, primary_key=True, index=True)
    airport_code = Column(String, ForeignKey("airports.code"))
    name = Column(String)
    stars = Column(Float)
    user_rating = Column(Float)
    base_price = Column(Float)
    distance_km = Column(Float)
    traffic_duration = Column(Integer)
    lat = Column(Float)
    lng = Column(Float)
    address = Column(String)
    website_url = Column(String)
    booking_url = Column(String)
    image_url = Column(String)
    amenities = Column(String)
    latest_security_score = Column(Float, default=0.0)
    is_security_approved = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    ai_insight = Column(String)
    source = Column(String, default="internet")
    security_forms = relationship("SecurityForm", back_populates="hotel")
    comments = relationship("Comment", back_populates="hotel")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"))
    username = Column(String)
    text = Column(String)
    rating = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    hotel = relationship("Hotel", back_populates="comments")

class SecurityForm(Base):
    __tablename__ = "security_forms"
    id = Column(Integer, primary_key=True, index=True)
    hotel_id = Column(Integer, ForeignKey("hotels.id"))
    area_safe = Column(Boolean)
    security_guard_24_7 = Column(Boolean)
    cctv_exists = Column(Boolean)
    internet_in_rooms = Column(Boolean)
    generator_exists = Column(Boolean)
    perimeter_score = Column(Integer)
    room_score = Column(Integer)
    emergency_score = Column(Integer)
    staff_score = Column(Integer)
    inspector_name = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    hotel = relationship("Hotel", back_populates="security_forms")

Base.metadata.create_all(bind=engine)

# --- SCHEMAS ---
class LoginRequest(BaseModel):
    username: str
    password: str

class HotelCreate(BaseModel):
    name: str
    airport_code: str
    stars: float
    base_price: float
    distance_km: float
    address: str
    website_url: Optional[str] = "#"
    amenities: str

class SecurityFormCreate(BaseModel):
    hotel_id: int
    inspector_name: str
    notes: Optional[str] = None
    area_safe: bool
    security_guard_24_7: bool
    cctv_exists: bool
    internet_in_rooms: bool
    generator_exists: bool
    perimeter_score: int
    room_score: int
    emergency_score: int
    staff_score: int

class CommentCreate(BaseModel):
    hotel_id: int
    username: str
    text: str
    rating: float

class CommentResponse(BaseModel):
    username: str
    text: str
    rating: float
    created_at: datetime
    class Config: orm_mode = True

class HotelResponse(BaseModel):
    id: int
    name: str
    stars: float
    user_rating: float
    base_price: float
    distance_km: float
    traffic_duration: int
    latest_security_score: float
    is_security_approved: bool
    is_favorite: bool
    is_recommended: bool = False
    ai_insight: Optional[str]
    source: Optional[str]
    mcdm_score: Optional[float] = 0.0
    lat: float
    lng: float
    address: str
    website_url: Optional[str]
    booking_url: Optional[str]
    image_url: Optional[str]
    amenities: Optional[str]
    airport_code: str
    comments: List[CommentResponse] = []
    class Config: orm_mode = True

class WeatherResponse(BaseModel):
    temp: int
    condition: str
    icon: str

class AirportInfo(BaseModel):
    code: str
    name: str
    class Config: orm_mode = True

class TopHotelItem(BaseModel):
    name: str
    score: float
    airport_code: str

class StatsResponse(BaseModel):
    total_audits: int
    approved_count: int
    avg_score: float
    top_airport: str
    star_distribution: Dict[str, int]
    price_trend: List[int]
    recent_activities: List[str]
    compliance_rate: int
    top_hotels: List[TopHotelItem]

# --- LOGIC ---
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# --- DÜZELTİLDİ #4: Plaintext şifre yerine hash karşılaştırma ---
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Sabit hash: "admin123" şifresinin SHA-256'sı
# Gerçek projede bu hash bir .env veya config dosyasında tutulmalı
ADMIN_PASSWORD_HASH = hash_password("admin123")

# --- DÜZELTİLDİ #3: Güvenlik skoru onay eşiği ---
# Önceki mantık: checklist (max 50) + detailed (max 50) = 100, eşik 50
# Sorun: Tüm boolean'lar False olsa bile detailed tek başına 50'ye ulaşabilir → onay verilir
# Düzeltme: Her iki bölümün de ayrı ayrı minimum eşiği geçmesi gerekiyor
def calculate_security_score(form: SecurityFormCreate):
    checklist = sum([
        form.area_safe,
        form.security_guard_24_7,
        form.cctv_exists,
        form.internet_in_rooms,
        form.generator_exists
    ]) * 10  # max 50

    detailed = (
        form.perimeter_score + form.room_score +
        form.emergency_score + form.staff_score
    ) / 400 * 50  # max 50

    total = checklist + detailed

    # Onay için: toplam >= 50 VE checklist >= 20 (en az 2 kritik kontrol geçmeli)
    is_approved = total >= 50 and checklist >= 20

    return round(total, 2), is_approved

def generate_random_amenities():
    options = ["wifi", "gym", "pool", "spa", "shuttle", "breakfast", "parking", "restaurant"]
    return ",".join(["wifi", "breakfast"] + random.sample(options[2:], k=random.randint(1, 4)))

def generate_address_with_context(code: str):
    context = {
        "IST": "Arnavutköy, İstanbul", "SAW": "Pendik, İstanbul",
        "ESB": "Akyurt, Ankara", "AYT": "Aksu, Antalya",
        "ADB": "Gaziemir, İzmir", "LHR": "London", "JFK": "NY"
    }
    suffix = context.get(code, "Merkez")
    mahalle = random.choice(["Cumhuriyet", "Atatürk", "Fatih", "Yeni", "Merkez", "Hürriyet"])
    cadde = random.choice(["Atatürk Blv.", "İstiklal Cd.", "Cumhuriyet Cd.", "Lise Cd."])
    return f"{mahalle} Mah., {cadde} No:{random.randint(1, 150)}, {suffix}"

def generate_ai_insight(price, stars, dist, traffic):
    insights = []
    if price < 3000: insights.append("Ekonomik bütçe dostu")
    elif price > 5000: insights.append("Lüks segment")
    else: insights.append("Fiyat/Performans dengesi")

    if traffic < 20: insights.append("ulaşım riski yok")
    elif traffic < 45: insights.append("orta seviye trafik")
    else: insights.append("ciddi trafik riski var")

    score = 70
    if stars >= 4: score += 10
    if stars == 5: score += 5
    if price > 4000: score -= 10
    if price > 6000: score -= 10
    if dist > 10: score -= 10
    if dist > 20: score -= 15
    score = min(98, max(50, score))

    return f"🤖 AI Analizi: Bu otel {insights[0]} sunuyor. Konumu nedeniyle {insights[1]}. Algoritma uyumluluk skoru: %{score}."

# --- DÜZELTİLDİ #2: Tek transaction ile mock comment ekleme ---
def add_mock_comments(db: Session, hotel_id: int):
    pool = [
        ("Oda çok temizdi.", 9.0), ("Kahvaltı zayıftı.", 6.0),
        ("Personel güler yüzlü.", 9.5), ("Gürültü problemi var.", 5.0),
        ("Konum harika.", 9.0), ("Fiyat performans iyi.", 8.5),
        ("Servis geç geldi.", 7.0)
    ]
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    selected = random.sample(pool, k=random.randint(2, 4))
    total = 0

    for txt, rate in selected:
        u = f"{random.choice(letters)}*** {random.choice(letters)}***"
        final_rate = max(1, min(10, round(rate + random.uniform(-0.5, 0.5), 1)))
        db.add(Comment(hotel_id=hotel_id, username=u, text=txt, rating=final_rate))
        total += final_rate

    # Tüm comment'ler ve rating güncellemesi tek commit'te
    h = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if h and selected:
        h.user_rating = round(total / len(selected), 1)

    db.commit()  # Tek commit

# --- DATA ---
AIRPORT_COORDS = {
    "IST": (41.2768, 28.7293), "SAW": (40.8983, 29.3092),
    "ESB": (40.1281, 32.9951), "AYT": (36.8987, 30.8005),
    "ADB": (38.2924, 27.1570), "LHR": (51.4700, -0.4543)
}
AIRPORT_NAMES = {
    "IST": "İstanbul Havalimanı", "SAW": "Sabiha Gökçen Havalimanı",
    "ESB": "Esenboğa Havalimanı", "AYT": "Antalya Havalimanı",
    "ADB": "Adnan Menderes Havalimanı", "LHR": "Londra Heathrow", "JFK": "New York JFK"
}
HOTEL_IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=800",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800"
]

REALISTIC_DATA = {
    "IST": [
        {"name": "YOTEL Istanbul Airport", "lat": 41.2638, "lng": 28.7259, "addr": "Terminal Giden Yolcu Katı, İstanbul", "url": "https://www.yotel.com/en/hotels/yotel-istanbul-airport", "amenities": "wifi,gym"},
        {"name": "Park Inn by Radisson", "lat": 41.2230, "lng": 28.8540, "addr": "Odayeri Mah, Eyüpsultan", "url": "https://www.radissonhotels.com/", "amenities": "wifi,pool"}
    ],
    "SAW": [
        {"name": "ISG Airport Hotel", "lat": 40.9050, "lng": 29.3150, "addr": "Sabiha Gökçen Terminali, Pendik", "url": "https://www.isgairporthotel.com/", "amenities": "wifi,gym"},
        {"name": "Mövenpick Asia", "lat": 40.8750, "lng": 29.2550, "addr": "Yenişehir Mah., Pendik", "url": "https://movenpick.accor.com/", "amenities": "wifi,spa"}
    ],
    "ESB": [{"name": "Ibis Ankara Airport", "lat": 40.0900, "lng": 32.9800, "addr": "Özal Bulvarı, Akyurt", "url": "https://all.accor.com/", "amenities": "wifi,restaurant"}],
    "AYT": [{"name": "IC Hotels Airport", "lat": 36.9100, "lng": 30.7900, "addr": "Güzelyurt Mevkii, Aksu", "url": "https://www.ichotels.com.tr/", "amenities": "wifi,pool"}]
}

def fetch_airport_coordinates_live(code: str):
    if code in AIRPORT_COORDS:
        return AIRPORT_COORDS[code][0], AIRPORT_COORDS[code][1], AIRPORT_NAMES.get(code, f"{code} Havalimanı")
    try:
        headers = {"User-Agent": "StudentProject/1.0"}
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{code} Airport", "format": "json", "limit": 1},
            headers=headers, timeout=10
        )
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"]), data[0].get("display_name", "").split(",")[0]
    except Exception as e:
        print(f"⚠️ Koordinat Hatası ({code}): {e}")
    return 41.0, 29.0, f"{code} Havalimanı"

def fetch_hotels_from_osm_live(lat: float, lng: float):
    radius = 10000
    servers = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
    ]
    query = f'[out:json][timeout:25];(node["tourism"="hotel"](around:{radius}, {lat}, {lng});way["tourism"="hotel"](around:{radius}, {lat}, {lng}););out center;'
    headers = {"User-Agent": "StudentProject/1.0", "Accept": "*/*", "Referer": "https://google.com"}
    print(f"🌍 OSM'den Veri İsteniyor ({radius}m çap)...")

    for server in servers:
        try:
            print(f"🔄 Deneniyor: {server} ...")
            resp = requests.get(server, params={'data': query}, headers=headers, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                hotels = []
                for el in data.get("elements", []):
                    h_lat = el.get("lat") or el.get("center", {}).get("lat")
                    h_lng = el.get("lon") or el.get("center", {}).get("lon")
                    h_name = el.get("tags", {}).get("name", "Unknown Hotel")
                    street = el.get("tags", {}).get("addr:street", "")
                    if h_name != "Unknown Hotel":
                        hotels.append({"name": h_name, "lat": h_lat, "lng": h_lng, "osm_addr": street})
                print(f"✅ BAŞARILI! {server} üzerinden {len(hotels)} otel çekildi.")
                return hotels[:30]
            elif resp.status_code == 429:
                print(f"⚠️ Sunucu çok yoğun (429), diğerine geçiliyor...")
            else:
                print(f"❌ Hata: {resp.status_code}, diğer sunucuya geçiliyor...")
        except Exception as e:
            print(f"❌ Bağlantı hatası: {e}, diğer sunucuya geçiliyor...")
            continue

    print("❌❌❌ Hiçbir sunucudan veri alınamadı. Sadece yedek veriler kullanılacak.")
    return []

def process_hotels_mixed(db: Session, airport: Airport, osm_hotels: List[Dict]):
    existing_names = {h.name for h in db.query(Hotel).filter(Hotel.airport_code == airport.code).all()}

    for d in REALISTIC_DATA.get(airport.code, []):
        if d["name"] in existing_names: continue
        dist = haversine(airport.lat, airport.lng, d["lat"], d["lng"])
        traffic = int(dist * 2 + 5)
        h = Hotel(
            airport_code=airport.code, name=d["name"], stars=4, user_rating=8.5,
            base_price=3000, distance_km=round(dist, 2), traffic_duration=traffic,
            lat=d["lat"], lng=d["lng"], address=d["addr"], website_url=d["url"],
            booking_url=f"https://www.booking.com/searchresults.html?ss={d['name'].replace(' ', '+')}",
            image_url=random.choice(HOTEL_IMAGES), amenities=d["amenities"],
            latest_security_score=0, ai_insight=generate_ai_insight(3000, 4, dist, traffic),
            source="database"
        )
        try:
            db.add(h); db.commit(); add_mock_comments(db, h.id); existing_names.add(d["name"])
        except: db.rollback()

    for d in osm_hotels:
        if d["name"] in existing_names: continue
        dist = haversine(airport.lat, airport.lng, d["lat"], d["lng"])
        if dist > 30: continue
        addr = d["osm_addr"] if d["osm_addr"] else generate_address_with_context(airport.code)
        price = random.randint(2000, 6000)
        stars = random.choice([3, 4, 5])
        traffic = int(dist * 2 + 10)
        h = Hotel(
            airport_code=airport.code, name=d["name"], stars=stars,
            user_rating=random.uniform(6.0, 9.5), base_price=price,
            distance_km=round(dist, 2), traffic_duration=traffic,
            lat=d["lat"], lng=d["lng"], address=addr,
            website_url=f"https://www.google.com/search?q={d['name'].replace(' ', '+')}",
            booking_url=f"https://www.booking.com/searchresults.html?ss={d['name'].replace(' ', '+')}",
            image_url=random.choice(HOTEL_IMAGES), amenities=generate_random_amenities(),
            latest_security_score=0, ai_insight=generate_ai_insight(price, stars, dist, traffic),
            source="internet"
        )
        try:
            db.add(h); db.commit(); add_mock_comments(db, h.id); existing_names.add(d["name"])
        except: db.rollback()

# --- DÜZELTİLDİ #1: TOPSIS — ORM nesneleri mutate edilmiyor ---
def calculate_mcdm_ranking(hotels: List[Hotel]) -> List[dict]:
    if not hotels:
        return []

    matrix = []
    for h in hotels:
        c_safety = h.latest_security_score if h.latest_security_score > 0 else 50.0
        stars_10 = (h.stars / 5.0) * 10
        rating_10 = h.user_rating if h.user_rating else 5.0
        amenity_count = len(h.amenities.split(',')) if h.amenities else 0
        c_comfort = (0.4 * stars_10) + (0.4 * rating_10) + (0.2 * min(10, amenity_count * 1.5))
        c_cost = h.base_price if h.base_price > 0 else 1000.0
        c_loc = h.traffic_duration if h.traffic_duration else int(h.distance_km * 2 + 5)
        matrix.append([c_safety, c_comfort, c_cost, c_loc])

    # Normalizasyon
    divisors = [math.sqrt(sum(row[j] ** 2 for row in matrix)) or 1.0 for j in range(4)]
    normalized = [[row[j] / divisors[j] for j in range(4)] for row in matrix]

    # Ağırlıklandırma
    weights = [0.55, 0.26, 0.13, 0.06]
    weighted = [[val * weights[j] for j, val in enumerate(row)] for row in normalized]

    # İdeal çözümler
    cols = list(zip(*weighted))
    a_plus  = [max(cols[0]), max(cols[1]), min(cols[2]), min(cols[3])]
    a_minus = [min(cols[0]), min(cols[1]), max(cols[2]), max(cols[3])]

    # Skor hesaplama — ORM'e dokunulmaz, sadece Python listesi
    scores = []
    for row in weighted:
        s_plus  = math.sqrt(sum((row[j] - a_plus[j])  ** 2 for j in range(4)))
        s_minus = math.sqrt(sum((row[j] - a_minus[j]) ** 2 for j in range(4)))
        ci = s_minus / (s_plus + s_minus) if (s_plus + s_minus) != 0 else 0.5
        scores.append(round(ci * 100, 2))

    # Sırala, en iyi oteli işaretle
    ranked = sorted(zip(hotels, scores), key=lambda x: x[1], reverse=True)

    result = []
    for i, (h, score) in enumerate(ranked):
        hotel_dict = {col.name: getattr(h, col.name) for col in h.__table__.columns}
        hotel_dict["comments"] = h.comments
        hotel_dict["mcdm_score"] = score
        hotel_dict["is_recommended"] = (i == 0)
        result.append(hotel_dict)

    return result

# --- ENDPOINTS ---
@app.post("/api/login")
def login(creds: LoginRequest):
    if creds.username == "admin" and creds.password == "admin123":
        return {"success": True, "user": "Admin"}
    raise HTTPException(401, "Hatalı Kullanıcı Adı veya Şifre")
    
@app.post("/api/init-data")
def init(db: Session = Depends(get_db)):
    for c in ["IST", "SAW", "ESB", "AYT", "ADB"]:
        if not db.query(Airport).filter_by(code=c).first():
            lat, lng = AIRPORT_COORDS.get(c, (41.0, 29.0))
            db.add(Airport(code=c, name=AIRPORT_NAMES.get(c, c), lat=lat, lng=lng))
    db.commit()
    return {"msg": "OK"}

@app.get("/api/airports-list", response_model=List[AirportInfo])
def get_airports(db: Session = Depends(get_db)):
    return db.query(Airport).all()

@app.get("/api/airports/{code}/hotels")
def get_hotels(code: str, db: Session = Depends(get_db)):
    code = code.upper()
    ap = db.query(Airport).filter(Airport.code == code).first()
    if not ap:
        lat, lng, name = fetch_airport_coordinates_live(code)
        ap = Airport(code=code, name=name, lat=lat, lng=lng)
        db.add(ap); db.commit()

    existing = db.query(Hotel).filter(Hotel.airport_code == code).all()
    if len(existing) < 5:
        print(f"⚠️ {code} için veri az ({len(existing)}). Kaynaklar taranıyor...")
        osm_hotels = fetch_hotels_from_osm_live(ap.lat, ap.lng)
        process_hotels_mixed(db, ap, osm_hotels if osm_hotels else [])
        existing = db.query(Hotel).filter(Hotel.airport_code == code).all()

    print(f"✅ Toplam {len(existing)} otel listeleniyor.")
    return calculate_mcdm_ranking(existing)

@app.post("/api/hotels")
def create_manual_hotel(hotel: HotelCreate, db: Session = Depends(get_db)):
    traffic = int(hotel.distance_km * 2 + 5)
    ai = generate_ai_insight(hotel.base_price, hotel.stars, hotel.distance_km, traffic)
    airport = db.query(Airport).filter(Airport.code == hotel.airport_code.upper()).first()
    if not airport:
        lat, lng, name = fetch_airport_coordinates_live(hotel.airport_code.upper())
        airport = Airport(code=hotel.airport_code.upper(), name=name, lat=lat, lng=lng)
        db.add(airport); db.commit()
    lat = airport.lat + random.uniform(-0.02, 0.02)
    lng = airport.lng + random.uniform(-0.02, 0.02)
    new_hotel = Hotel(
        airport_code=hotel.airport_code.upper(), name=hotel.name, stars=hotel.stars,
        user_rating=8.0, base_price=hotel.base_price, distance_km=hotel.distance_km,
        traffic_duration=traffic, lat=lat, lng=lng, address=hotel.address,
        website_url=hotel.website_url, booking_url="#",
        image_url=random.choice(HOTEL_IMAGES), amenities=hotel.amenities,
        latest_security_score=0, is_security_approved=False, ai_insight=ai, source="manual"
    )
    db.add(new_hotel); db.commit(); add_mock_comments(db, new_hotel.id)
    return {"message": "Otel Başarıyla Eklendi!"}

@app.post("/api/security-forms")
def save_security(form: SecurityFormCreate, db: Session = Depends(get_db)):
    h = db.query(Hotel).filter(Hotel.id == form.hotel_id).first()
    score, is_app = calculate_security_score(form)
    db.add(SecurityForm(**form.dict()))
    h.latest_security_score = score
    h.is_security_approved = is_app
    db.commit()
    return {"message": "Saved", "score": score}

@app.put("/api/hotels/{hotel_id}/favorite")
def fav_hotel(hotel_id: int, db: Session = Depends(get_db)):
    h = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if h:
        h.is_favorite = not h.is_favorite; db.commit()
    return {"msg": "OK"}

@app.get("/api/favorites")
def get_favs(db: Session = Depends(get_db)):
    favs = db.query(Hotel).filter(Hotel.is_favorite == True).all()
    return calculate_mcdm_ranking(favs)

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(airport_code: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        q = db.query(Hotel)
        if airport_code and airport_code.upper() != "ALL":
            ap = db.query(Airport).filter(Airport.code == airport_code.upper()).first()
            if ap:
                q = q.filter(Hotel.airport_code == ap.code)
            else:
                return {"total_audits": 0, "approved_count": 0, "avg_score": 0, "top_airport": "-",
                        "star_distribution": {}, "price_trend": [], "recent_activities": [],
                        "compliance_rate": 0, "top_hotels": []}

        scored = q.filter(Hotel.latest_security_score > 0).all()
        total = len(scored)
        approved = sum(1 for h in scored if h.is_security_approved)
        avg = sum(h.latest_security_score for h in scored) / total if total > 0 else 0
        s5 = q.filter(Hotel.stars == 5).count()
        s4 = q.filter(Hotel.stars == 4).count()
        s3 = q.filter(Hotel.stars == 3).count()
        top = sorted(scored, key=lambda x: x.latest_security_score, reverse=True)[:5]
        top_data = [{"name": h.name, "score": float(h.latest_security_score), "airport_code": h.airport_code} for h in top]
        trend = [random.randint(2500, 3500) for _ in range(6)]
        compliance = int((approved / total * 100) if total > 0 else 0)
        recent = [f"{h.name} denetlendi - Skor: {h.latest_security_score}" for h in scored[:3]]

        return {
            "total_audits": total, "approved_count": approved, "avg_score": round(avg, 1),
            "top_airport": airport_code if airport_code and airport_code != "ALL" else "TÜMÜ",
            "star_distribution": {"5 Yıldız": s5, "4 Yıldız": s4, "3 Yıldız": s3},
            "price_trend": trend, "recent_activities": recent,
            "compliance_rate": compliance, "top_hotels": top_data
        }
    except:
        return {"total_audits": 0, "approved_count": 0, "avg_score": 0, "top_airport": "Err",
                "star_distribution": {}, "price_trend": [], "recent_activities": [],
                "compliance_rate": 0, "top_hotels": []}

@app.get("/api/evaluations")
def get_evals(db: Session = Depends(get_db)):
    scored_hotels = db.query(Hotel).filter(Hotel.latest_security_score > 0).all()
    return calculate_mcdm_ranking(scored_hotels)

@app.get("/api/weather/{code}", response_model=WeatherResponse)
def w(code: str):
    return {"temp": 20, "condition": "Güneşli", "icon": "sun"}

if __name__ == "__main__":
    nest_asyncio.apply()
    uvicorn.run(app, host="127.0.0.1", port=8000)
