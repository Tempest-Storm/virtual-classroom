import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { WEB_URL } from '../api/client';

/** Plays a class recording. Relative URLs are resolved against the web host. */
export default function RecordingScreen({ route }) {
  const { url } = route.params;
  const absolute = url.startsWith('http') ? url : `${WEB_URL}${url}`;

  const html = `
    <body style="margin:0;background:#000;display:flex;align-items:center;height:100vh">
      <video src="${absolute}" controls autoplay playsinline style="width:100%"></video>
    </body>`;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <WebView source={{ html }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
    </View>
  );
}
