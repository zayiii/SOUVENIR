// Map Screen for Souvenir Leave Phase 2
import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, ActivityIndicator, Pressable, Modal } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "@clerk/expo";
import { calculateDistance, calculateBearing } from "../../lib/locationUtils";
import { colors, fonts } from "@/constants/theme";

const PROXIMITY_THRESHOLD = 500; // meters

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { signOut } = useAuth();

  // Phase 2 state
  const [targetLocation, setTargetLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [isCloseEnough, setIsCloseEnough] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (isMounted) {
          setErrorMsg("Location permission is required to show your position.");
          setLoading(false);
        }
        return;
      }
      
      try {
        // Start continuous tracking
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (newLocation) => {
            if (!isMounted) return;
            setLocation(newLocation);
            
            // Initialize target location based on first ping if not set (offset by ~700m for testing)
            setTargetLocation((prevTarget) => {
              const currentTarget = prevTarget || {
                latitude: newLocation.coords.latitude + 0.005,
                longitude: newLocation.coords.longitude + 0.005,
              };
              
              // Calculate distance and bearing
              const dist = calculateDistance(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                currentTarget.latitude,
                currentTarget.longitude
              );
              
              const bear = calculateBearing(
                newLocation.coords.latitude,
                newLocation.coords.longitude,
                currentTarget.latitude,
                currentTarget.longitude
              );
              
              setDistance(dist);
              setBearing(bear);
              
              if (dist <= PROXIMITY_THRESHOLD) {
                setIsCloseEnough(true);
                // Stop tracking once target is reached
                if (locationSubscription.current) {
                  locationSubscription.current.remove();
                  locationSubscription.current = null;
                }
              }
              
              return currentTarget;
            });
            
            if (loading) setLoading(false);
          }
        );
        locationSubscription.current = sub;
      } catch (e) {
        if (isMounted) {
          setErrorMsg("Failed to obtain location.");
          setLoading(false);
        }
      }
    })();
    
    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: location!.coords.latitude,
          longitude: location!.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        <UrlTile
          urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {targetLocation && (
          <Marker
            coordinate={targetLocation}
            title="Target Souvenir"
            description="Find this location!"
          />
        )}
      </MapView>

      {/* Navigation Overlay */}
      {!isCloseEnough && distance !== null && bearing !== null && (
        <View style={styles.navigationOverlay}>
          <Text style={styles.distanceText}>
            {distance > 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`}
          </Text>
          <View style={[styles.arrowContainer, { transform: [{ rotate: `${bearing}deg` }] }]}>
            <Text style={styles.arrow}>↑</Text>
          </View>
          <Text style={styles.navSubtext}>Walk towards the target</Text>
        </View>
      )}

      {/* Clue Reveal Modal */}
      <Modal
        visible={isCloseEnough}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>You've arrived!</Text>
            <Text style={styles.modalBody}>
              Look around for the physical object matching the creator's reference.
            </Text>
            <View style={styles.clueBox}>
              <Text style={styles.clueText}>Clue: "Under the old oak tree, where the roots break the stone."</Text>
            </View>
            {/* Phase 3 placeholder */}
            <Pressable style={styles.actionButton} onPress={() => console.log('Camera would open here')}>
              <Text style={styles.actionButtonText}>Verify Object (Phase 3)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
      
      {/* Temporary Sign Out Button */}
      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: fonts?.body,
    color: "#333",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: "#b00020",
    fontSize: 16,
    fontFamily: fonts?.body,
    textAlign: "center",
  },
  attribution: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionText: {
    fontSize: 10,
    color: "#555",
  },
  signOutButton: {
    position: "absolute",
    top: 40,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    color: "#b00020",
    fontWeight: "bold",
    fontSize: 12,
  },
  navigationOverlay: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    minWidth: 180,
  },
  distanceText: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors?.ink || "#333",
    fontFamily: fonts?.body,
  },
  arrowContainer: {
    marginVertical: 12,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors?.box || "#E6F4FE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#208AEF",
  },
  arrow: {
    fontSize: 32,
    color: "#208AEF",
    fontWeight: "bold",
  },
  navSubtext: {
    fontSize: 14,
    color: "#666",
    fontFamily: fonts?.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    color: colors?.ink || "#111",
    fontFamily: fonts?.body,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#444",
    marginBottom: 20,
    fontFamily: fonts?.body,
  },
  clueBox: {
    backgroundColor: colors?.box || "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#208AEF",
  },
  clueText: {
    fontSize: 16,
    fontStyle: "italic",
    color: colors?.ink || "#333",
    fontFamily: fonts?.body,
  },
  actionButton: {
    backgroundColor: "#208AEF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
    fontFamily: fonts?.body,
  },
});
