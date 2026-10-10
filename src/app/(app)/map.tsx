import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, ActivityIndicator, Pressable, Modal, Alert } from "react-native";
import MapView, { Marker, UrlTile } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { calculateDistance, calculateBearing } from "../../lib/locationUtils";
import { verifyObjectImage } from "../../services/imageVerification";
import { colors, fonts } from "@/constants/theme";

const PROXIMITY_THRESHOLD = 500; // meters

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    teaser?: string;
    clue?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  
  const { signOut } = useAuth();

  const [targetLocation, setTargetLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [isCloseEnough, setIsCloseEnough] = useState(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const souvenirId = params.id ?? "demo-1";
  const souvenirTeaser = params.teaser ?? "Target Souvenir";
  const souvenirClue = params.clue ?? "Under the old oak tree, where the roots break the stone.";

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
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (newLocation) => {
            if (!isMounted) return;
            setLocation(newLocation);
            
            setTargetLocation((prevTarget) => {
              let currentTarget = prevTarget;
              if (!currentTarget) {
                if (params.latitude && params.longitude) {
                  currentTarget = {
                    latitude: parseFloat(params.latitude),
                    longitude: parseFloat(params.longitude),
                  };
                } else {
                  // Fallback offset for testing demo souvenir
                  currentTarget = {
                    latitude: newLocation.coords.latitude + 0.005,
                    longitude: newLocation.coords.longitude + 0.005,
                  };
                }
              }
              
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
      } catch {
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
  }, [loading, params.latitude, params.longitude]);

  const handleVerifyObject = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera access required", "Camera permission is needed to verify the physical object.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setVerifying(true);
      const verificationResult = await verifyObjectImage(
        result.assets[0].uri,
        "reference-image-url"
      );

      if (verificationResult.verified) {
        setIsCloseEnough(false);
        Alert.alert(
          "Object Verified! 🎉",
          `Verification match score: ${verificationResult.confidenceScore}%. You have unlocked the souvenir!`,
          [
            {
              text: "VIEW SOUVENIR",
              onPress: () => router.push({
                pathname: "/(app)/claim/[id]",
                params: { id: souvenirId },
              }),
            },
          ]
        );
      } else {
        Alert.alert(
          "Verification Incomplete",
          verificationResult.reason ?? "The object photo did not match. Please try taking another photo closer to the target object."
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "An error occurred during verification.");
    } finally {
      setVerifying(false);
    }
  };

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
            title={souvenirTeaser}
            description="Find this location!"
          />
        )}
      </MapView>

      {/* Header Back Button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 10 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back to landing page"
      >
        <Text style={styles.backButtonText}>← BACK</Text>
      </Pressable>

      {/* Sign Out Button */}
      <Pressable
        style={[styles.signOutButton, { top: insets.top + 10 }]}
        onPress={() => void signOut()}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

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
            <Text style={styles.modalTitle}>You&apos;ve arrived!</Text>
            <Text style={styles.modalBody}>
              Look around for the physical object matching the creator&apos;s reference.
            </Text>
            <View style={styles.clueBox}>
              <Text style={styles.clueText}>Clue: &quot;{souvenirClue}&quot;</Text>
            </View>
            <Pressable
              style={styles.actionButton}
              onPress={() => void handleVerifyObject()}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Verify Object (Take Photo)</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
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
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: colors?.white || "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors?.ink || "#000000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButtonText: {
    fontFamily: fonts?.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors?.ink || "#000000",
  },
  signOutButton: {
    position: "absolute",
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
  navigationOverlay: {
    position: "absolute",
    top: 75,
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
