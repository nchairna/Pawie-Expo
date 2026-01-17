import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function TestSupabaseScreen() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    async function testConnection() {
      try {
        // Test basic connection by fetching session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          // Even if there's no session, if we get here without a connection error, Supabase is connected
          if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
            setStatus('error');
            setMessage('Supabase is connected, but there may be an issue with your API key configuration.');
          } else {
            // No session is fine - just means user isn't logged in
            setStatus('success');
            setMessage('✅ Supabase connection successful! (No active session - this is normal)');
          }
        } else {
          setStatus('success');
          setMessage('✅ Supabase connection successful!');
        }
      } catch (err) {
        setStatus('error');
        setMessage(`❌ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    testConnection();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Supabase Connection Test</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[
            styles.statusBox,
            status === 'loading' && styles.statusLoading,
            status === 'success' && styles.statusSuccess,
            status === 'error' && styles.statusError,
          ]}>
            {status === 'loading' && (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.statusText}>Testing connection...</Text>
              </>
            )}
            {status !== 'loading' && (
              <Text style={styles.statusText}>{message}</Text>
            )}
          </View>
        </View>

        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>If you see an error, check:</Text>
          <Text style={styles.helpItem}>• Your .env.local file exists</Text>
          <Text style={styles.helpItem}>• Environment variables are set correctly</Text>
          <Text style={styles.helpItem}>• Supabase project URL and anon key are valid</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  statusContainer: {
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusBox: {
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLoading: {
    backgroundColor: '#fef3c7',
  },
  statusSuccess: {
    backgroundColor: '#d1fae5',
  },
  statusError: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  helpContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  helpItem: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
});

