import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ChatThreadScreen } from '../screens/ChatThreadScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { MapScreen } from '../screens/MapScreen';
import { NearbyScreen } from '../screens/NearbyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? colors.accent : colors.textMuted,
        fontSize: 11,
        fontWeight: focused ? '700' : '600',
        marginBottom: 2,
      }}
    >
      {label}
    </Text>
  );
}

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 18, color: focused ? colors.accent : colors.textMuted, marginTop: 4 }}>
      {glyph}
    </Text>
  );
}

function ChatsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="ChatsList"
        component={ChatsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={{
          title: 'Chat',
          headerBackTitle: 'Chats',
        }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#0F1728',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 58 + Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsStack}
        options={({ route }) => {
          const focused = getFocusedRouteNameFromRoute(route) ?? 'ChatsList';
          return {
            tabBarLabel: ({ focused: f }) => <TabLabel label="Chats" focused={f} />,
            tabBarIcon: ({ focused: f }) => <TabIcon glyph="◉" focused={f} />,
            tabBarStyle:
              focused === 'ChatThread'
                ? { display: 'none' }
                : {
                    backgroundColor: '#0F1728',
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 58 + Math.max(insets.bottom, 8),
                    paddingTop: 6,
                    paddingBottom: Math.max(insets.bottom, 8),
                  },
          };
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Map" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Nearby"
        component={NearbyScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Nearby" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon glyph="◌" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Friends" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon glyph="◍" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label="Settings" focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon glyph="☰" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { ready, unlocked } = useApp();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.bg,
          card: colors.bgElevated,
          primary: colors.accent,
          text: colors.text,
          border: colors.border,
        },
      }}
    >
      {unlocked ? <MainTabs /> : <OnboardingScreen />}
    </NavigationContainer>
  );
}
