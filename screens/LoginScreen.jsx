import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useSession } from 'context/SessionContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const BASE_URL = 'https://shiv-bandhan-testing.vercel.app/';

export default function MatrimonialLoginScreen() {
  const { login, user } = useSession();
  const navigation = useNavigation();
  const [step, setStep] = useState(1); // 1: Phone Number, 2: OTP
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const otpInputRefs = useRef([]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    setIsLoaded(true);

    if (user) {
      navigation.navigate('MainTabs', { screen: 'Matches' }); // Updated to redirect to Matches
    }
  }, [user, navigation]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const handleSendOTP = async () => {
    setError('');
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit mobile number');
      Toast.show({ type: 'error', text1: 'Invalid mobile number' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.replace(/\s/g, '') }),
      });
      const data = await response.json();
      if (data.success) {
        setStep(2);
        setResendTimer(30);
        Toast.show({ type: 'success', text1: 'OTP sent successfully' });
      } else {
        setError(data.message || 'Failed to send OTP');
        Toast.show({ type: 'error', text1: data.message || 'Failed to send OTP' });
      }
    } catch (error) {
      setError('Network error. Please try again.');
      Toast.show({ type: 'error', text1: 'Network error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter complete 6-digit OTP');
      Toast.show({ type: 'error', text1: 'Incomplete OTP' });
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${BASE_URL}api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.replace(/\s/g, ''),
          otp: otpString,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const success = await login(data.userId);
        if (success) {
          Toast.show({ type: 'success', text1: 'Login successful' });
          navigation.navigate('MainTabs', { screen: 'Matches' }); // Updated to redirect to Matches
        } else {
          setError('Session creation failed');
          Toast.show({ type: 'error', text1: 'Session creation failed' });
        }
      } else {
        setError(data.error || 'OTP verification failed');
        Toast.show({ type: 'error', text1: data.error || 'OTP verification failed' });
      }
    } catch (error) {
      setError('Network error. Please try again.');
      Toast.show({ type: 'error', text1: 'Network error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    setResendTimer(30);
    try {
      const response = await fetch(`${BASE_URL}api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.replace(/\s/g, '') }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || 'Failed to resend OTP');
        setResendTimer(0);
        Toast.show({ type: 'error', text1: data.message || 'Failed to resend OTP' });
      } else {
        Toast.show({ type: 'success', text1: 'OTP resent successfully' });
      }
    } catch (error) {
      setError('Network error. Please try again.');
      setResendTimer(0);
      Toast.show({ type: 'error', text1: 'Network error' });
    }
  };

  const formatPhoneDisplay = (phone) => {
    return phone.replace(/(\d{5})(\d{5})/, '$1 $2');
  };

  if (user && isLoaded) {
    return null;
  }

  return (
    <LinearGradient colors={['#fef3f2', '#fff7ed']} style={styles.container}>
      <Reanimated.View entering={FadeIn.duration(1000)} style={styles.formContainer}>
        {/* Decorative Background Circles */}
        <View style={styles.decorativeCircleTop} />
        <View style={styles.decorativeCircleBottom} />

        {/* Main Card */}
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={['#f43f5e', '#ec4899']} style={styles.iconContainer}>
              <Text style={styles.iconText}>💕</Text>
            </LinearGradient>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Find your perfect match</Text>
          </View>

          {step === 1 ? (
            // Phone Number Step
            <View style={styles.content}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="call-outline" size={14} color="#f43f5e" style={styles.labelIcon} />
                  Enter Mobile Number
                </Text>
                <View style={styles.phoneInputContainer}>
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    style={styles.countryCodeInput}
                    placeholder="+91"
                  />
                  <TextInput
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="98765 43210"
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              {error ? (
                <Reanimated.View entering={FadeIn} exiting={FadeOut} style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </Reanimated.View>
              ) : null}

              <TouchableOpacity disabled={isLoading} onPress={handleSendOTP} style={styles.button}>
                <LinearGradient colors={['#f43f5e', '#ec4899']} style={styles.buttonGradient}>
                  {isLoading ? (
                    <View style={styles.loader}>
                      <Ionicons name="refresh" size={20} color="white" style={{ transform: [{ rotate: '360deg' }] }} />
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.buttonText}>Send OTP</Text>
                      <Ionicons name="arrow-forward" size={16} color="white" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            // OTP Step
            <View style={styles.content}>
              <View style={styles.otpHeader}>
                <View style={styles.shieldContainer}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#16a34a" />
                </View>
                <Text style={styles.otpTitle}>Verify OTP</Text>
                <Text style={styles.otpSubtitle}>
                  OTP sent to {countryCode} {formatPhoneDisplay(phoneNumber)}
                </Text>
              </View>

              <View style={styles.otpInputContainer}>
                <Text style={styles.label}>Enter 6-digit OTP</Text>
                <View style={styles.otpInputs}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (otpInputRefs.current[index] = ref)}
                      value={digit}
                      onChangeText={(value) => handleOTPChange(index, value)}
                      onKeyPress={(e) => handleKeyDown(index, e)}
                      style={styles.otpInput}
                      keyboardType="numeric"
                      maxLength={1}
                      textAlign="center"
                    />
                  ))}
                </View>
              </View>

              {error ? (
                <Reanimated.View entering={FadeIn} exiting={FadeOut} style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </Reanimated.View>
              ) : null}

              <TouchableOpacity disabled={isLoading} onPress={handleVerifyOTP} style={styles.button}>
                <LinearGradient colors={['#f43f5e', '#ec4899']} style={styles.buttonGradient}>
                  {isLoading ? (
                    <View style={styles.loader}>
                      <Ionicons name="refresh" size={20} color="white" style={{ transform: [{ rotate: '360deg' }] }} />
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.buttonText}>Verify OTP</Text>
                      <Ionicons name="arrow-forward" size={16} color="white" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.footerActions}>
                <TouchableOpacity
                  onPress={handleResendOTP}
                  disabled={resendTimer > 0}
                  style={styles.actionButton}
                >
                  <Ionicons name="refresh-outline" size={14} color={resendTimer > 0 ? '#9ca3af' : '#f43f5e'} />
                  <Text style={[styles.actionText, resendTimer > 0 && styles.disabledText]}>
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setStep(1);
                    setOtp(['', '', '', '', '', '']);
                    setError('');
                  }}
                  style={styles.actionButton}
                >
                  <Ionicons name="pencil-outline" size={14} color="#6b7280" />
                  <Text style={styles.actionText}>Change Number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Trust Indicators */}
          <View style={styles.trustIndicators}>
            <View style={styles.trustItem}>
              <View style={styles.trustDot} />
              <Text style={styles.trustText}>Secure Login</Text>
            </View>
            <View style={styles.trustItem}>
              <View style={styles.trustDot} />
              <Text style={styles.trustText}>Trusted by 10,000+</Text>
            </View>
          </View>
        </View>
      </Reanimated.View>
      <Toast />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  formContainer: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  decorativeCircleTop: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fecdd3',
    opacity: 0.3,
    transform: [{ scale: 1.5 }],
  },
  decorativeCircleBottom: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fef3c7',
    opacity: 0.4,
    transform: [{ scale: 1.5 }],
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    transform: [{ rotate: '3deg' }],
  },
  iconText: {
    fontSize: 24,
    color: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    paddingBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelIcon: {
    marginRight: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeInput: {
    width: 80,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginRight: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  phoneInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  errorContainer: {
    backgroundColor: '#fef3f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  loader: {
    alignItems: 'center',
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  otpInputContainer: {
    marginBottom: 16,
  },
  otpInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  otpInput: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: 'white',
  },
  footerActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 8,
  },
  disabledText: {
    color: '#9ca3af',
  },
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  trustText: {
    fontSize: 12,
    color: '#6b7280',
  },
});