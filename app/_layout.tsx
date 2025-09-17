import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { RecordingProvider } from './context/RecordingContext';

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Configure audio mode for playback
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RecordingProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
        </Stack>
        <StatusBar style="auto" />
      </RecordingProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}
