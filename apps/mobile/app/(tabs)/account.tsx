import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';

export default function AccountScreen() {
  const { user, profile, signOut, loading } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.error('Sign out error:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Welcome
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to access your account, orders, and pets
          </ThemedText>

          <TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/register')}>
            <ThemedText style={styles.linkText}>
              Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Account
        </ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText style={styles.value}>{profile?.email || user.email || 'N/A'}</ThemedText>
        </View>

        {profile?.full_name && (
          <View style={styles.section}>
            <ThemedText style={styles.label}>Full Name</ThemedText>
            <ThemedText style={styles.value}>{profile.full_name}</ThemedText>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.label}>Role</ThemedText>
          <ThemedText style={styles.value}>{profile?.role || 'user'}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>User ID</ThemedText>
          <ThemedText style={[styles.value, styles.mono]}>{user.id}</ThemedText>
        </View>

        <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  value: {
    fontSize: 16,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    opacity: 0.7,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    marginTop: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
  linkTextBold: {
    fontWeight: '600',
    color: '#007AFF',
  },
});








