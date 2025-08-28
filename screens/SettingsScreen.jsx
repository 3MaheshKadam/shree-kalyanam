"use client"

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Platform, Alert, Dimensions } from 'react-native';
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
    <Animated.View style={animatedStyle} className="mr-2">
      <TouchableOpacity
        className={`flex-row items-center px-3 py-2 rounded-xl ${currentView === item.id && !item.action ? 'bg-rose-500' : 'bg-transparent'}`}
        onPress={() => (item.action ? item.action() : setCurrentView(item.id))}
      >
        <Ionicons
          name={item.icon}
          size={20}
          color={currentView === item.id && !item.action ? '#FFF' : '#6B7280'}
          className="mr-2"
        />
        <Text
          className={`text-sm ${currentView === item.id && !item.action ? 'text-white font-semibold' : 'text-gray-500'}`}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Account settings component
const AccountSettings = ({ accountData, setAccountData }) => (
  <Animated.View entering={FadeIn} className="mb-4">
    <View className="bg-white/95 rounded-xl p-4 mb-4 shadow shadow-black/10 border border-rose-100">
      <View className="flex-row items-center mb-3">
        <Ionicons name="call-outline" size={20} color="#F43F5E" />
        <Text className="text-lg font-bold text-gray-900 ml-2">Phone Number</Text>
      </View>
      <TextInput
        className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900"
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
    <Animated.View entering={FadeIn} className="mb-4">
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <Ionicons name="refresh-outline" size={40} color="#F43F5E" className="mb-3 animate-spin" />
          <Text className="text-base text-gray-500">Loading Subscription Plans</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center p-4">
          <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          <Text className="text-lg font-bold text-gray-900 mt-2">Error Loading Plans</Text>
          <Text className="text-sm text-gray-500 text-center mt-1">{error}</Text>
          <TouchableOpacity className="bg-rose-500 px-4 py-3 rounded-lg mt-3" onPress={handleRetry}>
            <Text className="text-white text-sm font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View className={`flex-col ${width > 600 ? 'flex-row flex-wrap' : ''} justify-between gap-4`}>
            {freePlan && (
              <View className="bg-white/95 rounded-xl p-4 mb-4 shadow shadow-black/10 border border-rose-100 relative">
                <LinearGradient
                  colors={getPlanConfig(freePlan.name).color}
                  className="absolute top-0 bottom-0 left-0 right-0 rounded-xl opacity-10"
                />
                <View className="items-center mb-3">
                  <View className={`w-16 h-16 rounded-full justify-center items-center mb-2 ${getPlanConfig(freePlan.name).bgColor}`}>
                    <Ionicons name={getPlanConfig(freePlan.name).icon} size={32} color={getPlanConfig(freePlan.name).textColor} />
                  </View>
                  <Text className="text-xl font-bold text-gray-900">{freePlan.name}</Text>
                  <View className="flex-row items-center">
                    <Text className={`text-2xl font-bold ${getPlanConfig(freePlan.name).textColor}`}>
                      ₹{formatPrice(freePlan.price)}
                    </Text>
                    <Text className="text-sm text-gray-500 ml-1">/forever</Text>
                  </View>
                </View>
                <View className="mb-3">
                  {freePlan.features?.map((feature, idx) => (
                    <View key={idx} className="flex-row items-center mb-2">
                      <Ionicons name="checkmark-circle-outline" size={20} color={getPlanConfig(freePlan.name).textColor} />
                      <Text className="text-sm text-gray-900 ml-2">{feature}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  className="bg-gray-300 px-4 py-3 rounded-lg"
                  disabled
                >
                  <Text className="text-white text-sm font-semibold text-center">
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
                <View key={plan._id} className={`bg-white/95 rounded-xl p-4 mb-4 shadow shadow-black/10 border border-rose-100 relative ${!plan.isActive && 'opacity-70'}`}>
                  <LinearGradient
                    colors={config.color}
                    className="absolute top-0 bottom-0 left-0 right-0 rounded-xl opacity-10"
                  />
                  <View className="items-center mb-3">
                    <View className={`w-16 h-16 rounded-full justify-center items-center mb-2 ${config.bgColor}`}>
                      <Ionicons name={config.icon} size={32} color={config.textColor} />
                    </View>
                    <Text className="text-xl font-bold text-gray-900">{plan.name}</Text>
                    <View className="flex-row items-center">
                      <Text className={`text-2xl font-bold ${config.textColor}`}>
                        ₹{formatPrice(plan.price)}
                      </Text>
                      <Text className="text-sm text-gray-500 ml-1">/{getDurationText(plan.durationInDays)}</Text>
                    </View>
                  </View>
                  <View className="mb-3">
                    {plan.features?.map((feature, idx) => (
                      <View key={idx} className="flex-row items-center mb-2">
                        <Ionicons name="checkmark-circle-outline" size={20} color={config.textColor} />
                        <Text className="text-sm text-gray-900 ml-2">{feature}</Text>
                      </View>
                    ))}
                  </View>
                  <View className="flex-row items-center self-center bg-gray-100 px-2 py-1 rounded-xl mb-3">
                    <View className={`w-2 h-2 rounded-full mr-1 ${plan.isActive ? 'bg-green-600' : 'bg-red-500'}`} />
                    <Text className="text-xs text-gray-900">{plan.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                  <TouchableOpacity
                    className={`px-4 py-3 rounded-lg ${config.badgeColor} ${(isButtonLoading || isCurrentPlan || !plan.isActive) && 'opacity-50'}`}
                    onPress={() => handleSubscription(plan)}
                    disabled={isButtonLoading || isCurrentPlan || !plan.isActive}
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      {isButtonLoading ? 'Processing...' : isCurrentPlan ? '🎉 Currently Active' : 'Subscribe Now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <View className="bg-white/95 rounded-xl p-4 mb-4 shadow shadow-black/10 border border-rose-100">
            <Text className="text-lg font-bold text-gray-900 mb-3">Frequently Asked Questions</Text>
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
              <View key={idx} className="mb-3 pb-3 border-b border-gray-200">
                <Text className="text-sm font-semibold text-gray-900 mb-1">{faq.question}</Text>
                <Text className="text-sm text-gray-500">{faq.answer}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
};

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
      <View className="flex-1 justify-center items-center">
        <Ionicons name="refresh-outline" size={40} color="#F43F5E" className="mb-3 animate-spin" />
        <Text className="text-base text-gray-500">Loading Settings...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <LinearGradient colors={['#F43F5E', '#EC4899']} className="p-5 pt-12 rounded-b-2xl">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <View className="ml-3">
            <Text className="text-2xl font-bold text-white">⚙️ Settings</Text>
            <Text className="text-sm text-rose-100 mt-1">Manage your account preferences and privacy</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <View className="flex-1 px-4">
        <ScrollView horizontal className="bg-white/95 p-3 rounded-xl my-2 border border-gray-200 h-20">
          {navigationItems.map((item) => (
            <NavigationButton
              key={item.id}
              item={item}
              currentView={currentView}
              setCurrentView={setCurrentView}
            />
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 4 }}>
          {renderContent()}
        </ScrollView>
      </View>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <View className="absolute top-0 bottom-0 left-0 right-0 bg-black/50 justify-center items-center p-4">
          <View className="bg-white/95 rounded-xl p-4 w-11/12 max-w-md shadow shadow-black/10">
            <View className="flex-row items-center mb-3">
              <Ionicons name="alert-outline" size={24} color="#EF4444" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Confirm Account Deletion</Text>
            </View>
            <Text className="text-sm text-gray-500 mb-3">
              This action cannot be undone. Type <Text className="font-bold">DELETE</Text> to confirm.
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3 text-sm"
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type DELETE to confirm"
            />
            <View className="flex-row justify-between">
              <TouchableOpacity
                className="flex-1 border border-gray-300 rounded-lg p-3 items-center mr-2"
                onPress={() => setShowDeleteModal(false)}
              >
                <Text className="text-sm text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 bg-red-500 rounded-lg p-3 items-center ${deleteConfirmation !== 'DELETE' && 'opacity-50'}`}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE'}
              >
                <Text className="text-sm text-white font-semibold">Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <View className="absolute top-0 bottom-0 left-0 right-0 bg-black/50 justify-center items-center p-4">
          <View className="bg-white/95 rounded-xl p-4 w-11/12 max-w-md shadow shadow-black/10">
            <View className="flex-row items-center mb-3">
              <Ionicons name="log-out-outline" size={24} color="#F43F5E" />
              <Text className="text-lg font-bold text-gray-900 ml-2">Confirm Logout</Text>
            </View>
            <Text className="text-sm text-gray-500 mb-3">Are you sure you want to log out now?</Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                className="flex-1 border border-gray-300 rounded-lg p-3 items-center mr-2"
                onPress={() => setShowLogoutModal(false)}
              >
                <Text className="text-sm text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-rose-500 rounded-lg p-3 items-center" onPress={handleLogout}>
                <Text className="text-sm text-white font-semibold">Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default SettingsScreen;