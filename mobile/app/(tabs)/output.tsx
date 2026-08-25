import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS } from '../../constants/modui-theme';

const FORMATS = [
  { key: 'ppt',  emoji: '📊', label: 'PPT',  desc: '프레젠테이션' },
  { key: 'word', emoji: '📝', label: 'Word', desc: '보고서 문서' },
  { key: 'pdf',  emoji: '📋', label: 'PDF',  desc: '인쇄용 문서' },
] as const;

export default function OutputScreen() {
  const [keyword, setKeyword] = useState('');
  const [team, setTeam]       = useState('딸깍');
  const [formats, setFormats] = useState<Record<string, boolean>>({ ppt: true, word: false, pdf: false });
  const [model, setModel]     = useState<'gpt' | 'gemini'>('gpt');
  const [loading, setLoading] = useState(false);

  const toggleFormat = (key: string) =>
    setFormats(prev => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = () => {
    // TODO: API 연동
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.tag}>
            <View style={styles.dot} />
            <Text style={styles.tagText}>문서봇 AI</Text>
          </View>
          <Text style={styles.title}>키워드 하나로{'\n'}<Text style={styles.titleAccent}>문서 완성</Text></Text>
          <Text style={styles.sub}>주제를 입력하면 AI가 내용을 구성하고{'\n'}바로 받을 수 있는 문서를 만들어줍니다</Text>
        </View>

        {/* 주제 입력 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>주제 입력</Text>
          <TextInput
            style={[styles.input, styles.inputLg]}
            placeholder="예: 하이브리드 클라우드 인프라 설계"
            placeholderTextColor={COLORS.slate2}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>

        {/* 출력 형식 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>출력 형식</Text>
          <View style={styles.formatRow}>
            {FORMATS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.formatCard, formats[f.key] && styles.formatCardActive]}
                onPress={() => toggleFormat(f.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.formatEmoji}>{f.emoji}</Text>
                <Text style={styles.formatLabel}>{f.label}</Text>
                <Text style={styles.formatDesc}>{f.desc}</Text>
                {formats[f.key] && (
                  <View style={styles.check}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 팀명 */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>팀명</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 딸깍"
            placeholderTextColor={COLORS.slate2}
            value={team}
            onChangeText={setTeam}
          />
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
          onPress={handleGenerate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.btnLoading}>
              <ActivityIndicator color={COLORS.white} size="small" />
              <Text style={styles.mainBtnText}>생성 중...</Text>
            </View>
          ) : (
            <Text style={styles.mainBtnText}>✨  문서 자동 생성</Text>
          )}
        </TouchableOpacity>

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
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.ok },
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
  sub: { fontSize: 14, color: COLORS.slate, lineHeight: 22 },

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
  inputLg: { fontSize: 15, paddingVertical: 14 },

  formatRow: { flexDirection: 'row', gap: 9 },
  formatCard: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: 6,
    backgroundColor: COLORS.paper,
    gap: 3,
    position: 'relative',
  },
  formatCardActive: {
    borderColor: COLORS.indigo,
    backgroundColor: COLORS.sky,
  },
  formatEmoji: { fontSize: 26, marginBottom: 4 },
  formatLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
  },
  formatDesc: {
    fontSize: 10,
    color: COLORS.slate2,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
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
});
