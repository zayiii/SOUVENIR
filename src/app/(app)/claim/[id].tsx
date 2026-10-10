import { ScreenFrame } from "@/components/ScreenFrame";
import { colors, fonts } from "@/constants/theme";
import { useSupabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type GiftData =
  | { kind: "text"; textType: "poem" | "essay"; body: string }
  | { kind: "link"; url: string }
  | { kind: "image" | "file"; name: string; url: string };

type SouvenirRecord = {
  id: string;
  creator_username: string;
  teaser: string;
  clue: string;
  gift: GiftData;
  claims_count: number;
  claim_limit: number;
  created_at: string;
};

export default function ClaimSouvenirScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = useSupabase();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [souvenir, setSouvenir] = useState<SouvenirRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSouvenir() {
      try {
        if (!id) {
          // Demo fallback souvenir when opened directly
          setSouvenir({
            id: "demo-1",
            creator_username: "Explorer",
            teaser: "A quiet moment under the canopy.",
            clue: "Under the old oak tree, where the roots break the stone.",
            gift: {
              kind: "text",
              textType: "poem",
              body: "Whispering leaves in autumn breeze,\nFootsteps soft beneath old trees.\nLeave a mark before you go,\nA souvenir in golden glow.",
            },
            claims_count: 1,
            claim_limit: 5,
            created_at: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from("souvenirs")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchErr) throw fetchErr;
        setSouvenir(data as SouvenirRecord);
      } catch (err: any) {
        setError(err?.message ?? "Could not load souvenir.");
      } finally {
        setLoading(false);
      }
    }

    fetchSouvenir();
  }, [id, supabase]);

  if (loading) {
    return (
      <ScreenFrame>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.ink} />
          <Text style={styles.loadingText}>Unlocking souvenir...</Text>
        </View>
      </ScreenFrame>
    );
  }

  if (error || !souvenir) {
    return (
      <ScreenFrame>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "Souvenir not found."}</Text>
          <Pressable onPress={() => router.back()} style={styles.button}>
            <Text style={styles.buttonText}>GO BACK</Text>
          </Pressable>
        </View>
      </ScreenFrame>
    );
  }

  const { gift } = souvenir;

  return (
    <ScreenFrame>
      <Pressable
        onPress={() => router.back()}
        style={[styles.logoWrap, { top: insets.top + 6 }]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
      >
        <Image
          source={require("../../../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 64 },
        ]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SOUVENIR UNLOCKED</Text>
        </View>

        <Text style={styles.title}>{souvenir.teaser.toUpperCase()}</Text>
        <Text style={styles.subtitle}>Left by @{souvenir.creator_username}</Text>

        <View style={styles.giftContainer}>
          {gift.kind === "text" && (
            <View style={styles.textGift}>
              <Text style={styles.giftLabel}>{gift.textType.toUpperCase()}</Text>
              <Text style={styles.giftBody}>{gift.body}</Text>
            </View>
          )}

          {gift.kind === "link" && (
            <View style={styles.linkGift}>
              <Text style={styles.giftLabel}>ATTACHED LINK</Text>
              <Pressable
                onPress={() => void Linking.openURL(gift.url)}
                style={styles.linkButton}
              >
                <Text style={styles.linkText} numberOfLines={1}>
                  {gift.url}
                </Text>
              </Pressable>
            </View>
          )}

          {(gift.kind === "image" || gift.kind === "file") && (
            <View style={styles.fileGift}>
              <Text style={styles.giftLabel}>ATTACHED {gift.kind.toUpperCase()}</Text>
              {gift.kind === "image" ? (
                <Image
                  source={{ uri: gift.url }}
                  style={styles.giftImage}
                  resizeMode="cover"
                />
              ) : (
                <Pressable
                  onPress={() => void Linking.openURL(gift.url)}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>DOWNLOAD {gift.name.toUpperCase()}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <Text style={styles.footerNote}>
          Claimed by {souvenir.claims_count} / {souvenir.claim_limit} discoverers
        </Text>

        <Pressable
          onPress={() => {
            Alert.alert("Claimed!", "This souvenir has been added to your collection.", [
              { text: "DONE", onPress: () => router.replace("/(app)") },
            ]);
          }}
          style={styles.claimButton}
        >
          <Text style={styles.claimButtonText}>ADD TO COLLECTION →</Text>
        </Pressable>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    position: "absolute",
    left: 14,
    zIndex: 2,
  },
  logo: {
    width: 62,
    height: 46,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    marginBottom: 16,
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.white,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.quote,
    marginBottom: 24,
  },
  giftContainer: {
    backgroundColor: colors.box,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  giftLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.quote,
    marginBottom: 12,
  },
  textGift: {},
  giftBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  linkGift: {},
  linkButton: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderColor: colors.ink,
  },
  linkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: 1,
  },
  fileGift: {},
  giftImage: {
    width: "100%",
    height: 220,
    marginTop: 8,
  },
  footerNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.quote,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  buttonText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.ink,
  },
  claimButton: {
    alignSelf: "center",
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  claimButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
  },
});
