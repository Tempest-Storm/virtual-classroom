import React from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Loading } from './src/components/ui';
import { light, dark } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CoursesScreen from './src/screens/CoursesScreen';
import CourseDetailScreen from './src/screens/CourseDetailScreen';
import AssignmentsScreen from './src/screens/AssignmentsScreen';
import AssignmentDetailScreen from './src/screens/AssignmentDetailScreen';
import ScoreboardScreen from './src/screens/ScoreboardScreen';
import ClassroomScreen from './src/screens/ClassroomScreen';
import RecordingScreen from './src/screens/RecordingScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS = { Home: '◧', Courses: '▤', Work: '✎', Profile: '◉' };

function Tabs() {
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? dark : light;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.series1,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 17 }}>{ICONS[route.name]}</Text>
        ),
      })}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Courses" component={CoursesScreen} />
      <Tab.Screen name="Work" component={AssignmentsScreen} options={{ title: 'Assignments' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? dark : light;

  if (loading) return <Loading label="Restoring your session" />;

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: t.plane, card: t.surface, text: t.text, border: t.border, primary: t.series1,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen}
              options={({ route }) => ({ title: route.params?.title || 'Course' })} />
            <Stack.Screen name="AssignmentDetail" component={AssignmentDetailScreen}
              options={({ route }) => ({ title: route.params?.title || 'Assignment' })} />
            <Stack.Screen name="Scoreboard" component={ScoreboardScreen}
              options={{ title: 'Scoreboard' }} />
            <Stack.Screen name="Classroom" component={ClassroomScreen}
              options={({ route }) => ({ title: route.params?.title || 'Live class' })} />
            <Stack.Screen name="Recording" component={RecordingScreen}
              options={({ route }) => ({ title: route.params?.title || 'Recording' })} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
