import { ScreenFrame } from "@/components/ScreenFrame";
import { colors, fonts } from "@/constants/theme";

import { useAuth, useSSO, useSignIn, useSignUp } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

type Mode = "login" | "signup";
type Step = "form" | "verify";
type VerificationPurpose = "signup" | "login";

function getErrorMessage(error: any, fallback: string): string {
  return (
    error?.errors?.[0]?.longMessage ??
    error?.errors?.[0]?.message ??
    error?.longMessage ??
    error?.message ??
    fallback
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { isLoaded, isSignedIn } = useAuth();

  const {
    signIn,
    errors: signInErrors,
    fetchStatus: signInFetch,
  } = useSignIn();

  const {
    signUp,
    errors: signUpErrors,
    fetchStatus: signUpFetch,
  } = useSignUp();

  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [verificationPurpose, setVerificationPurpose] =
    useState<VerificationPurpose>("signup");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const busy =
    signInFetch === "fetching" || signUpFetch === "fetching" || googleBusy;

  const errors = mode === "login" ? signInErrors : signUpErrors;

  // errors is a union of SignInFields | SignUpFields, so widen it before
  // reading keys that only exist on one of the two.
  const fieldErrors = (errors?.fields ?? {}) as unknown as Record<
    string,
    { message?: string } | null | undefined
  >;

  const apiError: string | null =
    fieldErrors.code?.message ??
    fieldErrors.emailAddress?.message ??
    fieldErrors.identifier?.message ??
    fieldErrors.username?.message ??
    fieldErrors.password?.message ??
    errors?.global?.[0]?.message ??
    null;

  const message = localError ?? apiError;

  // FIX 1: if a session already exists, skip this screen entirely
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/(app)");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    void WebBrowser.warmUpAsync();

    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const navigate = async ({ session }: { session: any }) => {
    if (session?.currentTask) {
      console.log('Clerk session task pending:', session.currentTask)
      return
    }
    router.replace('/(app)')
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setLocalError(null)
  }

  const submit = async () => {
    setLocalError(null)
    const u = username.trim().toLowerCase()

    if (mode === 'signup' && (u.length < 3 || password.length < 8)) {
      setLocalError('Username: 3+ characters. Password: 8+ characters.')
      return
    }
    if (!u || !password) {
      setLocalError('Enter your username and password.')
      return
    }

    if (mode === 'login') {
      await signIn.password({ username: u, password })
      if (signIn.status === 'complete') {
        await signIn.finalize({ navigate })
      } else if (signIn.status === 'needs_client_trust') {
        setLocalError('Clerk "Device Trust" is on. Turn it off in the Clerk dashboard.')
      }
    } else {
      await signUp.password({ username: u, password })
      if (signUp.status === 'complete') {
        await signUp.finalize({ navigate })
      } else if (signUp.status === 'missing_requirements') {
        setLocalError('Clerk needs more info. Turn email off in User & authentication.')
      }
    }
  }

  return (
    <ScreenFrame>
      <Image
        source={require("../../../assets/images/logo.png")}
        style={[styles.logo, { top: insets.top + 6 }]}
        resizeMode="contain"
      />

      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.box}>
          <View style={styles.tabs}>
            <Tab
              label="LOGIN"
              active={mode === "login"}
              onPress={() => switchMode("login")}
            />

            <Tab
              label="SIGN UP"
              active={mode === "signup"}
              onPress={() => switchMode("signup")}
            />
          </View>

          <View style={styles.panel}>
            {step === "verify" ? (
              <>
                <Text style={styles.hint}>
                  {verificationPurpose === "signup"
                    ? "Check your email for a 6-digit verification code."
                    : "Verify this sign-in using the code sent to your email."}
                </Text>

                <View style={styles.row}>
                  <Text style={styles.label}>CODE:</Text>

                  <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={(value) =>
                      setCode(value.replace(/\D/g, "").slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                    editable={!busy}
                    accessibilityLabel="Verification code"
                  />
                </View>
              </>
            ) : (
              <>
                {mode === "signup" && (
                  <View style={styles.row}>
                    <Text style={styles.label}>USERNAME:</Text>

                    <TextInput
                      style={styles.input}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                      textContentType="username"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      blurOnSubmit={false}
                      editable={!busy}
                      accessibilityLabel="Username"
                    />
                  </View>
                )}

                <View style={styles.row}>
                  <Text style={styles.label}>EMAIL:</Text>

                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    blurOnSubmit={false}
                    editable={!busy}
                    accessibilityLabel="Email address"
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>PASSWORD:</Text>

                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={
                      mode === "login" ? "password" : "newPassword"
                    }
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                    editable={!busy}
                    accessibilityLabel="Password"
                  />
                </View>
              </>
            )}

            {message ? (
              <Text style={styles.error}>{message}</Text>
            ) : notice ? (
              <Text style={styles.hint}>{notice}</Text>
            ) : null}

            <View style={styles.actions}>
              {step === "verify" ? (
                <View style={styles.secondaryActions}>
                  <Pressable
                    onPress={() => void handleResend()}
                    disabled={busy}
                    hitSlop={8}
                  >
                    <Text style={styles.link}>RESEND</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setStep("form");
                      setCode("");
                      clearMessages();
                    }}
                    disabled={busy}
                    hitSlop={8}
                  >
                    <Text style={styles.link}>BACK</Text>
                  </Pressable>
                </View>
              ) : (
                <View />
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.enterText, busy && styles.disabledText]}>
                  {buttonLabel}
                </Text>
              </Pressable>
            </View>

            {busy && <ActivityIndicator size="small" color={colors.ink} />}
          </View>
        </View>

        <Pressable
          onPress={() => void handleGoogleSignIn()}
          disabled={busy}
          style={styles.google}
          accessibilityRole="button"
        >
          <View style={styles.googleInner}>
            <Text style={styles.googleText}>CONTINUE WITH GOOGLE</Text>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  logo: {
    position: "absolute",
    left: 14,
    width: 62,
    height: 46,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 60,
  },

  box: {
    width: "72%",
    minWidth: 290,
    maxWidth: 380,
    backgroundColor: colors.box,
    padding: 7,
  },

  tabs: {
    flexDirection: "row",
    gap: 7,
  },

  tab: {
    flex: 1,
    backgroundColor: colors.white,
    paddingVertical: 14,
    alignItems: "center",
  },

  tabText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
  },

  tabActive: {
    textDecorationLine: "underline",
  },

  panel: {
    backgroundColor: colors.white,
    marginTop: 7,
    padding: 20,
    gap: 24,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: colors.ink,
  },

  input: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    paddingVertical: 0,
    paddingBottom: 1,
    borderBottomWidth: 2,
    borderColor: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.ink,
  },

  google: {
    width: "72%",
    minWidth: 290,
    maxWidth: 380,
    backgroundColor: colors.box,
    padding: 7,
    marginTop: 14,
  },

  googleInner: {
    backgroundColor: colors.white,
    paddingVertical: 14,
    alignItems: "center",
  },

  googleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
  },

  hint: {
    fontFamily: fonts.body,
    color: colors.quote,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.5,
  },

  error: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  secondaryActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  link: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: colors.quote,
    marginRight: 16,
  },

  enterText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.ink,
  },

  disabledText: {
    opacity: 0.5,
  },
});
