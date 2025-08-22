"use client"

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, StyleSheet, Alert, Dimensions } from 'react-native';
import { useSession } from 'context/SessionContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import RazorpayCheckout from 'react-native-razorpay';

const { width } = Dimensions.get('window');

// Custom hook for managing settings data and API calls
const useSettingsData = (user) => {
  const [plans, setPlans] = useState([]);
  const [freePlan, setFreePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [accountData, setAccountData] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [privacyData, setPrivacyData] = useState({
    showToRegisteredOnly: true,
    blurPhotoUntilInterest: false,
    contactDetailsVisibility: 'mutual',
    hideProfileTemporarily: false,
  });
  const [notificationData, setNotificationData] = useState({
    emailInterests: true,
    smsMessages: true,
    pushNotifications: true,
    allNotifications: true,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch subscription plans
      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/subscription');
      if (!response.ok) {
        throw new Error(`Failed to fetch subscription plans: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Fetched subscription plans:', data);

      if (!Array.isArray(data)) {
        throw new Error('Invalid data format: Expected an array of plans');
      }

      const freePlan = data.find(
        (plan) => plan.price === 0 || plan.price === '0' || plan.name?.toLowerCase().includes('free')
      );
      const paidPlans = data.filter((plan) => plan !== freePlan);

      setFreePlan(freePlan || null);
      setPlans(paidPlans);

      // Fetch user subscription
      if (user?.id) {
        const userRes = await fetch(`https://shiv-bandhan-testing.vercel.app/api/users/${user.id}`);
        if (!userRes.ok) {
          throw new Error(`Failed to fetch user data: ${userRes.status} ${userRes.statusText}`);
        }
        const userData = await userRes.json();
        console.log('Fetched user data:', userData);

        if (userData.subscription) {
          setCurrentSubscription({
            subscriptionId: userData.subscription.subscriptionId,
            plan: userData.subscription.plan,
          });
        }

        // Update account data
        setAccountData((prev) => ({
          ...prev,
          email: userData.email || prev.email,
          phone: userData.phone || prev.phone,
        }));
      } else {
        console.warn('User ID not available, skipping user data fetch');
      }

      setIsLoaded(true);
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err.message || 'Something went wrong while fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return {
    plans,
    freePlan,
    loading,
    error,
    currentSubscription,
    setCurrentSubscription,
    isLoaded,
    accountData,
    setAccountData,
    privacyData,
    setPrivacyData,
    notificationData,
    setNotificationData,
    fetchData,
  };
};

// Navigation button component
const NavigationButton = ({ item, currentView, setCurrentView }) => {
  const scale = useSharedValue(currentView === item.id ? 1.05 : 1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 12, stiffness: 150 }) }],
  }));

  useEffect(() => {
    scale.value = currentView === item.id ? 1.05 : 1;
  }, [currentView, item.id]);

  return (
    <Animated.View style={[animatedStyle, styles.navButtonContainer]}>
      <TouchableOpacity
        style={[
          styles.sectionButton,
          currentView === item.id && !item.action && styles.activeSectionButton,
        ]}
        onPress={() => (item.action ? item.action() : setCurrentView(item.id))}
      >
        <Ionicons
          name={item.icon}
          size={20}
          color={currentView === item.id && !item.action ? '#FFF' : '#6B7280'}
          style={styles.navIcon}
        />
        <Text
          style={[
            styles.sectionText,
            currentView === item.id && !item.action && styles.activeSectionText,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Account settings component
const AccountSettings = ({ accountData, setAccountData }) => (
  <Animated.View entering={FadeIn} style={styles.section}>
    <View style={[styles.card, styles.glassCard]}>
      <View style={styles.cardHeader}>
        <Ionicons name="call-outline" size={20} color="#F43F5E" />
        <Text style={styles.cardTitle}>Phone Number</Text>
      </View>
      <TextInput
        style={styles.input}
        value={accountData.phone}
        onChangeText={(text) => setAccountData({ ...accountData, phone: text })}
        placeholder="Enter your phone number"
        keyboardType="phone-pad"
      />
    </View>
  </Animated.View>
);

// Subscription settings component
const SubscriptionSettings = ({ plans, freePlan, loading, error, currentSubscription, setCurrentSubscription, handleSubscription, isSubscribing, activeButtonId, handleRetry, user, navigation }) => {
  const getPlanConfig = (planName) => {
    const configs = {
      Gold: {
        icon: 'ribbon',
        color: ['#FBBF24', '#F59E0B'],
        bgColor: '#FEF3C7',
        textColor: '#B45309',
        badgeColor: '#F59E0B',
        emoji: '👑',
      },
      Premium: {
        icon: 'diamond',
        color: ['#F43F5E', '#EC4899'],
        bgColor: '#FEE2E2',
        textColor: '#BE123C',
        badgeColor: '#F43F5E',
        emoji: '💎',
      },
      Free: {
        icon: 'gift',
        color: ['#D1D5DB', '#9CA3AF'],
        bgColor: '#F3F4F6',
        textColor: '#6B7280',
        badgeColor: '#9CA3AF',
        emoji: '🆓',
      },
    };
    if (!planName) return configs['Premium'];
    if (planName.toLowerCase().includes('gold')) return configs['Gold'];
    if (planName.toLowerCase().includes('premium')) return configs['Premium'];
    if (planName.toLowerCase().includes('free')) return configs['Free'];
    return configs['Premium'];
  };

  const formatPrice = (price) => {
    if (price === 0 || price === '0') return '0';
    return price?.toString()?.replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
  };

  const getDurationText = (duration) => {
    if (duration === 30) return 'month';
    if (duration === 60) return '2 months';
    if (duration === 90) return '3 months';
    if (duration === 180) return '6 months';
    if (duration === 365) return '12 months';
    return `${duration} days`;
  };

  return (
    <Animated.View entering={FadeIn} style={styles.section}>
     
      {loading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="refresh-outline" size={40} color="#F43F5E" style={styles.spinner} />
          <Text style={styles.loadingText}>Loading Subscription Plans</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text style={styles.errorTitle}>Error Loading Plans</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.plansGrid}>
            {freePlan && (
              <View style={[styles.planCard, styles.glassCard]}>
                <LinearGradient
                  colors={getPlanConfig(freePlan.name).color}
                  style={styles.planGradient}
                />
                <View style={styles.planHeader}>
                  <View style={[styles.planIconContainer, { backgroundColor: getPlanConfig(freePlan.name).bgColor }]}>
                    <Ionicons name={getPlanConfig(freePlan.name).icon} size={32} color={getPlanConfig(freePlan.name).textColor} />
                  </View>
                  <Text style={styles.planTitle}>{freePlan.name}</Text>
                  <View style={styles.planPriceContainer}>
                    <Text style={[styles.planPrice, { color: getPlanConfig(freePlan.name).textColor }]}>
                      ₹{formatPrice(freePlan.price)}
                    </Text>
                    <Text style={styles.planDuration}>/forever</Text>
                  </View>
                </View>
                <View style={styles.features}>
                  {freePlan.features?.map((feature, idx) => (
                    <View key={idx} style={styles.feature}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={getPlanConfig(freePlan.name).textColor} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.subscribeButton, { backgroundColor: '#D1D5DB' }]}
                  disabled
                >
                  <Text style={styles.subscribeButtonText}>
                    {currentSubscription?.subscriptionId === freePlan._id ? '🎉 Currently Active' : 'Free Plan'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {plans.map((plan) => {
              const config = getPlanConfig(plan.name);
              const isCurrentPlan = currentSubscription?.subscriptionId === plan._id;
              const isButtonLoading = isSubscribing && activeButtonId === plan._id;

              return (
                <View key={plan._id} style={[styles.planCard, !plan.isActive && styles.disabledCard, styles.glassCard]}>
                  <LinearGradient
                    colors={config.color}
                    style={styles.planGradient}
                  />
                  <View style={styles.planHeader}>
                    <View style={[styles.planIconContainer, { backgroundColor: config.bgColor }]}>
                      <Ionicons name={config.icon} size={32} color={config.textColor} />
                    </View>
                    <Text style={styles.planTitle}>{plan.name}</Text>
                    <View style={styles.planPriceContainer}>
                      <Text style={[styles.planPrice, { color: config.textColor }]}>
                        ₹{formatPrice(plan.price)}
                      </Text>
                      <Text style={styles.planDuration}>/{getDurationText(plan.durationInDays)}</Text>
                    </View>
                  </View>
                  <View style={styles.features}>
                    {plan.features?.map((feature, idx) => (
                      <View key={idx} style={styles.feature}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={config.textColor} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: plan.isActive ? '#15803D' : '#EF4444' }]} />
                    <Text style={styles.statusText}>{plan.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.subscribeButton, { backgroundColor: config.badgeColor }, (isButtonLoading || isCurrentPlan || !plan.isActive) && styles.disabledButton]}
                    onPress={() => handleSubscription(plan)}
                    disabled={isButtonLoading || isCurrentPlan || !plan.isActive}
                  >
                    <Text style={styles.subscribeButtonText}>
                      {isButtonLoading ? 'Processing...' : isCurrentPlan ? '🎉 Currently Active' : 'Subscribe Now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <View style={[styles.card, styles.glassCard]}>
            <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
            {[
              {
                question: 'Can I change my subscription plan?',
                answer: 'Yes! When you subscribe to a new plan, your current subscription will be automatically replaced.',
              },
              {
                question: 'Is my payment information secure?',
                answer: 'Absolutely! We use industry-standard encryption and work with trusted payment providers.',
              },
              {
                question: 'What happens when I change plans?',
                answer: 'Your new plan will take effect immediately, replacing your current subscription.',
              },
            ].map((faq, idx) => (
              <View key={idx} style={styles.faqItem}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
};

// Delete account component

// Main SettingsScreen component
const SettingsScreen = () => {
  const { user, logout } = useSession();
  const navigation = useNavigation();
  const [currentView, setCurrentView] = useState('subscription');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [activeButtonId, setActiveButtonId] = useState(null);

  const {
    plans,
    freePlan,
    loading,
    error,
    currentSubscription,
    setCurrentSubscription,
    isLoaded,
    accountData,
    setAccountData,
    privacyData,
    setPrivacyData,
    notificationData,
    setNotificationData,
    fetchData,
  } = useSettingsData(user);

  // Handle retry for failed API calls
  const handleRetry = async () => {
    setIsSubscribing(false);
    setActiveButtonId(null);
    await fetchData();
  };

  // Handle save settings
  const handleSave = async () => {
    try {
      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          email: accountData.email,
          phone: accountData.phone,
          privacySettings: privacyData,
          notificationSettings: notificationData,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error) {
      Alert.alert('Error', `Failed to save settings: ${error.message}`);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm.');
      return;
    }
    try {
      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, reason: deleteReason }),
      });
      if (!response.ok) throw new Error('Failed to delete account');
      logout();
      navigation.navigate('Login');
      Alert.alert('Success', 'Account deleted successfully.');
    } catch (error) {
      Alert.alert('Error', `Failed to delete account: ${error.message}`);
    }
    setShowDeleteModal(false);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Logout failed');
      logout();
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Error', `Logout failed: ${error.message}`);
    }
    setShowLogoutModal(false);
  };

  // Handle subscription purchase
  const handleSubscription = async (plan) => {
    try {
      setActiveButtonId(plan._id);
      setIsSubscribing(true);

      const res = await fetch('https://shiv-bandhan-testing.vercel.app/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price * 100,
          userId: user?.id,
          planId: plan._id,
          currentSubscriptionId: currentSubscription?.subscriptionId || null,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create order: ${res.status} ${res.statusText}`);
      }

      const order = await res.json();

      const options = {
        key: 'rzp_test_YgehxPKjMam2Wr', // Replace with your Razorpay key
        amount: order.amount,
        currency: order.currency,
        name: 'ShivBandhan Subscription',
        description: plan.name,
        order_id: order.id,
        handler: async (response) => {
          try {
            const updateRes = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/update-plan', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                plan: plan.name,
                razorpay_payment_id: response.razorpay_payment_id,
                planId: plan._id,
                currentSubscriptionId: currentSubscription?.subscriptionId || null,
              }),
            });

            if (updateRes.ok) {
              setCurrentSubscription({ subscriptionId: plan._id, plan: plan.name });
              navigation.navigate('PaymentSuccess');
            } else {
              throw new Error('Failed to update subscription');
            }
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to update subscription');
            navigation.navigate('PaymentFailure');
          }
        },
        prefill: {
          name: user?.name || 'User',
          email: user?.email || 'user@example.com',
          contact: user?.phone || '9999999999',
        },
        theme: { color: '#F43F5E' },
      };

      const razorpay = new RazorpayCheckout(options);
      await razorpay.open();
    } catch (err) {
      console.error('Subscription error:', err);
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setActiveButtonId(null);
      setIsSubscribing(false);
    }
  };

  const navigationItems = [
    { id: 'subscription', label: 'Subscription', icon: 'card' },
    { id: 'log-out', label: 'Log Out', icon: 'log-out', action: () => setShowLogoutModal(true) },
  ];

  const renderContent = () => {
    switch (currentView) {
     
      case 'subscription':
        return (
          <SubscriptionSettings
            plans={plans}
            freePlan={freePlan}
            loading={loading}
            error={error}
            currentSubscription={currentSubscription}
            setCurrentSubscription={setCurrentSubscription}
            handleSubscription={handleSubscription}
            isSubscribing={isSubscribing}
            activeButtonId={activeButtonId}
            handleRetry={handleRetry}
            user={user}
            navigation={navigation}
          />
        );
     
      default:
        return <SubscriptionSettings
            plans={plans}
            freePlan={freePlan}
            loading={loading}
            error={error}
            currentSubscription={currentSubscription}
            setCurrentSubscription={setCurrentSubscription}
            handleSubscription={handleSubscription}
            isSubscribing={isSubscribing}
            activeButtonId={activeButtonId}
            handleRetry={handleRetry}
            user={user}
            navigation={navigation}
          />;
    }
  };

  if (loading && currentView === 'subscription') {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="refresh-outline" size={40} color="#F43F5E" style={styles.spinner} />
        <Text style={styles.loadingText}>Loading Settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#F43F5E', '#EC4899']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>⚙️ Settings</Text>
            <Text style={styles.headerSubtitle}>Manage your account preferences and privacy</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <ScrollView horizontal style={styles.sidebar}>
          {navigationItems.map((item) => (
            <NavigationButton
              key={item.id}
              item={item}
              currentView={currentView}
              setCurrentView={setCurrentView}
            />
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {renderContent()}
        
        </ScrollView>
      </View>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <View style={styles.modalContainer}>
          <View style={[styles.modal, styles.glassCard]}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-outline" size={24} color="#EF4444" />
              <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            </View>
            <Text style={styles.modalText}>
              This action cannot be undone. Type <Text style={styles.bold}>DELETE</Text> to confirm.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type DELETE to confirm"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleteConfirmation !== 'DELETE' && styles.disabledButton,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE'}
              >
                <Text style={styles.modalDeleteButtonText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <View style={styles.modalContainer}>
          <View style={[styles.modal, styles.glassCard]}>
            <View style={styles.modalHeader}>
              <Ionicons name="log-out-outline" size={24} color="#F43F5E" />
              <Text style={styles.modalTitle}>Confirm Logout</Text>
            </View>
            <Text style={styles.modalText}>Are you sure you want to log out now?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalLogoutButton} onPress={handleLogout}>
                <Text style={styles.modalLogoutButtonText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FEE2E2',
    marginLeft: 12,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sidebar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    height:80,
    borderColor: '#E5E7EB',
  },
  navButtonContainer: {
    marginRight: 8,
  },
  sectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  activeSectionButton: {
    backgroundColor: '#F43F5E',
  },
  navIcon: {
    marginRight: 8,
  },
  sectionText: {
    fontSize: width > 600 ? 16 : 14,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  activeSectionText: {
    color: '#FFF',
    fontWeight: '600',
  },
  contentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  section: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  planGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 12,
    opacity: 0.1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  selectIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  dropdown: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    maxHeight: 150,
    marginBottom: 12,
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optionText: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  saveButton: {
    backgroundColor: '#F43F5E',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  deleteButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  modalContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  modalText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  bold: {
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  modalCancelButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalDeleteButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  modalLogoutButton: {
    flex: 1,
    backgroundColor: '#F43F5E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalLogoutButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  disabledButton: {
    opacity: 0.5,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  plansGrid: {
    flexDirection: width > 600 ? 'row' : 'column',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  planCard: {
    width: width > 600 ? '48%' : '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    position: 'relative',
  },
  disabledCard: {
    opacity: 0.7,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  planDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  features: {
    marginBottom: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  subscribeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  faqItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  retryButton: {
    backgroundColor: '#F43F5E',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  alertContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#B91C1C',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  alertText: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
});

export default SettingsScreen;