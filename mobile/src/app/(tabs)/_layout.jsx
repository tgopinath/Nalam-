import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../lib/ui';

const icon = (e) => ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{e}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.brandDark, tabBarLabelStyle: { fontWeight: '600' }, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerTitleStyle: { fontWeight: '800' } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="food" options={{ title: 'Food', tabBarIcon: icon('🍽️') }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: icon('💪') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('☰') }} />
    </Tabs>
  );
}
