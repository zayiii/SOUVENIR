import { ScreenFrame } from "@/components/ScreenFrame";
import { colors, fonts } from "@/constants/theme";
import { useSupabase } from "@/lib/supabase";
import { submitSouvenir, type Gift } from "@/services/souvenirs";

import { useAuth, useUser } from "@clerk/expo";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type GiftMode = "text" | "image" | "file" | "link";
type TextType = "poem" | "essay";

type PickedGift = {
  kind: "image" | "file";
  uri: string;
  name: string;
  mimeType?: string | null;
};

const MAX_WORDS = 200;
const MAX_TEASER = 140;
const MAX_BODY = 5000;
const MIN_CLAIMS = 1;
const MAX_CLAIMS = 99;
const UPLOAD_GRAY = "#D9D9D9";

const GIFT_MODES: GiftMode[] = ["text", "image", "file", "link"];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isValidUrl(value: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(value.trim());
}

export default function AddSouvenirScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = useSupabase();
  const { userId } = useAuth();
  const { user } = useUser();

  const [objectImageUri, setObjectImageUri] = useState<string | null>(null);
  const [teaser, setTeaser] = useState("");
  const [clue, setClue] = useState("");
  const [giftMode, setGiftMode] = useState<GiftMode>("text");
  const [textType, setTextType] = useState<TextType>("poem");
  const [body, setBody] = useState("");
  const [pickedGift, setPickedGift] = useState<PickedGift | null>(null);
  const [link, setLink] = useState("");
  const [claimLimit, setClaimLimit] = useState(5);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = countWords(clue);
  const overLimit = wordCount > MAX_WORDS;

  // OBJECT PHOTO
  const takeObjectPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in Settings to photograph the object."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled) setObjectImageUri(result.assets[0].uri);
  };

  const chooseObjectPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled) setObjectImageUri(result.assets[0].uri);
  };

  const pickObjectImage = () => {
    Alert.alert("Photo of the object", "Use a clear, well-lit photo.", [
      { text: "Take photo", onPress: () => void takeObjectPhoto() },
      { text: "Choose from library", onPress: () => void chooseObjectPhoto() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // GIFT
  const pickGiftImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setPickedGift({
      kind: "image",
      uri: asset.uri,
      name: asset.fileName ?? "image.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  };

  const pickGiftFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setPickedGift({
      kind: "file",
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
    });
  };

  const switchGiftMode = (next: GiftMode) => {
    setGiftMode(next);
    setPickedGift(null);
    setLink("");
    setBody("");
    setError(null);
  };

  // SUBMIT
  const handleSubmit = async () => {
    if (busy) return;
    setError(null);

    if (!userId) {
      setError("You need to be signed in.");
      return;
    }

    if (!objectImageUri) {
      setError("Add a clear photo of the object.");
      return;
    }

    if (!teaser.trim()) {
      setError("Write a short teaser about your souvenir.");
      return;
    }

    if (wordCount === 0) {
      setError("Write a clue so others can find the object.");
      return;
    }

    if (overLimit) {
      setError(`Your clue is over ${MAX_WORDS} words.`);
      return;
    }

    let gift: Gift;

    if (giftMode === "text") {
      if (!body.trim()) {
        setError("Write your poem or essay.");
        return;
      }
      gift = { kind: "text", textType, body: body.trim() };
    } else if (giftMode === "link") {
      if (!isValidUrl(link)) {
        setError("Enter a valid link starting with http:// or https://");
        return;
      }
      gift = { kind: "link", url: link.trim() };
    } else {
      if (!pickedGift) {
        setError("Attach your souvenir.");
        return;
      }
      gift = pickedGift;
    }

    setBusy(true);

    try {
      await submitSouvenir(supabase, userId, user?.username, {
        objectImageUri,
        teaser: teaser.trim(),
        clue: clue.trim(),
        gift,
        claimLimit,
      });

      Alert.alert("Left for others", "Your souvenir is waiting to be found.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Could not save your souvenir.");
    } finally {
      setBusy(false);
    }
  };

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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 64 },
          ]}
        >
          {/* OBJECT PHOTO */}
          <Pressable
            onPress={pickObjectImage}
            style={styles.uploadBox}
            accessibilityRole="button"
            accessibilityLabel="Upload a clear image of the object"
          >
            {objectImageUri ? (
              <Image
                source={{ uri: objectImageUri }}
                style={styles.uploadImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.uploadText}>
                {"UPLOAD CLEAR\nIMAGE OF THE\nOBJECT"}
              </Text>
            )}
          </Pressable>

          {/* TEASER */}
          <Text style={styles.label}>
            {`SHORT TEASER (MAX ${MAX_TEASER} CHARACTERS):`}
          </Text>

          <TextInput
            style={styles.lineInput}
            value={teaser}
            onChangeText={setTeaser}
            maxLength={MAX_TEASER}
            editable={!busy}
            accessibilityLabel="Teaser"
          />

          <Text style={styles.counter}>{`${teaser.length}/${MAX_TEASER}`}</Text>

          {/* CLUE */}
          <Text style={styles.label}>
            {`WRITE A CLEAR CLUE (MAX ${MAX_WORDS} WORDS):`}
          </Text>

          <TextInput
            style={styles.clueInput}
            value={clue}
            onChangeText={setClue}
            multiline
            textAlignVertical="top"
            editable={!busy}
            accessibilityLabel="Clue"
          />

          <Text style={[styles.counter, overLimit && styles.counterOver]}>
            {`${wordCount}/${MAX_WORDS} WORDS`}
          </Text>

          {/* GIFT */}
          <Text style={styles.label}>ATTACH YOUR SOUVENIR:</Text>

          <View style={styles.modes}>
            {GIFT_MODES.map((m) => (
              <Pressable
                key={m}
                onPress={() => switchGiftMode(m)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected: giftMode === m }}
              >
                <Text
                  style={[styles.mode, giftMode === m && styles.modeActive]}
                >
                  {m.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {giftMode === "text" && (
            <View style={styles.giftBlock}>
              <View style={styles.modes}>
                {(["poem", "essay"] as TextType[]).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTextType(t)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: textType === t }}
                  >
                    <Text
                      style={[styles.mode, textType === t && styles.modeActive]}
                    >
                      {t.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.bodyInput}
                value={body}
                onChangeText={setBody}
                maxLength={MAX_BODY}
                multiline
                textAlignVertical="top"
                editable={!busy}
                accessibilityLabel="Your poem or essay"
              />
            </View>
          )}

          {giftMode === "link" && (
            <View style={styles.giftBlock}>
              <TextInput
                style={styles.lineInput}
                value={link}
                onChangeText={setLink}
                placeholder="HTTPS://"
                placeholderTextColor={colors.quote}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!busy}
                accessibilityLabel="Link"
              />
            </View>
          )}

          {(giftMode === "image" || giftMode === "file") && (
            <Pressable
              onPress={() =>
                void (giftMode === "image" ? pickGiftImage() : pickGiftFile())
              }
              style={styles.pickButton}
              accessibilityRole="button"
            >
              <Text style={styles.pickText} numberOfLines={2}>
                {pickedGift
                  ? pickedGift.name.toUpperCase()
                  : giftMode === "image"
                  ? "CHOOSE AN IMAGE"
                  : "CHOOSE A FILE"}
              </Text>
            </Pressable>
          )}

          {/* CLAIM LIMIT */}
          <Text style={styles.label}>HOW MANY PEOPLE CAN CLAIM IT:</Text>

          <View style={styles.stepper}>
            <Pressable
              onPress={() => setClaimLimit((n) => Math.max(MIN_CLAIMS, n - 1))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Decrease claim limit"
            >
              <Text style={styles.stepperBtn}>−</Text>
            </Pressable>

            <Text style={styles.stepperValue}>{claimLimit}</Text>

            <Pressable
              onPress={() => setClaimLimit((n) => Math.min(MAX_CLAIMS, n + 1))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Increase claim limit"
            >
              <Text style={styles.stepperBtn}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            YOUR CURRENT LOCATION IS SAVED AS THE OBJECT&apos;S LOCATION. STAND
            NEXT TO IT BEFORE YOU SUBMIT.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={busy}
            style={styles.submit}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Text style={styles.submitText}>LEAVE IT →</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  logoWrap: {
    position: "absolute",
    left: 14,
    zIndex: 2,
  },

  logo: {
    width: 62,
    height: 46,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 160,
  },

  uploadBox: {
    alignSelf: "center",
    width: "62%",
    aspectRatio: 1.2,
    backgroundColor: UPLOAD_GRAY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 48,
  },

  uploadImage: {
    width: "100%",
    height: "100%",
  },

  uploadText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 3,
    lineHeight: 26,
    color: colors.ink,
    textAlign: "center",
  },

  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
    marginTop: 8,
  },

  lineInput: {
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderColor: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.ink,
  },

  clueInput: {
    minHeight: 110,
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderColor: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 1,
    lineHeight: 20,
    color: colors.ink,
  },

  bodyInput: {
    minHeight: 160,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderColor: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    letterSpacing: 1,
    lineHeight: 20,
    color: colors.ink,
  },

  counter: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.quote,
    textAlign: "right",
    marginTop: 6,
    marginBottom: 36,
  },

  counterOver: {
    color: colors.error,
  },

  modes: {
    flexDirection: "row",
    marginTop: 16,
    marginBottom: 18,
    gap: 22,
  },

  mode: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.quote,
  },

  modeActive: {
    color: colors.ink,
    textDecorationLine: "underline",
  },

  giftBlock: {
    marginBottom: 36,
  },

  pickButton: {
    alignSelf: "center",
    minWidth: 220,
    maxWidth: "100%",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    marginBottom: 36,
  },

  pickText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
    textAlign: "center",
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 14,
    marginBottom: 32,
    gap: 24,
  },

  stepperBtn: {
    fontFamily: fonts.body,
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: 6,
  },

  stepperValue: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.ink,
    minWidth: 28,
    textAlign: "center",
  },

  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    color: colors.quote,
    marginBottom: 20,
  },

  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },

  submit: {
    alignSelf: "flex-end",
    paddingVertical: 8,
  },

  submitText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
  },
});
