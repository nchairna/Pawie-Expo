import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { signIn } from '@/lib/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';

// Email validation regex - accepts standard email formats including short TLDs (.id, .io, etc.)
// Format: local-part@domain.tld
// Allows: letters, numbers, dots, hyphens, underscores, plus signs, percent in local part
// Allows: letters, numbers, dots, hyphens in domain
// Requires: at least one dot in domain (for TLD) and TLD must be at least 2 characters
// This regex accepts emails like: contact@deploi.id, user+tag@example.co.uk, test_email@sub-domain.example.com
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]{2,}$/;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const { refreshProfile } = useAuth();

  const validateEmail = (emailValue: string): string | undefined => {
    if (!emailValue.trim()) {
      return 'Email is required';
    }
    if (!emailRegex.test(emailValue.trim())) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validatePassword = (passwordValue: string): string | undefined => {
    if (!passwordValue) {
      return 'Password is required';
    }
    return undefined;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errors.email) {
      const error = validateEmail(value);
      setErrors((prev) => ({ ...prev, email: error }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (errors.password) {
      const error = validatePassword(value);
      setErrors((prev) => ({ ...prev, password: error }));
    }
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setErrors({});

    // Validate fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError,
      });
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      await refreshProfile();
      router.replace('/(tabs)/shop');
    } catch (error: any) {
      // Handle specific error messages
      let errorMessage = 'Failed to sign in. Please try again.';
      let emailError: string | undefined;
      let passwordError: string | undefined;

      if (error?.message) {
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('Invalid email or password') ||
            error.message.includes('email') && error.message.includes('password')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          emailError = 'Invalid email or password';
          passwordError = 'Invalid email or password';
        } else if (error.message.includes('email')) {
          errorMessage = 'Invalid email address.';
          emailError = 'Invalid email address';
        } else if (error.message.includes('password')) {
          errorMessage = 'Invalid password.';
          passwordError = 'Invalid password';
        } else if (error.message.includes('not found') || error.message.includes('does not exist')) {
          errorMessage = 'No account found with this email. Please sign up first.';
          emailError = 'Account not found';
        } else {
          errorMessage = error.message;
        }
      }

      setErrors({
        general: errorMessage,
        email: emailError,
        password: passwordError,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Sign In
          </ThemedText>
          <ThemedText style={styles.subtitle}>Enter your email and password to continue</ThemedText>

          <View style={styles.form}>
            <View style={styles.fieldContainer}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={handleEmailChange}
                onBlur={() => {
                  const error = validateEmail(email);
                  setErrors((prev) => ({ ...prev, email: error }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
              {errors.email && (
                <ThemedText style={styles.errorText}>{errors.email}</ThemedText>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <ThemedText style={styles.label}>Password</ThemedText>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={() => {
                  const error = validatePassword(password);
                  setErrors((prev) => ({ ...prev, password: error }));
                }}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />
              {errors.password && (
                <ThemedText style={styles.errorText}>{errors.password}</ThemedText>
              )}
            </View>

            {errors.general && (
              <View style={styles.generalErrorContainer}>
                <ThemedText style={styles.generalErrorText}>{errors.general}</ThemedText>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/register')}
              disabled={loading}>
              <ThemedText style={styles.linkText}>
                Do not have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
  form: {
    width: '100%',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  generalErrorContainer: {
    backgroundColor: '#FF3B3010',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  generalErrorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
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
