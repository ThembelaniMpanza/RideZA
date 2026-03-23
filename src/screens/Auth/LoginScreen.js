import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet,
ActivityIndicator,
KeyboardAvoidingView,
Platform,
Alert,
} from 'react-native';

/**
 * LoginScreen.js
 * - Intended to be the last page of an onboarding flow.
 * - On successful login it stores a token + onboarding flag and resets navigation
 *   so user can't go back to onboarding.
 *
 * Usage:
 * navigation.reset({ index: 0, routes: [{ name: 'Home' }] })
 * or adjust the target route name to match your app.
 */

export default function LoginScreen({ navigation }) {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);

const validate = () => {
    return /\S+@\S+\.\S+/.test(email) && password.length >= 6;
};

// Placeholder auth call - replace with your real API call
const fakeSignIn = (email, password) =>
    new Promise((resolve, reject) => {
        setTimeout(() => {
            if (email === 'user@example.com' && password === 'password') {
                resolve({ token: 'fake-jwt-token' });
            } else {
                reject(new Error('Invalid credentials'));
            }
        }, 1000);
    });

const onSignIn = async () => {
    if (!validate()) {
        Alert.alert('Invalid input', 'Please enter a valid email and a password (min 6 chars).');
        return;
    }
    setLoading(true);
    try {
        // Replace fakeSignIn with real API call (fetch/axios) and handle errors accordingly
        const { token } = await fakeSignIn(email.trim().toLowerCase(), password);
        // Persist token and mark onboarding as done
        await AsyncStorage.multiSet([
            ['@user_token', token],
            ['@has_onboarded', 'true'],
        ]);
        // Reset navigation stack so user cannot go back to onboarding/login
        navigation.reset({
            index: 0,
            routes: [{ name: 'HomeScreen' }], // change 'Home' to your main app screen name
        });
    } catch (err) {
        Alert.alert('Sign in failed', err.message || 'Please try again.');
    } finally {
        setLoading(false);
    }
};

const onSkip = async () => {
    // Optionally allow skipping sign in but still mark onboarding as seen
    await AsyncStorage.setItem('@has_onboarded', 'true');
    navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
    });
};

return (
    <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
        <View style={styles.inner}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
            />

            <TouchableOpacity
                style={[styles.button, !validate() || loading ? styles.buttonDisabled : null]}
                onPress={onSignIn}
                disabled={!validate() || loading}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.row}>
                <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
                    <Text style={styles.link}>Create account</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} disabled={loading}>
                    <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={onSkip} disabled={loading} style={styles.skip}>
                <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
        </View>
    </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: '#fff' },
inner: { padding: 24, flex: 1, justifyContent: 'center' },
title: { fontSize: 28, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
subtitle: { fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' },
input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
},
button: {
    height: 48,
    backgroundColor: '#0066ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
},
buttonDisabled: { backgroundColor: '#a0c4ff' },
buttonText: { color: '#fff', fontWeight: '600' },
row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
link: { color: '#0066ff' },
skip: { marginTop: 20, alignItems: 'center' },
skipText: { color: '#999' },
});