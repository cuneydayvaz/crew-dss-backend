import os
import json
import random
import requests
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Crew Hotel DSS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "data", "hotels_database.json")

HOTEL_IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=800",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800"
]

REAL_HOTEL_BRANDS = [
    "Hilton Garden Inn", "Radisson Blu Hotel", "Courtyard by Marriott",
    "Crowne Plaza", "Holiday Inn Express", "Hampton by Hilton",
    "Sheraton Airport Hotel", "Novotel", "Ramada Plaza", "Mövenpick Hotel"
]

class LoginRequest(BaseModel):
    username: str
    password: str

FAVORITES_DB = []
EVALUATIONS_DB = []

# --- MCDM SKOR HESAPLAMA ---
def calculate_mcdm_score(price, distance, rating, security_score, stars):
    w_sec = 0.30
    w_rat = 0.25
    w_prc = 0.20
    w_dst = 0.15
    w_str = 0.10

    norm_sec = (security_score / 10.0) * 100
    norm_rat = (rating / 10.0) * 100
    norm_str = (stars / 5.0) * 100
    norm_prc = max(0, 100 - ((price - 2000) / 5000 * 100))
    norm_dst = max(0, 100 - ((distance - 1) / 24 * 100))

    final_score = (
        (norm_sec * w_sec) +
        (norm_rat * w_rat) +
        (norm_prc * w_prc) +
        (norm_dst * w_dst) +
        (norm_str * w_str)
    )
    return round(final_score, 1)

def load_json_data():
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"JSON Okuma Hatasi: {e}")
    return {}

def save_json_data(data):
    try:
        os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"JSON Yazma Hatasi: {e}")

def fetch_live_osm_hotels(lat=41.0082, lng=28.9784):
    radius = 15000
    query = f'''
    [out:json][timeout:12];
    (
      node["tourism"="hotel"](around:{radius}, {lat}, {lng});
      way["tourism"="hotel"](around:{radius}, {lat}, {lng});
      node["tourism"="motel"](around:{radius}, {lat}, {lng});
    );
    out center 15;
    '''
    try:
        resp = requests.get(
            "https://overpass-api.de/api/interpreter",
            params={'data': query},
            headers={"User-Agent": "CrewDSSHotelBot/1.0"},
            timeout=10
        )
        if resp.status_code == 200:
            elements = resp.json().get("elements", [])
            results = []
            for el in elements:
                tags = el.get("tags", {})
                name = tags.get("name")
                if name:
                    el_lat = el.get("lat") or el.get("center", {}).get("lat", lat)
                    el_lng = el.get("lon") or el.get("center", {}).get("lon", lng)
                    address = tags.get("addr:street") or tags.get("addr:full") or "Havalimanı Çevresi"
                    results.append({
                        "name": name,
                        "lat": el_lat,
                        "lng": el_lng,
                        "address": address
                    })
            if results:
                return results[:12]
    except Exception as e:
        print(f"OSM Canli Arama Hatasi: {e}")
    return []

# --- ENDPOINT'LER ---

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Crew Hotel DSS Backend API Online"}

@app.post("/api/login")
def login(req: LoginRequest):
    if req.username in ["admin", "user"] and req.password in ["admin", "admin123", "123456"]:
        return {
            "token": "fake-jwt-token-crew-dss",
            "user": {"username": req.username, "name": "Operations Officer", "role": "admin"}
        }
    raise HTTPException(status_code=401, detail="Hatalı kullanıcı adı veya şifre!")

@app.post("/api/init-data")
def init_data():
    return {"message": "Data initialized successfully"}

@app.get("/api/currencies")
def get_currencies():
    return {
        "TRY": {"rate": 1.0, "symbol": "₺", "label": "TRY (₺)"},
        "EUR": {"rate": 0.026, "symbol": "€", "label": "EUR (€)"},
        "USD": {"rate": 0.028, "symbol": "$", "label": "USD ($)"}
    }

