import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { User } from '@supabase/supabase-js';
import { colors } from '../constants/theme';

type Props = {
  user: User;
  onSignOut: () => void;
};

function getDisplayName(user: User): string {
  return (
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'User'
  );
}

export default function ProfileScreen({ user, onSignOut }: Props) {
  const displayName = getDisplayName(user);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        {user.email && <Text style={styles.email}>{user.email}</Text>}
      </View>
      <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.textDim,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    color: colors.textDim,
  },
  signOutButton: {
    marginTop: 48,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
  },
  signOutText: {
    color: colors.textDim,
    fontSize: 14,
  },
});
