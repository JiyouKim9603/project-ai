import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '../../constants/modui-theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.45 }}>
      {emoji}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.indigo,
        tabBarInactiveTintColor: COLORS.slate2,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.line,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="minutes"
        options={{
          title: '회의록',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎙️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="output"
        options={{
          title: '문서봇',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📄" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '내 정보',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
