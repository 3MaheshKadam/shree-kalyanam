"use client";

import { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Modal, SafeAreaView, StatusBar, ScrollView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSession } from 'context/SessionContext';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

const BASE_URL = 'https://shiv-bandhan-testing.vercel.app/';

const InterestsScreen = () => {
  const { user } = useSession();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('received');
  const [sentInterests, setSentInterests] = useState([]);
  const [receivedInterests, setReceivedInterests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    professional: true,
    family: true,
    astrological: false,
    preferences: false,
  });
  const [hasSubscription, setHasSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  const checkSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const res = await fetch(`${BASE_URL}api/users/me`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setHasSubscription(data?.subscription?.isSubscribed || false);
    } catch (err) {
      console.error('InterestsScreen: Error checking subscription:', err);
      setHasSubscription(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const maskFirstName = (fullName) => {
    if (!fullName) return '****';
    const names = fullName.split(' ');
    return names.length > 1 ? `${'*'.repeat(names[0].length)} ${names.slice(1).join(' ')}` : '****';
  };

  const calculateAge = (dateString) => {
    if (!dateString) return 'N/A';
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const fetchInterests = async (type) => {
    try {
      const userId = user?.id || user?.user?.id;
      if (!userId) {
        console.error('InterestsScreen: Missing userId');
        return [];
      }
      const endpoint = type === 'send'
        ? `${BASE_URL}api/interest/send?userId=${userId}`
        : `${BASE_URL}api/interest/received?userId=${userId}`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `Failed to fetch ${type} interests`);
      }
      const data = await response.json();
      return data.interests || [];
    } catch (err) {
      console.error(`InterestsScreen: Error fetching ${type} interests:`, err);
      throw err;
    }
  };

  const loadAllData = async () => {
    if (!user) {
      setError('User not authenticated');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [sent, received] = await Promise.all([
        fetchInterests('send'),
        fetchInterests('received'),
      ]);
      const validSent = sent.filter(item => item?.receiver && item.receiver.name);
      const validReceived = received.filter(item => item?.sender && item.sender.name);
      setSentInterests(validSent);
      setReceivedInterests(validReceived);
    } catch (err) {
      setError(err.message || 'Failed to load interests');
      Toast.show({ type: 'error', text1: 'Failed to load interests', text2: err.message });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkSubscription();
      loadAllData();
    } else {
      setError('User not authenticated');
      setIsLoading(false);
    }
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAllData();
  };

  const handleInterestAction = async (action, interestId) => {
    try {
      const response = await fetch(`${BASE_URL}api/interest/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ status: action, interestId }),
      });
      if (!response.ok) throw new Error('Action failed');
      loadAllData();
      Toast.show({ type: 'success', text1: `Interest ${action}` });
    } catch (err) {
      setError(err.message);
      Toast.show({ type: 'error', text1: 'Action failed', text2: err.message });
    }
  };

  const handleViewProfile = (person, type) => {
    if (!hasSubscription) {
      navigation.navigate('Subscription');
      return;
    }
    const profileData = type === 'sent' ? person?.receiver : person?.sender;
    if (!profileData) {
      Toast.show({ type: 'error', text1: 'Profile data not available' });
      return;
    }
    setSelectedProfile({
      ...profileData,
      image: profileData?.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData?.name || 'User')}&size=250&background=f43f5e&color=fff`,
    });
    setShowModal(true);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getStatusBadge = (status) => {
    const badgeStyles = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'time-outline' },
      accepted: { bg: 'bg-green-100', text: 'text-green-800', icon: 'checkmark-circle-outline' },
      declined: { bg: 'bg-red-100', text: 'text-red-800', icon: 'close-circle-outline' },
    };
    const { bg, text, icon } = badgeStyles[status] || {};
    if (!bg) return null;
    return (
      <View className={`flex-row items-center px-2 py-1 rounded-full ${bg}`}>
        <Ionicons name={icon} size={12} className={`${text} mr-1`} />
        <Text className={`text-xs font-medium ${text}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    );
  };

  const getTabData = () => (activeTab === 'sent' ? sentInterests : receivedInterests);
  const getTabStats = () => ({
    pendingSent: sentInterests?.filter(p => p.status === 'pending').length,
    pendingReceived: receivedInterests?.filter(p => p.status === 'pending').length,
  });

  const stats = getTabStats();

  const renderTabBar = () => (
    <View className="bg-white py-2 border-b border-gray-200">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {[
          { id: 'received', label: 'Received', icon: 'mail-outline', count: receivedInterests.length },
          { id: 'sent', label: 'Sent', icon: 'send-outline', count: sentInterests.length },
        ].map((tab, index) => (
          <Reanimated.View key={tab.id} entering={FadeIn.delay(index * 100).duration(300)}>
            <TouchableOpacity
              className={`py-2.5 px-4 rounded-lg mx-1 ${activeTab === tab.id ? 'bg-rose-100' : ''}`}
              onPress={() => setActiveTab(tab.id)}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={tab.icon}
                  size={16}
                  className={activeTab === tab.id ? 'text-rose-500' : 'text-gray-500'}
                />
                <Text className={`text-sm font-medium ml-1.5 ${activeTab === tab.id ? 'text-rose-500 font-semibold' : 'text-gray-500'}`}>
                  {tab.label} ({tab.count})
                </Text>
              </View>
            </TouchableOpacity>
          </Reanimated.View>
        ))}
      </ScrollView>
    </View>
  );

  const InterestCard = ({ person, type }) => {
    if (!person) return null;
    const profile = type === 'sent' ? person?.receiver : person?.sender;
    if (!profile || !profile.name) return null;
    const profileImage = profile?.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || 'User')}&size=250&background=f43f5e&color=fff`;
    const displayName = profile?.privacySettings?.showname && hasSubscription ? profile?.name : maskFirstName(profile?.name);

    return (
      <Reanimated.View entering={FadeIn.duration(300)} className="mx-4 my-2">
        <View className="bg-white rounded-lg shadow-md border border-gray-100">
          <View className="flex-row p-3">
            <TouchableOpacity
              className={`w-16 h-16 rounded-full overflow-hidden mr-3 ${!hasSubscription && profileImage ? 'opacity-50' : ''}`}
              onPress={() => {
                if (!hasSubscription || !profile?.privacySettings?.showPhoto) {
                  navigation.navigate('Subscription');
                  return;
                }
                profileImage && setExpandedImage(profileImage);
              }}
            >
              <LinearGradient
                colors={['#ff69b4', '#ff1493']}
                className="flex-1 justify-center items-center"
              >
                {profileImage ? (
                  <>
                    <Image
                      source={{ uri: profileImage }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    {(!hasSubscription || !profile?.privacySettings?.showPhoto) && (
                      <View className="absolute inset-0 justify-center items-center bg-black/30">
                        <Ionicons name="lock-closed-outline" size={20} className="text-white" />
                      </View>
                    )}
                  </>
                ) : (
                  <Ionicons name="person-outline" size={24} className="text-white" />
                )}
              </LinearGradient>
              {profile?.lastLoginAt && new Date().getTime() - new Date(profile.lastLoginAt).getTime() < 24 * 60 * 60 * 1000 && (
                <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              )}
            </TouchableOpacity>
            <View className="flex-1">
              <View className="flex-row justify-between items-center mb-1.5">
                <View className="flex-row items-center">
                  <Text className="text-lg font-semibold text-gray-900">{displayName}</Text>
                  {profile?.isVerified && (
                    <Ionicons name="shield-checkmark-outline" size={16} className="text-green-800 ml-1" />
                  )}
                </View>
                {getStatusBadge(person.status)}
              </View>
              <View className="flex-row flex-wrap mb-1 gap-2">
                <Text className="text-xs text-gray-500">
                  <Ionicons name="calendar-outline" size={12} className="text-gray-500" /> {calculateAge(profile?.dob)} years
                </Text>
                {profile?.caste && <Text className="text-xs text-gray-500">{profile?.caste}</Text>}
              </View>
              <View className="flex-row flex-wrap gap-2">
                {profile?.currentCity && (
                  <Text className="text-xs text-gray-500">
                    <Ionicons name="location-outline" size={12} className="text-gray-500" /> {profile?.currentCity}
                  </Text>
                )}
                {(profile?.occupation || profile?.education) && (
                  <Text className="text-xs text-gray-500">
                    <Ionicons name="briefcase-outline" size={12} className="text-gray-500" /> {profile?.occupation || profile?.education || 'Not specified'}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <View className="flex-row justify-between items-center p-3 border-t border-gray-200">
            <Text className="text-xs text-gray-500">
              {type === 'sent' ? `Sent: ${new Date(person.createdAt).toLocaleDateString()}` : `Received: ${new Date(person.createdAt).toLocaleDateString()}`}
            </Text>
            <View className="flex-row flex-wrap justify-end gap-2">
              {type === 'received' && person.status === 'pending' && (
                <>
                  <TouchableOpacity
                    className="flex-row items-center px-3 py-2 rounded-lg bg-red-100"
                    onPress={() => handleInterestAction('declined', person._id)}
                  >
                    <Ionicons name="close-outline" size={16} className="text-red-800 mr-1" />
                    <Text className="text-xs font-semibold text-red-800">Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center px-3 py-2 rounded-lg bg-green-100"
                    onPress={() => handleInterestAction('accepted', person._id)}
                  >
                    <Ionicons name="checkmark-outline" size={16} className="text-green-800 mr-1" />
                    <Text className="text-xs font-semibold text-green-800">Accept</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                className="flex-row items-center px-3 py-2 rounded-lg bg-rose-100"
                onPress={() => handleViewProfile(person, type)}
                disabled={checkingSubscription}
              >
                {checkingSubscription ? (
                  <Ionicons name="refresh-outline" size={16} className="text-rose-500 mr-1 animate-spin" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={16} className="text-rose-500 mr-1" />
                    <Text className="text-xs font-semibold text-rose-500">View Profile</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Reanimated.View>
    );
  };

  const ProfileDetailItem = ({ icon, label, value }) => (
    <Reanimated.View entering={FadeIn.duration(200)} className="flex-row items-center mb-3">
      <MaterialCommunityIcons name={icon} size={20} className="text-rose-500 mr-3" />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{label}</Text>
        <Text className="text-sm text-gray-600">{value || 'Not specified'}</Text>
      </View>
    </Reanimated.View>
  );

  const ProfileSection = ({ title, children, sectionKey }) => (
    <View className="mb-4">
      <TouchableOpacity onPress={() => toggleSection(sectionKey)} className="flex-row justify-between items-center py-2">
        <View className="flex-row items-center gap-2">
          <Ionicons
            name={sectionKey === 'basic' ? 'person-outline' : sectionKey === 'professional' ? 'briefcase-outline' : sectionKey === 'family' ? 'people-outline' : sectionKey === 'astrological' ? 'star-outline' : 'heart-outline'}
            size={20}
            className="text-rose-500"
          />
          <Text className="text-base font-semibold text-gray-900">{title}</Text>
        </View>
        <Ionicons
          name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
          size={20}
          className="text-gray-500"
        />
      </TouchableOpacity>
      {expandedSections[sectionKey] && (
        <Reanimated.View entering={FadeIn.duration(200)} className="bg-gray-50 rounded-lg p-3">
          {children}
        </Reanimated.View>
      )}
    </View>
  );

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
        <View className="flex-1 justify-center items-center">
          <Ionicons name="refresh-outline" size={48} className="text-rose-500 mb-4 animate-spin" />
          <Text className="text-base text-gray-500 font-medium">Loading your Interests</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
        <View className="flex-1 justify-center items-center p-4">
          <View className="w-16 h-16 bg-red-100 rounded-full justify-center items-center mb-4">
            <Ionicons name="close-circle-outline" size={48} className="text-red-800" />
          </View>
          <Text className="text-lg font-bold text-gray-900 mb-2">Error loading interests</Text>
          <Text className="text-sm text-gray-500 text-center mb-4">{error}</Text>
          <TouchableOpacity className="bg-rose-500 rounded-lg py-3 px-6" onPress={handleRefresh}>
            <Text className="text-sm font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 p-1 mt-8 " >
      <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
      <LinearGradient colors={['#ff69b4', '#ff1493']} className={`pt-[${Platform.OS === 'ios' ? 10 : StatusBar.currentHeight + 10}] px-4 pb-4`}>
        <View className="flex-row justify-between items-center flex-wrap">
          <View className="flex-1 min-w-[150px]">
            <Text className="text-3xl font-bold text-white font-[Helvetica Neue, Roboto]">💌 Interests</Text>
            <Text className="text-sm text-white font-normal">Connect with your potential matches</Text>
          </View>
          <View className="flex-row items-center mx-2">
            <View className="items-center ml-3">
              <Text className="text-xs text-white font-medium">Pending Received</Text>
              <Text className="text-base font-bold text-white">{stats.pendingReceived || 0}</Text>
            </View>
            <View className="items-center ml-3">
              <Text className="text-xs text-white font-medium">Pending Sent</Text>
              <Text className="text-base font-bold text-white">{stats.pendingSent || 0}</Text>
            </View>
          </View>
          <TouchableOpacity className="p-2 bg-white/20 rounded-lg" onPress={handleRefresh} disabled={isRefreshing}>
            <Ionicons
              name="refresh-outline"
              size={24}
              className={isRefreshing ? 'text-gray-300 animate-spin' : 'text-white'}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      {renderTabBar()}
      <FlatList
        data={getTabData()}
        renderItem={({ item }) => <InterestCard person={item} type={activeTab} />}
        keyExtractor={(item, index) => item._id || `interest-${index}`}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Reanimated.View entering={FadeIn.duration(300)} className="items-center p-8 min-h-[400px]">
            <View className="w-16 h-16 bg-rose-100 rounded-full justify-center items-center mb-4">
              <Ionicons name="heart-outline" size={48} className="text-rose-500" />
            </View>
            <Text className="text-lg font-bold text-gray-900 mb-2">
              {activeTab === 'sent' ? 'No Interests Sent Yet' : 'No Interests Received Yet'}
            </Text>
            <Text className="text-sm text-gray-500 text-center">
              {activeTab === 'sent'
                ? 'Start browsing profiles and express your interest!'
                : 'Your perfect match might be just around the corner!'}
            </Text>
          </Reanimated.View>
        }
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        className="flex-1"
      />
      <Modal
        visible={showModal && !!selectedProfile}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-50">
          <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
          <LinearGradient colors={['#ff69b4', '#ff1493']} className="flex-row justify-between items-center px-4 py-3">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close-outline" size={28} className="text-white" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-white">{selectedProfile?.name}&apos;s Profile</Text>
            <TouchableOpacity>
              <Ionicons name="share-outline" size={28} className="text-white" />
            </TouchableOpacity>
          </LinearGradient>
          <ScrollView className="flex-1">
            <View className="relative">
              <Image
                source={{ uri: selectedProfile?.image }}
                className="w-full h-72"
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                className="absolute bottom-0 left-0 right-0 h-32 p-4 justify-end"
              >
                <Text className="text-2xl font-bold text-white mb-1">{selectedProfile?.name}</Text>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={16} className="text-white" />
                  <Text className="text-sm text-white">{calculateAge(selectedProfile?.dob)} years</Text>
                  <Ionicons name="location-outline" size={16} className="text-white ml-3" />
                  <Text className="text-sm text-white">{selectedProfile?.currentCity || 'N/A'}</Text>
                </View>
              </LinearGradient>
            </View>
            <View className="p-4 bg-white rounded-t-3xl -mt-6">
              <ProfileSection title="Basic Information" sectionKey="basic">
                <ProfileDetailItem icon="human-male-height" label="Height" value={selectedProfile?.height} />
                <ProfileDetailItem icon="account-outline" label="Gender" value={selectedProfile?.gender} />
                <ProfileDetailItem icon="church" label="Religion" value={selectedProfile?.religion} />
                <ProfileDetailItem icon="account-group-outline" label="Caste" value={selectedProfile?.caste} />
                <ProfileDetailItem icon="heart-outline" label="Marital Status" value={selectedProfile?.maritalStatus} />
                <ProfileDetailItem icon="palette-outline" label="Complexion" value={selectedProfile?.complexion} />
                <ProfileDetailItem icon="weight" label="Weight" value={selectedProfile?.weight} />
              </ProfileSection>
              <ProfileSection title="Family Details" sectionKey="family">
                <ProfileDetailItem icon="account-outline" label="Father's Name" value={selectedProfile?.fatherName} />
                <ProfileDetailItem icon="account-outline" label="Mother's Name" value={selectedProfile?.mother} />
                <ProfileDetailItem icon="account-multiple-outline" label="Siblings" value={`${selectedProfile?.brothers || 0} Brothers, ${selectedProfile?.sisters || 0} Sisters`} />
                <ProfileDetailItem icon="home-outline" label="Native City" value={selectedProfile?.nativeCity} />
                <ProfileDetailItem icon="cash-outline" label="Family Wealth" value={selectedProfile?.familyWealth} />
              </ProfileSection>
              <ProfileSection title="Professional Information" sectionKey="professional">
                <ProfileDetailItem icon="briefcase-outline" label="Occupation" value={selectedProfile?.occupation} />
                <ProfileDetailItem icon="school-outline" label="Education" value={selectedProfile?.education} />
                <ProfileDetailItem icon="currency-inr" label="Income" value={selectedProfile?.income} />
                <ProfileDetailItem icon="office-building-outline" label="Company" value={selectedProfile?.company} />
              </ProfileSection>
              <ProfileSection title="Astrological Details" sectionKey="astrological">
                <ProfileDetailItem icon="zodiac-leo" label="Zodiac Sign" value={selectedProfile?.rashi} />
                <ProfileDetailItem icon="star-outline" label="Manglik" value={selectedProfile?.mangal ? 'Yes' : 'No'} />
                <ProfileDetailItem icon="star-outline" label="Nakshatra" value={selectedProfile?.nakshira} />
                <ProfileDetailItem icon="star-outline" label="Gothra" value={selectedProfile?.gothra} />
              </ProfileSection>
              <ProfileSection title="Preferences" sectionKey="preferences">
                <ProfileDetailItem icon="heart-outline" label="Expected Caste" value={selectedProfile?.expectedCaste} />
                <ProfileDetailItem icon="school-outline" label="Expected Education" value={selectedProfile?.expectedEducation} />
                <ProfileDetailItem icon="human-male-height" label="Expected Height" value={selectedProfile?.expectedHeight} />
                <ProfileDetailItem icon="currency-inr" label="Expected Income" value={selectedProfile?.expectedIncome} />
              </ProfileSection>
              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  className="flex-1 bg-rose-500 rounded-lg p-3 flex-row justify-center items-center"
                  onPress={() => handleInterestAction('accepted', selectedProfile?._id)}
                >
                  <Ionicons name="heart" size={20} className="text-white mr-2" />
                  <Text className="text-sm font-semibold text-white">Send Interest</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-blue-500 rounded-lg p-3 flex-row justify-center items-center">
                  <Ionicons name="chatbubble" size={20} className="text-white mr-2" />
                  <Text className="text-sm font-semibold text-white">Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!expandedImage}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setExpandedImage(null)}
      >
        <View className="flex-1 bg-black/30 justify-center">
          <LinearGradient colors={['#ff69b4', '#ff1493']} className="px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Ionicons name="heart-outline" size={20} className="text-white mr-2" />
              <Text className="text-base font-semibold text-white flex-1">Profile Picture</Text>
              <TouchableOpacity onPress={() => setExpandedImage(null)}>
                <Ionicons name="close-outline" size={20} className="text-white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          <View className="flex-1 justify-center items-center p-4">
            <Image
              source={{ uri: expandedImage }}
              className="w-full h-[80%] rounded-lg"
              resizeMode="contain"
            />
          </View>
          <LinearGradient colors={['#ff69b4', '#ff1493']} className="py-3 items-center">
            <Text className="text-sm font-medium text-white">Shivbandhan Matrimony</Text>
          </LinearGradient>
        </View>
      </Modal>
      <Toast />
    </SafeAreaView>
  );
};

export default InterestsScreen;