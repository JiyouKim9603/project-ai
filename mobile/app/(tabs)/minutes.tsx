import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS } from '../../constants/modui-theme';

export default function MinutesScreen() {
  const [title, setTitle]   = useState('');
  const [model, setModel]   = useState<'gpt' | 'gemini'>('gpt');
  const [file, setFile]     = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tab, setTab]       = useState<'summary' | 'transcript'>('summary');

  const handlePickFile = () => {
    // TODO: expo-document-picker 연동
  };

  const handleAnalyze = () => {
    // TODO: API 연동
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.tag}>
            <View style={styles.dot} />
            <Text style={styles.tagText}>회의록 AI</Text>
          </View>
          <Text style={styles.title}>음성이 곧{'\n'}<Text style={styles.titleAccent}>회의록이 됩니다</Text></Text>
          <Text style={styles.sub}>회의 음성을 업로드하면 자동으로{'\n'}받아쓰고 핵심을 요약합니다</Text>
        </View>

        {/* 회의 정보 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>회의 정보</Text>
          <TextInput
            style={styles.input}
            placeholder="회의 제목 (예: 3분기 기획 회의)"
            placeholderTextColor={COLORS.slate2}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* 음성 업로드 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>음성 파일</Text>
          <TouchableOpacity
            style={[styles.upload, file && styles.uploadActive]}
            onPress={handlePickFile}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadEmoji}>{file ? '🎵' : '🎙️'}</Text>
            <Text style={styles.uploadText}>
              {file ? file.name : '탭해서 음성 파일 선택'}
            </Text>
            <Text style={styles.uploadSub}>mp3, wav, m4a, ogg 지원</Text>
          </TouchableOpacity>
        </View>

        {/* AI 모델 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>AI 모델</Text>
          <View style={styles.modelRow}>
            {([
              ['gpt', 'GPT-4o-mini', COLORS.okSoft, COLORS.ok],
              ['gemini', 'Gemini 1.5', '#e3f2fd', '#1565c0'],
            ] as const).map(([key, label, bg, color]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.modelBtn,
                  model === key && { backgroundColor: bg, borderColor: color },
                ]}
                onPress={() => setModel(key)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.modelDot,
                  { backgroundColor: model === key ? color : COLORS.line },
                ]} />
                <Text style={[
                  styles.modelText,
                  model === key && { color },
                ]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 생성 버튼 */}
        <TouchableOpacity
          style={[styles.mainBtn, loading && styles.mainBtnDisabled]}
          onPress={handleAnalyze}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.btnLoading}>
              <ActivityIndicator color={COLORS.white} size="small" />
              <Text style={styles.mainBtnText}>분석 중...</Text>
            </View>
          ) : (
            <Text style={styles.mainBtnText}>🎙️  회의록 자동 생성</Text>
          )}
        </TouchableOpacity>

        {/* 결과 */}
        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'summary' && styles.tabActive]}
                onPress={() => setTab('summary')}
              >
                <Text style={[styles.tabText, tab === 'summary' && styles.tabTextActive]}>
                  📋 정리
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'transcript' && styles.tabActive]}
                onPress={() => setTab('transcript')}
              >
                <Text style={[styles.tabText, tab === 'transcript' && styles.tabTextActive]}>
                  🎙️ 원문
                </Text>
              </TouchableOpacity>
            </View>
            {/* TODO: 결과 렌더링 */}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>AI가 정리한 회의록</Text>
            <Text style={styles.emptySub}>음성 파일을 업로드하고{'\n'}생성 버튼을 눌러보세요</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, paddingBottom: 40, gap: 14 },

  header: { marginBottom: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.sky,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginBottom: 16,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.ok,
  },
  tagText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.indigo,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: 12,
  },
  titleAccent: { color: COLORS.indigo },
  sub: {
    fontSize: 14,
    color: COLORS.slate,
    lineHeight: 22,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 18,
  },
  cardLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.indigo,
    letterSpacing: 1,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.ink,
    backgroundColor: COLORS.paper,
  },

  upload: {
    borderWidth: 2,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: COLORS.paper,
    gap: 4,
  },
  uploadActive: {
    borderStyle: 'solid',
    borderColor: COLORS.indigo,
    backgroundColor: COLORS.sky,
  },
  uploadEmoji: { fontSize: 30, marginBottom: 6 },
  uploadText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.slate,
  },
  uploadSub: {
    fontSize: 11.5,
    color: COLORS.slate2,
  },

  modelRow: { flexDirection: 'row', gap: 8 },
  modelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.paper,
  },
  modelDot: { width: 8, height: 8, borderRadius: 4 },
  modelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate,
  },

  mainBtn: {
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.md,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: COLORS.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  mainBtnDisabled: { opacity: 0.5 },
  mainBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  btnLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  empty: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 56,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 40, opacity: 0.3, marginBottom: 6 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.slate,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.slate2,
    textAlign: 'center',
    lineHeight: 20,
  },

  resultCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.line,
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 14,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -2,
  },
  tabActive: { borderBottomColor: COLORS.indigo },
  tabText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.slate2,
  },
  tabTextActive: { color: COLORS.indigo },
});
