import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS } from '../../constants/modui-theme';

const MENU = [
  { emoji: '👤', label: '프로필 수정' },
  { emoji: '🔔', label: '알림 설정' },
  { emoji: '🏢', label: '조직 정보' },
  { emoji: '📁', label: '저장된 문서' },
  { emoji: '❓', label: '도움말' },
];

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = () => {
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* 프로필 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>지</Text>
          </View>
          <Text style={styles.name}>지유</Text>
          <Text style={styles.email}>jiyou@modui.cloud</Text>
          <View style={styles.teamBadge}>
            <Text style={styles.teamText}>팀 딸깍</Text>
          </View>
        </View>

        {/* 메뉴 */}
        <View style={styles.menuCard}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < MENU.length - 1 && styles.menuItemBorder]}
              activeOpacity={0.7}
            >
              <Text style={styles.menuEmoji}>{item.emoji}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Modui v0.1.0</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40, gap: 14 },

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.5,
  },
  email: {
    fontSize: 13,
    color: COLORS.slate2,
  },
  teamBadge: {
    backgroundColor: COLORS.sky,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginTop: 8,
  },
  teamText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.indigo,
  },

  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.sky,
  },
  menuEmoji: { fontSize: 18 },
  menuLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.ink,
  },
  menuArrow: {
    fontSize: 22,
    color: COLORS.slate2,
    fontWeight: '300',
  },

  logoutBtn: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    paddingVertical: 15,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.rose,
  },

  version: {
    textAlign: 'center',
    fontSize: 11.5,
    color: COLORS.slate2,
    marginTop: 8,
  },
});