@app.get("/api/stats")
def get_dashboard_stats(airport_code: Optional[str] = "ALL"):
    db = load_json_data()
    all_hotels = []
    
    for code, data in db.items():
        if airport_code != "ALL" and code != airport_code.upper():
            continue
        all_hotels.extend(data.get("hotels", []))

    if not all_hotels:
        return {
            "total_audits": 24,
            "approved_count": 18,
            "avg_score": 82.4,
            "compliance_rate": 88,
            "top_airport": airport_code if airport_code != "ALL" else "SAW",
            "price_trend": [3400, 3600, 3850, 4100, 3950, 4200],
            "star_distribution": {"5 Yıldız": 8, "4 Yıldız": 12, "3 Yıldız": 4},
            "top_hotels": [
                {"name": "Radisson Blu SAW", "airport_code": "SAW", "score": 92.4},
                {"name": "Crowne Plaza IST", "airport_code": "IST", "score": 89.1},
                {"name": "Hilton Garden Inn ESB", "airport_code": "ESB", "score": 87.5}
            ],
            "recent_activities": [
                "SAW - Radisson Blu güvenlik denetimi tamamlandı.",
                "IST - Crowne Plaza listeye eklendi.",
                "ESB - Hilton Garden Inn güncellendi."
            ]
        }

    total_audits = len(all_hotels)
    approved_count = sum(1 for h in all_hotels if h.get("is_security_approved", True))
    avg_score = round(sum(h.get("mcdm_score", 80) for h in all_hotels) / total_audits, 1) if total_audits > 0 else 0.0
    
    stars_count = {"5 Yıldız": 0, "4 Yıldız": 0, "3 Yıldız": 0}
    for h in all_hotels:
        st = h.get("stars", 4)
        if st == 5: stars_count["5 Yıldız"] += 1
        elif st == 4: stars_count["4 Yıldız"] += 1
        else: stars_count["3 Yıldız"] += 1

    top_sorted = sorted(all_hotels, key=lambda x: x.get("mcdm_score", 0), reverse=True)[:5]
    top_hotels_formatted = [
        {"name": h.get("name"), "airport_code": h.get("airport_code"), "score": h.get("mcdm_score")}
        for h in top_sorted
    ]

    return {
        "total_audits": total_audits,
        "approved_count": approved_count,
        "avg_score": avg_score,
        "compliance_rate": round((approved_count / total_audits) * 100) if total_audits > 0 else 90,
        "top_airport": airport_code if airport_code != "ALL" else "GENEL",
        "price_trend": [3200, 3450, 3700, 3900, 4150, 4300],
        "star_distribution": stars_count,
        "top_hotels": top_hotels_formatted,
        "recent_activities": [
            f"{h.get('airport_code')} - {h.get('name')} verisi güncellendi." for h in top_sorted[:3]
        ]
    }

@app.get("/api/airports-list")
def get_airports_list():
    return [
        {"code": "IST", "name": "İstanbul Havalimanı"},
        {"code": "SAW", "name": "Sabiha Gökçen Havalimanı"},
        {"code": "ESB", "name": "Esenboğa Havalimanı"},
        {"code": "AYT", "name": "Antalya Havalimanı"},
        {"code": "ADB", "name": "Adnan Menderes Havalimanı"},
        {"code": "OGU", "name": "Ordu-Giresun Havalimanı"},
        {"code": "JFK", "name": "New York JFK Havalimanı"},
        {"code": "LHR", "name": "Londra Heathrow Havalimanı"}
    ]

@app.get("/api/airports/{airport_code}/hotels")
def get_airport_hotels(airport_code: str):
    code = airport_code.upper()
    db = load_json_data()
    
    if code in db and db[code].get("hotels"):
        hotels = db[code]["hotels"]
        for h in hotels:
            if "mcdm_score" not in h or not h["mcdm_score"]:
                score = calculate_mcdm_score(
                    price=h.get("base_price", 3500),
                    distance=h.get("distance_km", 10.0),
                    rating=h.get("user_rating", 8.0),
                    security_score=h.get("latest_security_score", 8.5),
                    stars=h.get("stars", 4)
                )
                h["mcdm_score"] = score
                h["mcdmScore"] = score
        return hotels

    print(f"🔍 {code} için veriler işleniyor...")
    raw_hotels = fetch_live_osm_hotels()

    if not raw_hotels:
        selected_brands = random.sample(REAL_HOTEL_BRANDS, k=6)
        for i, brand in enumerate(selected_brands):
            raw_hotels.append({
                "name": f"{brand} {code}",
                "lat": 41.0 + random.uniform(-0.02, 0.02),
                "lng": 29.0 + random.uniform(-0.02, 0.02),
                "address": f"Havalimanı Yolu Caddesi No:{i*12 + 10}"
            })

    processed_hotels = []
    for idx, h in enumerate(raw_hotels):
        stars = random.choice([4, 5])
        rating = round(random.uniform(8.1, 9.7), 1)
        price = random.randint(2800, 6500)
        distance = round(random.uniform(1.5, 14.0), 1)
        sec_score = round(random.uniform(7.5, 9.8), 1)

        mcdm_val = calculate_mcdm_score(price, distance, rating, sec_score, stars)

        hotel_obj = {
            "id": idx + 1,
            "airport_code": code,
            "name": h["name"],
            "stars": stars,
            "user_rating": rating,
            "base_price": price,
            "distance_km": distance,
            "traffic_duration": random.randint(8, 30),
            "lat": h["lat"],
            "lng": h["lng"],
            "address": h["address"],
            "website_url": f"https://www.google.com/search?q={h['name'].replace(' ', '+')}",
            "booking_url": f"https://www.booking.com/searchresults.html?ss={h['name'].replace(' ', '+')}",
            "image_url": random.choice(HOTEL_IMAGES),
            "amenities": "wifi,breakfast,shuttle,gym",
            "latest_security_score": sec_score,
            "is_security_approved": True,
            "is_favorite": False,
            "mcdm_score": mcdm_val,
            "mcdmScore": mcdm_val,
            "score": mcdm_val
        }
        processed_hotels.append(hotel_obj)

    db[code] = {
        "airport": {"name": f"{code} Havalimanı", "lat": 41.0, "lng": 29.0},
        "hotels": processed_hotels
    }
    save_json_data(db)
    return processed_hotels

@app.get("/api/weather/{airport_code}")
def get_weather(airport_code: str):
    return {"temp": 22, "condition": "Güneşli", "icon": "sunny"}

@app.get("/api/favorites")
def get_favorites():
    return FAVORITES_DB

@app.get("/api/evaluations")
def get_evaluations():
    return EVALUATIONS_DB
