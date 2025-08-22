'use client';

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, Animated, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useEffect } from 'react';

// Screens
import MatrimonialLoginScreen from './screens/LoginScreen';
import MatchesScreen from './screens/MatchesScreen';
import InterestsScreen from './screens/InterestsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import 'react-native-gesture-handler';

// Session Context
import { SessionProvider, useSession } from 'context/SessionContext';

// Navigators
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ACTIVE_COLOR = '#e91e63'; // Modern pink for matrimonial theme
const INACTIVE_COLOR = '#6b7280';
const BACKGROUND_GRADIENT = ['#fafafa', '#f5f5f5'];

/* ---------------- Modern Tab Button ---------------- */
function ModernTabButton({ children, onPress, accessibilityState, route }) {
  const focused = accessibilityState?.selected;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(0.7)).current;
  const slideValue = useRef(new Animated.Value(0)).current;
  const glowValue = useRef(new Animated.Value(0)).current;
  const backgroundValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: focused ? 1.05 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityValue, {
        toValue: focused ? 1 : 0.65,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideValue, {
        toValue: focused ? 1 : 0,
        duration: 400,
        useNativeDriver: false,
      }),
      Animated.timing(glowValue, {
        toValue: focused ? 1 : 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(backgroundValue, {
        toValue: focused ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: focused ? 1.05 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();
    onPress();
  };

  const getTabInfo = () => {
    switch (route.name) {
      case 'Matches':
        return {
          iconName: focused ? 'heart' : 'heart-outline',
          label: 'Matches',
          focusedIcon: 'heart-circle',
        };
      case 'Interests':
        return {
          iconName: focused ? 'sparkles' : 'sparkles-outline',
          label: 'Interests',
          focusedIcon: 'star-half',
        };
      case 'Profile':
        return {
          iconName: focused ? 'person-circle' : 'person-circle-outline',
          label: 'Profile',
          focusedIcon: 'person',
        };
      case 'Settings':
        return {
          iconName: focused ? 'settings' : 'settings-outline',
          label: 'Settings',
          focusedIcon: 'cog',
        };
      default:
        return {
          iconName: 'heart-outline',
          label: '',
          focusedIcon: 'heart',
        };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <Pressable
      onPress={handlePress}
      className="relative flex-1 items-center justify-center px-3 py-4">
      {/* Active Background with Gradient */}
      <Animated.View
        style={{
          opacity: backgroundValue,
          transform: [{ scaleX: backgroundValue }, { scaleY: backgroundValue }],
        }}
        className="absolute bottom-2 left-1 right-1 top-2 overflow-hidden rounded-2xl">
        <LinearGradient colors={[`${ACTIVE_COLOR}08`, `${ACTIVE_COLOR}12`]} className="flex-1" />
      </Animated.View>

      {/* Glow Effect */}
      <Animated.View
        style={{ opacity: glowValue }}
        className="absolute bottom-1 left-0 right-0 top-1 rounded-2xl">
        <LinearGradient
          colors={[`${ACTIVE_COLOR}15`, 'transparent', `${ACTIVE_COLOR}15`]}
          className="flex-1 rounded-2xl"
        />
      </Animated.View>

      <Animated.View
        style={{
          transform: [{ scale: scaleValue }],
          opacity: opacityValue,
        }}
        className="relative z-10 items-center justify-center">
        {/* Icon Container with Modern Design */}
        <View className="relative mb-2 items-center justify-center">
          {/* Icon Shadow/Glow for Active State */}
          {focused && (
            <View
              className="absolute h-8 w-8 rounded-full opacity-20"
              style={{
                backgroundColor: ACTIVE_COLOR,
                shadowColor: ACTIVE_COLOR,
                shadowOpacity: 0.4,
                shadowRadius: 8,
              }}
            />
          )}

          <Ionicons
            name={tabInfo.iconName}
            size={focused ? 26 : 24}
            color={focused ? ACTIVE_COLOR : INACTIVE_COLOR}
            style={{
              textShadowColor: focused ? `${ACTIVE_COLOR}30` : 'transparent',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          />

          {/* Active Indicator Pulse */}
          {focused && (
            <Animated.View
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full"
              style={{
                backgroundColor: ACTIVE_COLOR,
                transform: [{ scale: glowValue }],
                shadowColor: ACTIVE_COLOR,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 4,
              }}
            />
          )}
        </View>

        {/* Modern Typography */}
        <Text
          className={`text-xs leading-tight tracking-wide ${focused ? 'font-semibold' : 'font-medium'}`}
          style={{
            color: focused ? ACTIVE_COLOR : INACTIVE_COLOR,
            letterSpacing: 0.3,
          }}>
          {tabInfo.label}
        </Text>

        {/* Active Underline */}
        <Animated.View
          style={{
            width: slideValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 40],
            }),
            backgroundColor: ACTIVE_COLOR,
            opacity: slideValue,
          }}
          className="mt-1 h-0.5 rounded-full"
        />
      </Animated.View>
    </Pressable>
  );
}

/* ---------------- Modern Professional Tab Bar ---------------- */
function ModernTabBar({ state, descriptors, navigation }) {
  return (
    <View
      className="relative"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
      }}>
      {/* Main Tab Bar Container */}
      <LinearGradient colors={BACKGROUND_GRADIENT} className="border-t border-gray-100">
        {/* Top Accent Line */}
        <LinearGradient
          colors={[`${ACTIVE_COLOR}40`, `${ACTIVE_COLOR}20`, `${ACTIVE_COLOR}40`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="h-0.5"
        />

        {/* Subtle Inner Shadow */}
        <View className="absolute left-0 right-0 top-0.5 h-px bg-white/50" />

        <View className="flex-row">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <ModernTabButton
                key={route.key}
                onPress={onPress}
                accessibilityState={{ selected: isFocused }}
                route={route}
              />
            );
          })}
        </View>

        {/* Bottom Safe Area with Subtle Gradient */}
        <LinearGradient colors={['transparent', 'rgba(255,255,255,0.9)']} className="h-2" />
      </LinearGradient>

      {/* Decorative Elements */}
      <View className="absolute bottom-2 left-4 h-1 w-1 rounded-full bg-gradient-to-r from-pink-200 to-purple-200 opacity-60" />
      <View className="absolute bottom-2 right-4 h-1 w-1 rounded-full bg-gradient-to-r from-purple-200 to-pink-200 opacity-60" />
    </View>
  );
}

/* ---------------- Main Tab Navigator ---------------- */
function MainTabs() {
  return (
    <View className="flex-1">
      <LinearGradient colors={['#fafafa', '#f8fafc']} className="flex-1">
        <Tab.Navigator
          initialRouteName="Matches"
          tabBar={(props) => <ModernTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}>
          <Tab.Screen name="Matches" component={MatchesScreen} />
          <Tab.Screen name="Interests" component={InterestsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </LinearGradient>
    </View>
  );
}

/* ---------------- Root Navigator with Auth Check ---------------- */
function RootNavigator() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <LinearGradient
        colors={['#fafafa', '#f3f4f6']}
        className="flex-1 items-center justify-center">
        <View className="items-center rounded-3xl bg-white/80 p-8 shadow-xl">
          <ActivityIndicator size="large" color={ACTIVE_COLOR} />
          <Text className="mt-4 text-lg font-semibold text-gray-600">Loading...</Text>
          <Text className="mt-1 text-sm font-medium text-gray-400">Please wait</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={MatrimonialLoginScreen} />
      )}
    </Stack.Navigator>
  );
}

/* ---------------- Main App ---------------- */
export default function App() {
  return (
    <SessionProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </SessionProvider>
  );
}
