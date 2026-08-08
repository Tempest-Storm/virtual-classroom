import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEB_URL, tokenStore } from '../api/client';
import { useTheme, ErrorView } from '../components/ui';
import { spacing } from '../theme';

/**
 * The live classroom runs inside a WebView pointed at the web client.
 *
 * Why: WebRTC mesh video *and* the on-device face-embedding model both already
 * exist and are tuned in the browser build. Re-implementing them natively would
 * mean a second WebRTC stack and a second ML runtime to keep in sync, for the
 * same result. The WebView reuses one implementation, and the native shell
 * keeps ownership of navigation, permissions, and the session token.
 */
export default function ClassroomScreen({ route }) {
  const t = useTheme();
  const { roomId } = route.params;
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const webRef = useRef(null);

  useEffect(() => {
    tokenStore.get().then(setToken).catch(setError);
  }, []);

  if (error) return <ErrorView error={error} />;

  if (!token) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.plane }}>
        <ActivityIndicator color={t.series1} />
      </View>
    );
  }

  // Hand the WebView the same token the native app holds, so the browser
  // context signs in as the same user without a second login.
  const injected = `
    try { localStorage.setItem('vc.token', ${JSON.stringify(token)}); } catch (e) {}
    true;
  `;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <WebView
        ref={webRef}
        source={{ uri: `${WEB_URL}/class/${roomId}` }}
        injectedJavaScriptBeforeContentLoaded={injected}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        onPermissionRequest={(e) => e.nativeEvent?.grant?.(e.nativeEvent.resources)}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.plane }}>
            <ActivityIndicator color={t.series1} />
            <Text style={{ color: t.textSecondary, marginTop: spacing(3), fontSize: 13 }}>
              Joining the classroom…
            </Text>
          </View>
        )}
        onError={({ nativeEvent }) => setError(new Error(nativeEvent.description || 'Could not load the classroom'))}
        style={{ flex: 1 }}
      />
      {Platform.OS === 'android' && (
        <Text style={{
          color: '#fff', fontSize: 10, textAlign: 'center', paddingVertical: 4, backgroundColor: '#000',
        }}>
          Camera and microphone access is required for attendance
        </Text>
      )}
    </View>
  );
}
