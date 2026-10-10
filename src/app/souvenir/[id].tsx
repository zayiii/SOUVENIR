
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import MapView, {
    Marker,
    Polyline,
    UrlTile,
} from "react-native-maps";

import * as Location from "expo-location";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const PRIZE_LOCATION: Coordinates = {
  latitude: 11.2589,
  longitude: 75.7803,
};

const TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

// Haversine distance, returned in meters.
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));

  return R * 2 * Math.atan2(
    Math.sqrt(safeA),
    Math.sqrt(1 - safeA)
  );
}

export default function SouvenirScreen() {
  const [userLocation, setUserLocation] =
    useState<Coordinates | null>(null);

  const [showClue, setShowClue] = useState(false);
  const [route, setRoute] = useState<Coordinates[]>([]);
  const [locationError, setLocationError] = useState<string | null>(
    null
  );

  const clueShown = useRef(false);
  const routeRequestInProgress = useRef(false);
  const lastRouteOrigin = useRef<Coordinates | null>(null);

  const distance = userLocation
    ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        PRIZE_LOCATION.latitude,
        PRIZE_LOCATION.longitude
      )
    : null;

  // Start location tracking.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function startLocationTracking() {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (!cancelled) {
            setLocationError(
              "Location permission is required to find the souvenir."
            );
          }
          return;
        }

        const initialLocation =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

        if (cancelled) return;

        setUserLocation({
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
        });

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
          },
          (location) => {
            if (cancelled) return;

            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );

        if (cancelled) {
          subscription.remove();
          subscription = null;
        }
      } catch (error) {
        console.error("Location error:", error);

        if (!cancelled) {
          setLocationError(
            "Unable to get your location. Please check your GPS and try again."
          );
        }
      }
    }

    startLocationTracking();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  // Show clue when within 500m
  useEffect(() => {
    if (distance !== null && distance <= 500 && !clueShown.current) {
      clueShown.current = true;
      setShowClue(true);
    }
  }, [distance]);

  // Get or refresh the driving route.
  useEffect(() => {
    if (!userLocation || distance === null || distance <= 500) return;

    // Avoid frequent requests while the user moves.
    const previousOrigin = lastRouteOrigin.current;

    if (
      previousOrigin &&
      calculateDistance(
        previousOrigin.latitude,
        previousOrigin.longitude,
        userLocation.latitude,
        userLocation.longitude
      ) < 50
    ) {
      return;
    }

    // Prevent overlapping requests.
    if (routeRequestInProgress.current) return;

    let cancelled = false;
    const origin = userLocation;

    async function fetchRoute() {
      routeRequestInProgress.current = true;

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${origin.longitude},${origin.latitude};` +
          `${PRIZE_LOCATION.longitude},${PRIZE_LOCATION.latitude}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Routing failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
          return;
        }

        const coordinates: Coordinates[] =
          data.routes[0].geometry.coordinates.map(
            (point: [number, number]) => ({
              latitude: point[1],
              longitude: point[0],
            })
          );

        if (!cancelled) {
          lastRouteOrigin.current = origin;
          setRoute(coordinates);
        }
      } catch (error) {
        console.error("Route error:", error);
      } finally {
        routeRequestInProgress.current = false;
      }
    }

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [userLocation, distance]);

  // Loading and permission error screen.
  if (!userLocation) {
    return (
      <View style={styles.loading}>
        {locationError ? (
          <>
            <Text style={styles.errorText}>{locationError}</Text>

            <Pressable
              style={styles.button}
              onPress={() => {
                setLocationError(null);
                setUserLocation(null);
                // Reload the screen to restart location tracking.
                // A navigation reset or retry state is preferable
                // for production apps.
              }}
            >
              <Text style={styles.buttonText}>Check settings</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>
              Finding your location...
            </Text>
          </>
        )}
      </View>
    );
  }

  const within500m = distance !== null && distance <= 500;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        mapType="none"
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <UrlTile
          urlTemplate={TILE_URL}
          maximumZ={19}
          flipY={false}
        />

        {!within500m && (
          <Marker
            coordinate={PRIZE_LOCATION}
            title="Souvenir"
            description="Follow the route to find it"
          />
        )}

        {!within500m && route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeWidth={5}
            strokeColor="#2878FF"
          />
        )}
      </MapView>

      <View style={styles.distanceCard}>
        <Text style={styles.distanceText}>
          {distance === null
            ? "Calculating distance..."
            : within500m
              ? "You're within 500 m!"
              : `${Math.round(distance)} m away`}
        </Text>
      </View>

      <Modal
        visible={showClue}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClue(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.clueCard}>
            <Text style={styles.title}>You&apos;re close!</Text>

            <Text style={styles.subtitle}>
              Find this object to discover the souvenir.
            </Text>

            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1494526585095-c41746248156",
              }}
              style={styles.clueImage}
              resizeMode="cover"
            />

            <Pressable
              style={styles.button}
              onPress={() => setShowClue(false)}
            >
              <Text style={styles.buttonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },

  distanceCard: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    elevation: 5,
  },

  distanceText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  clueCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },

  title: {
    fontSize: 25,
    fontWeight: "bold",
  },

  subtitle: {
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },

  clueImage: {
    width: 260,
    height: 260,
    maxWidth: "100%",
    borderRadius: 15,
  },

  button: {
    marginTop: 20,
    backgroundColor: "black",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 10,
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
