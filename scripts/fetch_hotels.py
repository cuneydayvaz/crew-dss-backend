import os
import json
import random
import requests

AIRPORTS = {
    "IST": {"name": "İstanbul Havalimanı", "lat": 41.2768, "lng": 28.7293},
    "SAW": {"name": "Sabiha Gökçen Havalimanı", "lat": 40.8983, "lng": 29.3092},
    "ESB": {"name": "Esenboğa Havalimanı", "lat": 40.1281, "lng": 32.9951},
    "AYT": {"name": "Antalya Havalimanı", "lat": 36.8987, "lng": 30.8005},
    "ADB": {"name": "Adnan Menderes Havalimanı", "lat": 38.2924, "lng": 27.1570},
    "DLM": {"name": "Dalaman Havalimanı", "lat": 36.7131, "lng": 28.7925},
    "BJV": {"name": "Milas-Bodrum Havalimanı", "lat": 37.2506, "lng": 27.6644},
    "TZX": {"name": "Trabzon Havalimanı", "lat": 40.9951, "lng": 39.7897},
    "LHR": {"name": "Londra Heathrow Havalimanı", "lat": 51.4700, "lng": -0.4543},
    "JFK": {"name": "New York JFK Havalimanı", "lat": 40.6413, "lng": -73.7781}
}

HOTEL_IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=800",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800"
]

def fetch_osm_hotels(lat, lng):
    radius = 12000
    query = f'[out:json][timeout:15];(node["tourism"="hotel"](around:{radius}, {lat}, {lng}););out center;'
    try:
        resp = requests.get(
            "https://overpass-api.de/api/interpreter",
            params={'data': query},
            headers={"User-Agent": "CrewDSSHotelBot/1.0"},
            timeout=12
        )
        if resp.status_code == 200:
            elements = resp.json().get("elements", [])
            results = []
            for el in elements:
                name = el.get("tags", {}).get("name")
                if name:
                    results.append({
                        "name": name,
                        "lat": el.get("lat") or el.get("center", {}).get("lat"),
                        "lng": el.get("lon") or el.get("center", {}).get("lon"),
                        "address": el.get("tags", {}).get("addr:street", "Merkez")
                    })
            return results[:15]
    except Exception as e:
        print(f"OSM Hatasi: {e}")
    return []

def main():
    database = {}
    print("Otel verileri toplanıyor...")

    for code, info in AIRPORTS.items():
        print(f"{code} ({info['name']}) taranıyor...")
        raw_hotels = fetch_osm_hotels(info["lat"], info["lng"])
        
        if not raw_hotels:
            prefixes = ["Grand", "Royal", "Airport Express", "Suite Hotel", "Comfort Inn", "Plaza"]
            for i in range(6):
                raw_hotels.append({
                    "name": f"{random.choice(prefixes)} {code} Hotel {i+1}",
                    "lat": info["lat"] + random.uniform(-0.03, 0.03),
                    "lng": info["lng"] + random.uniform(-0.03, 0.03),
                    "address": f"Havalimana Yolu No:{i*10 + 5}"
                })

        processed = []
        for idx, h in enumerate(raw_hotels):
            processed.append({
                "id": idx + 1,
                "airport_code": code,
                "name": h["name"],
                "stars": random.choice([3, 4, 5]),
                "user_rating": round(random.uniform(7.0, 9.6), 1),
                "base_price": random.randint(2200, 6000),
                "distance_km": round(random.uniform(2.0, 18.0), 1),
                "traffic_duration": random.randint(10, 40),
                "lat": h["lat"],
                "lng": h["lng"],
                "address": h["address"],
                "website_url": f"https://www.google.com/search?q={h['name'].replace(' ', '+')}",
                "booking_url": f"https://www.booking.com/searchresults.html?ss={h['name'].replace(' ', '+')}",
                "image_url": random.choice(HOTEL_IMAGES),
                "amenities": "wifi,breakfast,shuttle,gym",
                "latest_security_score": 0.0,
                "is_security_approved": False,
                "is_favorite": False
            })
        
        database[code] = {
            "airport": info,
            "hotels": processed
        }

    os.makedirs("data", exist_ok=True)
    with open("data/hotels_database.json", "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False, indent=2)

    print("data/hotels_database.json guncellendi!")

if __name__ == "__main__":
    main()