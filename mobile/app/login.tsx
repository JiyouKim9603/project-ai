import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS, RADIUS } from '../constants/modui-theme';

function ModuiLogo({ size = 56 }: { size?: number }) {
  return (
    <View style={[styles.logoBox, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="cg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#5bbfff" />
            <Stop offset="1" stopColor="#1a5fc8" />
          </LinearGradient>
        </Defs>
        <Path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="url(#cg)" />
        <Path d="M12 2l9 5-9 5-9-5 9-5z" fill="#5bbfff" opacity={0.95} />
        <Path d="M3 7l9 5v10L3 17V7z" fill="#1a6fd4" />
        <Path d="M21 7l-9 5v10l9-5V7z" fill="#2d8be8" />
      </Svg>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    // TODO: 실제 로그인 API 연동
    setTimeout(() => {
      setLoading(false);
      router.replace('/(tabs)');
    }, 600);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* 로고 */}
          <View style={styles.header}>
            <ModuiLogo size={64} />
            <Text style={styles.brand}>Modui</Text>
            <Text style={styles.brandSub}>AI GROUPWARE</Text>
          </View>

          {/* 폼 */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor={COLORS.slate2}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.slate2}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnText}>
                {loading ? '로그인 중...' : '로그인'}
              </Text>
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <TouchableOpacity>
                <Text style={styles.link}>회원가입</Text>
              </TouchableOpacity>
              <Text style={styles.divider}>·</Text>
              <TouchableOpacity>
                <Text style={styles.link}>비밀번호 찾기</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 하단 */}
          <Text style={styles.footer}>
            여러 협업 툴, 하나로 합치세요
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  header: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.ink,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  brand: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.8,
    marginTop: 16,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate2,
    letterSpacing: 3,
    marginTop: 4,
  },
  form: { gap: 16 },
  field: { gap: 7 },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.slate,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.paper,
  },
  loginBtn: {
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 15.5,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  link: {
    fontSize: 13,
    color: COLORS.slate,
    fontWeight: '600',
  },
  divider: { color: COLORS.slate2, fontSize: 13 },
  footer: {
    textAlign: 'center',
    fontSize: 12.5,
    color: COLORS.slate2,
    marginTop: 48,
  },
});
