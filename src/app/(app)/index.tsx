import { ScreenFrame } from "@/components/ScreenFrame";
import { colors, fonts } from "@/constants/theme";
import { useSupabase } from "@/lib/supabase";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SouvenirItem = {
  id: string;
  creator_username: string;
  teaser: string;
  clue: string;
  latitude: number;
  longitude: number;
  claims_count: number;
  claim_limit: number;
  created_at: string;
};

const DEMO_SOUVENIR: SouvenirItem = {
  id: "demo-1",
  creator_username: "Explorer",
  teaser: "A quiet moment under the canopy.",
  clue: "Under the old oak tree, where the roots break the stone.",
  latitude: 11.2589,
  longitude: 75.7803,
  claims_count: 1,
  claim_limit: 5,
  created_at: new Date().toISOString(),
};

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = useSupabase();
  const { signOut } = useAuth();
  const { user } = useUser();

  const [souvenirs, setSouvenirs] = useState<SouvenirItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSouvenirs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("souvenirs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSouvenirs(data ?? []);
    } catch {
      setSouvenirs([DEMO_SOUVENIR]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  // Data loading on mount — setState in async callback is the standard React pattern.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadSouvenirs();
  }, [loadSouvenirs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onRefresh = () => {
    setRefreshing(true);
    void loadSouvenirs();
  };

  return (
    <ScreenFrame>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Image
          source={require("../../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Pressable
          onPress={() => void signOut()}
          style={styles.signOutBtn}
          hitSlop={8}
        >
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </Pressable>
      </View>

      <View style={styles.container}>
        <View style={styles.heroSection}>
          <Text style={styles.greeting}>WELCOME, @{user?.username ?? "EXPLORER"}</Text>
          <Text style={styles.subhead}>
            Choose a souvenir below to navigate to its real-world location &amp; collect it, or leave your own!
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push("/(app)/souvenir/add")}
            style={styles.actionBtnPrimary}
          >
            <Text style={styles.actionBtnPrimaryText}>+ LEAVE SOUVENIR</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>AVAILABLE SOUVENIRS</Text>

        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="small" color={colors.ink} />
          </View>
        ) : (
          <FlatList
            data={souvenirs}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(app)/map",
                    params: {
                      id: item.id,
                      teaser: item.teaser,
                      clue: item.clue,
                      latitude: item.latitude,
                      longitude: item.longitude,
                    },
                  })
                }
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.creator}>LEFT BY @{item.creator_username.toUpperCase()}</Text>
                  <Text style={styles.claims}>
                    {item.claims_count}/{item.claim_limit} CLAIMED
                  </Text>
                </View>
                <Text style={styles.teaser}>{item.teaser}</Text>
                <Text style={styles.cluePreview} numberOfLines={2}>
                  Clue: &quot;{item.clue}&quot;
                </Text>
                <Text style={styles.collectLink}>COLLECT SOUVENIR →</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  logo: {
    width: 62,
    height: 46,
  },
  signOutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  signOutText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.ink,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  heroSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  greeting: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
    marginBottom: 6,
  },
  subhead: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.quote,
  },
  actionsRow: {
    marginBottom: 24,
  },
  actionBtnPrimary: {
    backgroundColor: colors.box,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionBtnPrimaryText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
    marginBottom: 12,
  },
  centerLoader: {
    paddingVertical: 40,
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  creator: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.quote,
  },
  claims: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.quote,
  },
  teaser: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.ink,
    marginBottom: 6,
  },
  cluePreview: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontStyle: "italic",
    color: colors.quote,
    marginBottom: 14,
  },
  collectLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.ink,
    alignSelf: "flex-end",
  },
});
