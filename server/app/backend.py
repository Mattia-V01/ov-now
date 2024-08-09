from fastapi import FastAPI, Query, HTTPException
import requests
from functools import lru_cache
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the API key
key = "yourkey"  #Ihren key ersetzen

# Function to fetch GeoJSON data from the provided API link
@lru_cache(maxsize=128)
def fetch_geojson_from_external_api(api_url):
    try:
        print(f"Fetching GeoJSON data from URL: {api_url}")  # Log the URL
        response = requests.get(api_url)
        response.raise_for_status()  # Raise an HTTPError for bad responses
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch GeoJSON data: {e}")  # Log the error
        # Return an empty GeoJSON structure on error
        return {"type": "FeatureCollection", "features": []}

# Function to fetch Journeys data for a given train ID
@lru_cache(maxsize=128)
def fetch_journeys_for_train_id(train_id, key):
    api_url = f"https://api.geops.io/tracker-http/v1/journeys/{train_id}/?key={key}"
    return fetch_geojson_from_external_api(api_url)

# Endpoint to get trajectories and journeys based on bounding box
@app.get("/get_all_journey/")
async def get_all_journey(
    bbox: str = Query(..., description="Bounding box coordinates in format easting,northing,easting,northing"),
    key: str = Query(..., description="API key"),
    zoom: int = Query(12, description="Zoom level")
):
    # Construct API URL with dynamic bounding box and provided API key
    api_url = f"https://api.geops.io/tracker-http/v1/trajectories/sbb/?bbox={bbox}&key={key}&zoom={zoom}"
    print(f"Constructed API URL: {api_url}")  # Log the constructed URL

    # Fetch GeoJSON data from external API
    trajectories_geojson = fetch_geojson_from_external_api(api_url)

    # Ensure we have a valid FeatureCollection
    if trajectories_geojson.get("type") != "FeatureCollection" or not isinstance(trajectories_geojson.get("features"), list):
        raise HTTPException(status_code=500, detail="Invalid GeoJSON data received from external API")

    # Get journeys for each train ID in trajectories_geojson
    for feature in trajectories_geojson["features"]:
        properties = feature.get("properties", {})
        train_id = properties.get("train_id")
        train_type = properties.get("type")
    
    # Skip fetch if the type is "gondola"
        if train_id and train_type != "gondola":
            journeys_geojson = fetch_journeys_for_train_id(train_id, key)
            properties["journeys"] = journeys_geojson.get("features", [])


    # Return fetched GeoJSON data
    return trajectories_geojson

# Endpoint to get calls based on train ID
@app.get("/get_info/")
async def get_info(train_id: str = Query(..., description="Train ID"), key: str = Query(..., description="API key")):
    # Construct API URL with provided train ID and API key
    api_url = f"https://api.geops.io/tracker-http/v1/calls/{train_id}/?key={key}"
    print(f"Constructed API URL for get_info: {api_url}")  # Log the constructed URL

    # Fetch GeoJSON data from external API
    calls_geojson = fetch_geojson_from_external_api(api_url)

    # Return fetched GeoJSON data
    return calls_geojson

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
