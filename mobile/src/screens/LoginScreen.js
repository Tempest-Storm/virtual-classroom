import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button, useTheme, sheet } from '../components/ui';
import { spacing, radius } from '../theme';

export default function LoginScreen() {
  const t = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const input = {
    backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
    borderRadius: radius.sm, padding: spacing(3), color: t.text, marginBottom: spacing(3),
  };

  async function submit() {
    setBusy(true); setError(null);
    try { await login(email.trim(), password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing(6), backgroundColor: t.plane }}>
        <View style={{
          width: 52, height: 52, borderRadius: radius.md, backgroundColor: t.series1,
          alignItems: 'center', justifyContent: 'center', marginBottom: spacing(5),
        }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>VC</Text>
        </View>

        <Text style={[sheet.h1, { color: t.text }]}>Virtual Classroom</Text>
        <Text style={{ color: t.textSecondary, marginTop: 4, marginBottom: spacing(6) }}>
          Sign in to join classes and track your progress.
        </Text>

        {error && (
          <Text style={{
            color: t.text, backgroundColor: '#d03b3b24', padding: spacing(3),
            borderRadius: radius.sm, marginBottom: spacing(3), fontSize: 13,
          }}>⚠  {error}</Text>
        )}

        <Text style={{ color: t.text, fontWeight: '600', marginBottom: 4, fontSize: 13 }}>Email</Text>
        <TextInput style={input} value={email} onChangeText={setEmail} autoCapitalize="none"
          keyboardType="email-address" placeholder="you@school.edu" placeholderTextColor={t.textMuted} />

        <Text style={{ color: t.text, fontWeight: '600', marginBottom: 4, fontSize: 13 }}>Password</Text>
        <TextInput style={input} value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" placeholderTextColor={t.textMuted} />

        <Button title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy || !email || !password} />

        <Text style={{ color: t.textMuted, fontSize: 11, marginTop: spacing(6), textAlign: 'center' }}>
          Demo: teacher@demo.io or amina@demo.io — password Password123
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
