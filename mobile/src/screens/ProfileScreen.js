import React from 'react';
import { ScrollView, View, Text, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Avatar, StatusChip, useTheme, sheet } from '../components/ui';
import { spacing } from '../theme';

export default function ProfileScreen() {
  const t = useTheme();
  const { user, logout, isTeacher } = useAuth();

  return (
    <ScrollView style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>

      <View style={[sheet.row, { gap: spacing(4) }]}>
        <Avatar user={user} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={[sheet.h1, { color: t.text }]}>{user.name}</Text>
          <Text style={{ color: t.textSecondary, fontSize: 13, textTransform: 'capitalize' }}>
            {user.role} · {user.email}
          </Text>
        </View>
      </View>

      {!isTeacher && (
        <Card style={{ gap: spacing(2) }}>
          <View style={[sheet.row, { justifyContent: 'space-between' }]}>
            <Text style={{ color: t.text, fontWeight: '600' }}>Face recognition</Text>
            <StatusChip status={user.faceEnrolledAt ? 'present' : 'missing'}
              label={user.faceEnrolledAt ? 'Enrolled' : 'Not enrolled'} />
          </View>
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>
            {user.faceEnrolledAt
              ? `Enrolled ${new Date(user.faceEnrolledAt).toLocaleDateString()}. Your attendance is recorded automatically in live classes.`
              : 'Enrol your face in the web app so your attendance is recorded automatically. Until then your teacher marks you manually.'}
          </Text>
        </Card>
      )}

      {user.studentId && (
        <Card style={{ gap: 4 }}>
          <Text style={{ color: t.textMuted, fontSize: 11 }}>Student ID</Text>
          <Text style={{ color: t.text, fontWeight: '600' }}>{user.studentId}</Text>
          {user.department && (
            <>
              <Text style={{ color: t.textMuted, fontSize: 11, marginTop: spacing(2) }}>Department</Text>
              <Text style={{ color: t.text, fontWeight: '600' }}>{user.department}</Text>
            </>
          )}
        </Card>
      )}

      <Button title="Sign out" variant="danger"
        onPress={() => Alert.alert('Sign out', 'Sign out of this device?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: logout },
        ])} />
    </ScrollView>
  );
}
