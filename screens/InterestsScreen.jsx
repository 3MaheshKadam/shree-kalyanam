"use client";

import { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Modal, SafeAreaView, StatusBar, StyleSheet, ScrollView, Platform } from 'react-native';
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
      pending: { backgroundColor: '#fef3c7', color: '#b45309', icon: 'time-outline' },
      accepted: { backgroundColor: '#dcfce7', color: '#15803d', icon: 'checkmark-circle-outline' },
      declined: { backgroundColor: '#fee2e2', color: '#b91c1c', icon: 'close-circle-outline' },
    };
    const { backgroundColor, color, icon } = badgeStyles[status] || {};
    if (!backgroundColor) return null;
    return (
      <View style={[styles.badge, { backgroundColor }]}>
        <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} />
        <Text style={[styles.badgeText, { color }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
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
    <View style={styles.tabBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
        {[
          { id: 'received', label: 'Received', icon: 'mail-outline', count: receivedInterests.length },
          { id: 'sent', label: 'Sent', icon: 'send-outline', count: sentInterests.length },
        ].map((tab, index) => (
          <Reanimated.View key={tab.id} entering={FadeIn.delay(index * 100).duration(300)}>
            <TouchableOpacity
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.id ? '#ec4899' : '#6b7280'}
                />
                <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
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
      <Reanimated.View entering={FadeIn.duration(300)} style={styles.cardContainer}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TouchableOpacity
              style={[styles.profileImageContainer, !hasSubscription && profileImage && styles.blurredImage]}
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
                style={styles.profileImageGradient}
              >
                {profileImage ? (
                  <>
                    <Image
                      source={{ uri: profileImage }}
                      style={styles.profileImage}
                      resizeMode="cover"
                    />
                    {(!hasSubscription || !profile?.privacySettings?.showPhoto) && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                      </View>
                    )}
                  </>
                ) : (
                  <Ionicons name="person-outline" size={24} color="#fff" />
                )}
              </LinearGradient>
              {profile?.lastLoginAt && new Date().getTime() - new Date(profile.lastLoginAt).getTime() < 24 * 60 * 60 * 1000 && (
                <View style={styles.onlineIndicator} />
              )}
            </TouchableOpacity>
            <View style={styles.cardContent}>
              <View style={styles.cardTitleRow}>
                <View style={styles.cardTitle}>
                  <Text style={styles.nameText}>{displayName}</Text>
                  {profile?.isVerified && (
                    <Ionicons name="shield-checkmark-outline" size={16} color="#15803d" style={{ marginLeft: 4 }} />
                  )}
                </View>
                {getStatusBadge(person.status)}
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>
                  <Ionicons name="calendar-outline" size={12} color="#6b7280" /> {calculateAge(profile?.dob)} years
                </Text>
                {profile?.caste && <Text style={styles.infoText}>{profile?.caste}</Text>}
              </View>
              <View style={styles.infoRow}>
                {profile?.currentCity && (
                  <Text style={styles.infoText}>
                    <Ionicons name="location-outline" size={12} color="#6b7280" /> {profile?.currentCity}
                  </Text>
                )}
                {(profile?.occupation || profile?.education) && (
                  <Text style={styles.infoText}>
                    <Ionicons name="briefcase-outline" size={12} color="#6b7280" /> {profile?.occupation || profile?.education || 'Not specified'}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.timestampText}>
              {type === 'sent' ? `Sent: ${new Date(person.createdAt).toLocaleDateString()}` : `Received: ${new Date(person.createdAt).toLocaleDateString()}`}
            </Text>
            <View style={styles.actionButtons}>
              {type === 'received' && person.status === 'pending' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
                    onPress={() => handleInterestAction('declined', person._id)}
                  >
                    <Ionicons name="close-outline" size={16} color="#b91c1c" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionButtonText, { color: '#b91c1c' }]}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#dcfce7' }]}
                    onPress={() => handleInterestAction('accepted', person._id)}
                  >
                    <Ionicons name="checkmark-outline" size={16} color="#15803d" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionButtonText, { color: '#15803d' }]}>Accept</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#ffe4e6' }]}
                onPress={() => handleViewProfile(person, type)}
                disabled={checkingSubscription}
              >
                {checkingSubscription ? (
                  <Ionicons name="refresh-outline" size={16} color="#ff1493" style={{ marginRight: 4 }} className="animate-spin" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={16} color="#ff1493" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionButtonText, { color: '#ff1493' }]}>View Profile</Text>
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
    <Reanimated.View entering={FadeIn.duration(200)} style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={20} color="#ff1493" style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || 'Not specified'}</Text>
      </View>
    </Reanimated.View>
  );

  const ProfileSection = ({ title, children, sectionKey }) => (
    <View style={styles.sectionContainer}>
      <TouchableOpacity onPress={() => toggleSection(sectionKey)} style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons name={sectionKey === 'basic' ? 'person-outline' : sectionKey === 'professional' ? 'briefcase-outline' : sectionKey === 'family' ? 'people-outline' : sectionKey === 'astrological' ? 'star-outline' : 'heart-outline'} size={20} color="#ff1493" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons
          name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6b7280"
        />
      </TouchableOpacity>
      {expandedSections[sectionKey] && (
        <Reanimated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
          {children}
        </Reanimated.View>
      )}
    </View>
  );

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
        <View style={styles.loadingContainer}>
          <Ionicons name="refresh-outline" size={48} color="#ff1493" style={{ marginBottom: 16 }} className="animate-spin" />
          <Text style={styles.loadingText}>Loading your Interests</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="close-circle-outline" size={48} color="#b91c1c" />
          </View>
          <Text style={styles.errorTitle}>Error loading interests</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
      <LinearGradient colors={['#ff69b4', '#ff1493']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerText}>💌 Interests</Text>
            <Text style={styles.headerSubText}>Connect with your potential matches</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending Received</Text>
              <Text style={styles.statValue}>{stats.pendingReceived || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pending Sent</Text>
              <Text style={styles.statValue}>{stats.pendingSent || 0}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
            <Ionicons
              name="refresh-outline"
              size={24}
              color={isRefreshing ? '#d1d5db' : '#fff'}
              style={isRefreshing && styles.refreshIcon}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      {renderTabBar()}
      <FlatList
        data={getTabData()}
        renderItem={({ item }) => <InterestCard person={item} type={activeTab} />}
        keyExtractor={(item, index) => item._id || `interest-${index}`}
        contentContainerStyle={styles.flatListContent}
        ListEmptyComponent={
          <Reanimated.View entering={FadeIn.duration(300)} style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="heart-outline" size={48} color="#ff1493" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'sent' ? 'No Interests Sent Yet' : 'No Interests Received Yet'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'sent'
                ? 'Start browsing profiles and express your interest!'
                : 'Your perfect match might be just around the corner!'}
            </Text>
          </Reanimated.View>
        }
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        style={styles.flatListStyle}
      />
      <Modal
        visible={showModal && !!selectedProfile}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#ff69b4" />
          <LinearGradient colors={['#ff69b4', '#ff1493']} style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close-outline" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedProfile?.name}&apos;s Profile</Text>
            <TouchableOpacity>
              <Ionicons name="share-outline" size={28} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalProfileHeader}>
              <Image
                source={{ uri: selectedProfile?.image }}
                style={styles.modalProfileImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.modalProfileGradient}
              >
                <Text style={styles.modalNameText}>{selectedProfile?.name}</Text>
                <View style={styles.modalInfoContainer}>
                  <Ionicons name="calendar-outline" size={16} color="#fff" />
                  <Text style={styles.modalInfoText}>{calculateAge(selectedProfile?.dob)} years</Text>
                  <Ionicons name="location-outline" size={16} color="#fff" style={{ marginLeft: 12 }} />
                  <Text style={styles.modalInfoText}>{selectedProfile?.currentCity || 'N/A'}</Text>
                </View>
              </LinearGradient>
            </View>
            <View style={styles.modalDetailsContainer}>
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
              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.modalActionButton}
                  onPress={() => handleInterestAction('accepted', selectedProfile?._id)}
                >
                  <Ionicons name="heart" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.modalActionButtonText}>Send Interest</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalActionButton, { backgroundColor: '#3b82f6' }]}>
                  <Ionicons name="chatbubble" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.modalActionButtonText}>Chat</Text>
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
        <View style={styles.imageViewerContainer}>
          <LinearGradient colors={['#ff69b4', '#ff1493']} style={styles.imageViewerHeader}>
            <View style={styles.imageViewerHeaderContent}>
              <Ionicons name="heart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.imageViewerTitle}>Profile Picture</Text>
              <TouchableOpacity onPress={() => setExpandedImage(null)}>
                <Ionicons name="close-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          <View style={styles.imageViewerContent}>
            <Image
              source={{ uri: expandedImage }}
              style={styles.expandedImage}
              resizeMode="contain"
            />
          </View>
          <LinearGradient colors={['#ff69b4', '#ff1493']} style={styles.imageViewerFooter}>
            <Text style={styles.imageViewerFooterText}>Shivbandhan Matrimony</Text>
          </LinearGradient>
        </View>
      </Modal>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight + 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 150,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  headerSubText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '400',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  refreshIcon: {
    transform: [{ rotate: '360deg' }],
  },
  tabBar: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#ffe4e6',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ff1493',
    fontWeight: '600',
  },
  cardContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  profileImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginRight: 12,
  },
  profileImageGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  blurredImage: {
    opacity: 0.5,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    backgroundColor: '#22c55e',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timestampText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#fee2e2',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#ff1493',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#ffe4e6',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalContent: {
    flex: 1,
  },
  modalProfileHeader: {
    position: 'relative',
  },
  modalProfileImage: {
    width: '100%',
    height: 280,
  },
  modalProfileGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    padding: 16,
    justifyContent: 'flex-end',
  },
  modalNameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  modalInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#fff',
  },
  modalDetailsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionContent: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  detailValue: {
    fontSize: 14,
    color: '#4b5563',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalActionButton: {
    flex: 1,
    backgroundColor: '#ff1493',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
  },
  imageViewerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  imageViewerHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageViewerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  imageViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  expandedImage: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
  imageViewerFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  imageViewerFooterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  flatListStyle: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 100,
  },
});

export default InterestsScreen;