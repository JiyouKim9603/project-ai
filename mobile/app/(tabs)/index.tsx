import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS, RADIUS } from '../../constants/modui-theme';

function ModuiLogo({ size = 34 }: { size?: number }) {
  return (
    <View style={[styles.logoBox, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="hg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#5bbfff" />
            <Stop offset="1" stopColor="#1a5fc8" />
          </LinearGradient>
        </Defs>
        <Path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="url(#hg)" />
        <Path d="M12 2l9 5-9 5-9-5 9-5z" fill="#5bbfff" opacity={0.95} />
        <Path d="M3 7l9 5v10L3 17V7z" fill="#1a6fd4" />
        <Path d="M21 7l-9 5v10l9-5V7z" fill="#2d8be8" />
      </Svg>
    </View>
  );
}

const MODULES = [
  { key: 'minutes',  emoji: '🎙️', name: '회의록 AI', desc: '음성을 회의록으로',    route: '/minutes',  ready: true  },
  { key: 'output',   emoji: '📄', name: '문서봇 AI', desc: 'PPT·Word·PDF 생성',   route: '/output',   ready: true  },
  { key: 'mail',     emoji: '✉️', name: '메일 AI',   desc: '메일 작성·답장·요약',  route: null,        ready: false },
  { key: 'calendar', emoji: '📅', name: '캘린더',    desc: '팀 일정 공유',         route: null,        ready: false },
  { key: 'chat',     emoji: '💬', name: '메신저',    desc: '채널 기반 협업',       route: null,        ready: false },
  { key: 'video',    emoji: '📹', name: '화상회의',  desc: '링크 하나로 회의',     route: null,        ready: false },
  { key: 'approval', emoji: '✅', name: '전자결재',  desc: '결재선 자동 승인',     route: null,        ready: false },
  { key: 'remote',   emoji: '🖥️', name: '원격지원',  desc: '화면 공유 문제 해결',  route: null,        ready: false },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <ModuiLogo />
            <View>
              <Text style={styles.brand}>Modui</Text>
              <Text style={styles.brandSub}>AI GROUPWARE</Text>
            </View>
          </View>
        </View>

        {/* 인사 */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>안녕하세요 👋</Text>
          <Text style={styles.greetingSub}>오늘도 좋은 하루 되세요</Text>
        </View>

        {/* 빠른 실행 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>빠른 실행</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: COLORS.indigo }]}
              onPress={() => router.push('/minutes')}
              activeOpacity={0.85}
            >
              <Text style={styles.quickEmoji}>🎙️</Text>
              <Text style={styles.quickName}>회의록 만들기</Text>
              <Text style={styles.quickDesc}>음성 업로드 한 번으로</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: COLORS.ink }]}
              onPress={() => router.push('/output')}
              activeOpacity={0.85}
            >
              <Text style={styles.quickEmoji}>📄</Text>
              <Text style={styles.quickName}>문서 만들기</Text>
              <Text style={styles.quickDesc}>키워드 하나로</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 모듈 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>모듈</Text>
          <View style={styles.moduleGrid}>
            {MODULES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.moduleCard, !m.ready && styles.moduleCardOff]}
                onPress={() => m.route && router.push(m.route as any)}
                disabled={!m.ready}
                activeOpacity={0.8}
              >
                <Text style={styles.moduleEmoji}>{m.emoji}</Text>
                <Text style={styles.moduleName}>{m.name}</Text>
                <Text style={styles.moduleDesc}>{m.desc}</Text>
                {!m.ready && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonText}>준비중</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { paddingBottom: 32 },

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.slate2,
    letterSpacing: 1.6,
    marginTop: 2,
  },

  greeting: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 6 },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontSize: 14,
    color: COLORS.slate,
    marginTop: 6,
  },

  section: { paddingHorizontal: 20, marginTop: 26 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.indigo,
    letterSpacing: 1,
    marginBottom: 12,
  },

  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    gap: 4,
  },
  quickEmoji: { fontSize: 26, marginBottom: 6 },
  quickName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  quickDesc: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.75)',
  },

  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
    gap: 3,
    position: 'relative',
  },
  moduleCardOff: { opacity: 0.55 },
  moduleEmoji: { fontSize: 22, marginBottom: 6 },
  moduleName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  moduleDesc: {
    fontSize: 11,
    color: COLORS.slate2,
  },
  soonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.sky,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  soonText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.slate2,
  },
});
