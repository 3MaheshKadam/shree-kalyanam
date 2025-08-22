"use client";

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
  Animated,
  TextInput,
  Dimensions,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSession } from "context/SessionContext";
import Toast from "react-native-toast-message";
import Reanimated, { FadeIn, SlideInUp, SlideInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
const { width } = Dimensions.get("window");
import "../global.css";
const BASE_URL = "https://shiv-bandhan-testing.vercel.app/";

const MatchesScreen = () => {
  const { user } = useSession();
  const navigation = useNavigation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [hasSubscription, setHasSubscription] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilters, setQuickFilters] = useState({
    withPhoto: null,
    verified: null,
    activeRecently: null,
    sameCity: null,
    ageRange: [null, null],
    education: null,
  });
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    professional: true,
    family: true,
    astrological: false,
    preferences: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    const initialize = async () => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true })
      ]).start();
      setIsLoaded(true);
      await checkSubscription();
      await fetchUsers(1);
    };
    initialize();
  }, [user]);

  const checkSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const res = await fetch(`${BASE_URL}api/users/me`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) {
        console.error("MatchesScreen: Subscription check failed with status:", res.status);
        throw new Error("Failed to fetch subscription");
      }
      const data = await res.json();
      setHasSubscription(data?.subscription?.isSubscribed || false);
    } catch (err) {
      console.error("MatchesScreen: Error checking subscription:", err);
      setHasSubscription(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const ageDiff = Date.now() - birthDate.getTime();
    return Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const calculateCompatibility = (userProfile, matchProfile) => {
    const expectationFields = [
      { expectation: "expectedCaste", matchField: "caste" },
      { expectation: "preferredCity", matchField: "currentCity" },
      { expectation: "expectedEducation", matchField: "education" },
      { expectation: "expectedAgeDifference", matchField: "age" },
    ];
    const totalFields = expectationFields.length;
    const percentagePerField = 100 / totalFields;
    let matchedPercentage = 0;

    expectationFields.forEach(({ expectation, matchField }) => {
      const expectedValue = userProfile[expectation];
      const matchValue = matchProfile[matchField];
      if (!expectedValue || !matchValue) return;

      if (expectation === "expectedEducation") {
        const educationHierarchy = ["Doctorate", "Master's Degree", "Bachelor's Degree", "High School"];
        const expectedIndex = educationHierarchy.indexOf(expectedValue);
        const matchIndex = educationHierarchy.indexOf(matchValue);
        if (expectedIndex !== -1 && matchIndex !== -1) {
          matchedPercentage += matchIndex <= expectedIndex ? percentagePerField : percentagePerField / 2;
        }
      } else if (expectation === "expectedAgeDifference") {
        const userAge = calculateAge(userProfile.dob);
        const matchAge = matchProfile.age;
        const ageDiff = Math.abs(userAge - matchAge);
        if (
          (expectedValue === "1" && ageDiff <= 1) ||
          (expectedValue === "2" && ageDiff <= 2) ||
          (expectedValue === "3" && ageDiff <= 3) ||
          (expectedValue === "5" && ageDiff <= 5) ||
          (expectedValue === "6+" && ageDiff >= 6)
        ) {
          matchedPercentage += percentagePerField;
        }
      } else if (expectedValue === matchValue) {
        matchedPercentage += percentagePerField;
      }
    });

    return Math.min(100, Math.round(matchedPercentage));
  };

  const isSameCity = (city1, city2) => {
    if (!city1 || !city2) return false;
    return city1.toLowerCase() === city2.toLowerCase();
  };

  const maskFirstName = (fullName) => {
    if (!fullName) return "****";
    const names = fullName.split(" ");
    return names.length > 1 ? `${"*".repeat(names[0].length)} ${names.slice(1).join(" ")}` : "****";
  };

  const fetchSentInterests = async (senderId) => {
    try {
      const res = await fetch(`${BASE_URL}api/interest?userId=${senderId}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) {
        console.error(`MatchesScreen: Fetch sent interests failed with status ${res.status}`);
        return [];
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("MatchesScreen: Invalid content-type:", contentType);
        return [];
      }
      const data = await res.json();
      if (data.success) {
        return data.interests.map((i) => i.receiver.id);
      }
      return [];
    } catch (err) {
      console.error("MatchesScreen: Error fetching sent interests:", err.message);
      return [];
    }
  };

  const fetchUsers = async (pageNum = 1, isRefresh = false) => {
    setIsLoading(pageNum === 1);
    try {
      const currentUserRes = await fetch(`${BASE_URL}api/users/me`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!currentUserRes.ok) {
        console.error("MatchesScreen: Fetch current user failed with status:", currentUserRes.status);
        throw new Error("Failed to fetch current user");
      }
      const currentUserData = await currentUserRes.json();
      const sentReceiverIds = await fetchSentInterests(currentUserData._id);

      const res = await fetch(`${BASE_URL}api/users/fetchAllUsers?limit=20&page=${pageNum}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (!res.ok) {
        console.error("MatchesScreen: Fetch users failed with status:", res.status);
        throw new Error("Failed to fetch users");
      }
      const data = await res.json();

      if (data.success) {
        const enriched = data.data
          .filter(
            (matchUser) =>
              matchUser._id !== currentUserData.id &&
              matchUser.gender !== currentUserData.gender &&
              matchUser.dob &&
              matchUser.currentCity &&
              matchUser.education
          )
          .map((matchUser) => {
            const compatibility = calculateCompatibility(currentUserData, {
              ...matchUser,
              age: calculateAge(matchUser.dob),
            });
            return {
              ...matchUser,
              age: calculateAge(matchUser.dob),
              profilePhoto:
                matchUser.profilePhoto ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  matchUser.name || "User"
                )}&size=200&background=f3f4f6&color=374151`,
              hasPhoto: !!matchUser.profilePhoto,
              isBlurred: !hasSubscription,
              matchType: "all",
              interestSent: sentReceiverIds.includes(matchUser._id),
              compatibility,
              bio: matchUser.bio || "Looking for a meaningful connection.",
              isNew: Math.random() > 0.7,
              lastActive: ["Recently", "Today", "1 day ago"][Math.floor(Math.random() * 3)],
              shortlisted: false,
            };
          });
        setMatches((prev) => (isRefresh || pageNum === 1 ? enriched : [...prev, ...enriched]));
        if (enriched.length > 0) setPage(pageNum);
      }
    } catch (err) {
      console.error("MatchesScreen: Failed to fetch matches:", err.message);
      Toast.show({ type: "error", text1: "Failed to load matches" });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers(1, true);
  };

  const loadMore = () => {
    if (!isLoading) fetchUsers(page + 1);
  };

  const tabs = [
    { id: "all", label: "All", count: matches.filter((m) => m.compatibility > 0).length, icon: "grid-outline", color: "#D32F2F" },
    { id: "preferred", label: "Premium", count: matches.filter((m) => m.compatibility >= 70).length, icon: "star", color: "#FFD700" },
    { id: "new", label: "New", count: matches.filter((m) => m.isNew).length, icon: "flash", color: "#00D4AA" },
    {
      id: "nearby",
      label: "Nearby",
      count: matches.filter((m) => isSameCity(m.currentCity, user?.currentCity)).length,
      icon: "location",
      color: "#8B5CF6"
    },
  ];

  const filteredMatches = matches
    .filter((match) => {
      if (match.compatibility <= 0) return false;
      let shouldShow = true;
      if (searchQuery) {
        shouldShow = shouldShow && match.currentCity?.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (activeTab !== "all") {
        if (activeTab === "preferred" && match.compatibility < 70) return false;
        if (activeTab === "new" && !match.isNew) return false;
        if (activeTab === "nearby" && !isSameCity(match.currentCity, user?.currentCity)) return false;
      }
      if (quickFilters.withPhoto !== null) shouldShow = shouldShow && quickFilters.withPhoto === !!match.hasPhoto;
      if (quickFilters.verified !== null) shouldShow = shouldShow && quickFilters.verified === !!match.isVerified;
      if (quickFilters.activeRecently !== null)
        shouldShow = shouldShow && quickFilters.activeRecently !== match.lastActive.includes("day");
      if (quickFilters.sameCity !== null)
        shouldShow = shouldShow && quickFilters.sameCity === isSameCity(match.currentCity, user?.currentCity);
      if (quickFilters.ageRange[0] !== null && quickFilters.ageRange[1] !== null) {
        shouldShow = shouldShow && match.age >= quickFilters.ageRange[0] && match.age <= quickFilters.ageRange[1];
      }
      if (quickFilters.education) shouldShow = shouldShow && match.education === quickFilters.education;
      return shouldShow;
    })
    .sort((a, b) => b.compatibility - a.compatibility);

  const handleSendInterest = async (receiverId) => {
    const senderId = user?.id || user?.user?.id;
    if (senderId === receiverId) {
      Toast.show({ type: "error", text1: "Can't send interest to yourself" });
      return;
    }
    if (!hasSubscription) {
      navigation.navigate("Subscription");
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}api/interest/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ senderId, receiverId }),
      });
      if (!res.ok) {
        console.error("MatchesScreen: Send interest failed with status:", res.status);
        throw new Error("Failed to send interest");
      }
      const data = await res.json();
      if (res.ok) {
        setMatches(matches.map((m) => (m._id === receiverId ? { ...m, interestSent: true } : m)));
        Toast.show({ type: "success", text1: "Interest sent successfully!" });
      } else {
        Toast.show({ type: "error", text1: data.message || "Failed to send interest" });
      }
    } catch (error) {
      console.error("MatchesScreen: Error sending interest:", error.message);
      Toast.show({ type: "error", text1: "Error sending interest" });
    }
  };

  const toggleShortlist = (matchId) => {
    setMatches(matches.map((m) => (m._id === matchId ? { ...m, shortlisted: !m.shortlisted } : m)));
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getCompatibilityColor = (percentage) => {
    if (percentage >= 85) return ["#D32F2F", "#B71C1C"];
    if (percentage >= 70) return ["#FDCB6E", "#E17055"];
    return ["#74B9FF", "#0984E3"];
  };

  const renderTabBar = () => (
    <View style={{ backgroundColor: '#FFFFFF' }} className="shadow-md">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        <View className="flex-row gap-2">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <Reanimated.View key={tab.id} entering={FadeIn.delay(index * 100).duration(300)}>
                <TouchableOpacity
                  style={{
                    backgroundColor: isActive ? tab.color : '#F5F6F5',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderWidth: isActive ? 0 : 1,
                    borderColor: '#E5E7EB',
                    elevation: isActive ? 4 : 0,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isActive ? 0.2 : 0,
                    shadowRadius: 4,
                    shadowColor: tab.color,
                  }}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <View className="flex-row items-center gap-1">
                    <Ionicons 
                      name={tab.icon} 
                      size={16} 
                      color={isActive ? '#FFFFFF' : '#4B5563'} 
                    />
                    <Text style={{ 
                      color: isActive ? '#FFFFFF' : '#4B5563',
                      fontSize: 12,
                      fontWeight: '600'
                    }}>
                      {tab.label}
                    </Text>
                    <View style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#E5E7EB',
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      minWidth: 20,
                    }}>
                      <Text style={{ 
                        color: isActive ? '#FFFFFF' : '#4B5563',
                        fontSize: 10,
                        fontWeight: '700',
                        textAlign: 'center'
                      }}>
                        {tab.count}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </Reanimated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderQuickFilters = () => (
    <Modal visible={showQuickFilters} animationType="slide" transparent={true} onRequestClose={() => setShowQuickFilters(false)}>
      <View className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity 
          className="flex-1" 
          onPress={() => setShowQuickFilters(false)}
        />
        <Reanimated.View
          entering={SlideInUp.duration(300)}
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
          }}
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <View style={{ width: 32, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
            <View className="flex-row justify-between items-center">
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1F2A44' }}>Filters</Text>
              <TouchableOpacity 
                style={{ 
                  backgroundColor: '#F5F6F5', 
                  borderRadius: 16, 
                  padding: 6 
                }}
                onPress={() => setShowQuickFilters(false)}
              >
                <Ionicons name="close" size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 16 }}>
            <View style={{ gap: 16 }}>
              {/* Photo Preference */}
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2A44', marginBottom: 8 }}>Photo Preference</Text>
                <TouchableOpacity
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: quickFilters.withPhoto ? '#D32F2F' : '#F5F6F5',
                    borderWidth: 1,
                    borderColor: quickFilters.withPhoto ? '#D32F2F' : '#D1D5DB',
                  }}
                  onPress={() => setQuickFilters({ ...quickFilters, withPhoto: !quickFilters.withPhoto })}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons 
                      name="camera" 
                      size={16} 
                      color={quickFilters.withPhoto ? '#FFFFFF' : '#4B5563'} 
                    />
                    <Text style={{ 
                      color: quickFilters.withPhoto ? '#FFFFFF' : '#1F2A44',
                      fontSize: 14,
                      fontWeight: '500'
                    }}>
                      With Photo Only
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              
              {/* Verification */}
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2A44', marginBottom: 8 }}>Verification</Text>
                <TouchableOpacity
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: quickFilters.verified ? '#D32F2F' : '#F5F6F5',
                    borderWidth: 1,
                    borderColor: quickFilters.verified ? '#D32F2F' : '#D1D5DB',
                  }}
                  onPress={() => setQuickFilters({ ...quickFilters, verified: !quickFilters.verified })}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons 
                      name="checkmark-circle" 
                      size={16} 
                      color={quickFilters.verified ? '#FFFFFF' : '#4B5563'} 
                    />
                    <Text style={{ 
                      color: quickFilters.verified ? '#FFFFFF' : '#1F2A44',
                      fontSize: 14,
                      fontWeight: '500'
                    }}>
                      Verified Profiles Only
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Activity Status */}
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2A44', marginBottom: 8 }}>Activity Status</Text>
                <TouchableOpacity
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: quickFilters.activeRecently ? '#D32F2F' : '#F5F6F5',
                    borderWidth: 1,
                    borderColor: quickFilters.activeRecently ? '#D32F2F' : '#D1D5DB',
                  }}
                  onPress={() => setQuickFilters({ ...quickFilters, activeRecently: !quickFilters.activeRecently })}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons 
                      name="radio-button-on" 
                      size={16} 
                      color={quickFilters.activeRecently ? '#FFFFFF' : '#4B5563'} 
                    />
                    <Text style={{ 
                      color: quickFilters.activeRecently ? '#FFFFFF' : '#1F2A44',
                      fontSize: 14,
                      fontWeight: '500'
                    }}>
                      Recently Active
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Location */}
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2A44', marginBottom: 8 }}>Location</Text>
                <TouchableOpacity
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: quickFilters.sameCity ? '#D32F2F' : '#F5F6F5',
                    borderWidth: 1,
                    borderColor: quickFilters.sameCity ? '#D32F2F' : '#D1D5DB',
                  }}
                  onPress={() => setQuickFilters({ ...quickFilters, sameCity: !quickFilters.sameCity })}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons 
                      name="location" 
                      size={16} 
                      color={quickFilters.sameCity ? '#FFFFFF' : '#4B5563'} 
                    />
                    <Text style={{ 
                      color: quickFilters.sameCity ? '#FFFFFF' : '#1F2A44',
                      fontSize: 14,
                      fontWeight: '500'
                    }}>
                      Same City Only
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Age Range */}
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2A44', marginBottom: 8 }}>Age Range</Text>
                <View className="flex-row gap-2">
                  <TextInput
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 14,
                      backgroundColor: '#FFFFFF',
                      color: '#1F2A44'
                    }}
                    placeholder="Min age"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={quickFilters.ageRange[0]?.toString() || ""}
                    onChangeText={(text) =>
                      setQuickFilters({
                        ...quickFilters,
                        ageRange: [text ? parseInt(text) : null, quickFilters.ageRange[1]],
                      })
                    }
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 12,
                      padding: 10,
                      fontSize: 14,
                      backgroundColor: '#FFFFFF',
                      color: '#1F2A44'
                    }}
                    placeholder="Max age"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={quickFilters.ageRange[1]?.toString() || ""}
                    onChangeText={(text) =>
                      setQuickFilters({
                        ...quickFilters,
                        ageRange: [quickFilters.ageRange[0], text ? parseInt(text) : null],
                      })
                    }
                  />
                </View>
              </View>

              {/* Education Level */}
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2A44', marginBottom: 8 }}>Education Level</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {["High School", "Bachelor's Degree", "Master's Degree", "Doctorate"].map((edu) => (
                      <TouchableOpacity
                        key={edu}
                        style={{
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          backgroundColor: quickFilters.education === edu ? '#D32F2F' : '#F5F6F5',
                          borderWidth: 1,
                          borderColor: quickFilters.education === edu ? '#D32F2F' : '#D1D5DB',
                        }}
                        onPress={() => setQuickFilters({ 
                          ...quickFilters, 
                          education: quickFilters.education === edu ? null : edu 
                        })}
                      >
                        <Text style={{
                          color: quickFilters.education === edu ? '#FFFFFF' : '#1F2A44',
                          fontSize: 12,
                          fontWeight: '500'
                        }}>
                          {edu}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </ScrollView>
          
          <View style={{ 
            padding: 16, 
            borderTopWidth: 1, 
            borderTopColor: '#E5E7EB',
            backgroundColor: '#FFFFFF' 
          }}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F5F6F5',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#D1D5DB'
                }}
                onPress={() =>
                  setQuickFilters({
                    withPhoto: null,
                    verified: null,
                    activeRecently: null,
                    sameCity: null,
                    ageRange: [null, null],
                    education: null,
                  })
                }
              >
                <Text style={{ 
                  textAlign: 'center', 
                  fontSize: 14, 
                  fontWeight: '600', 
                  color: '#4B5563' 
                }}>
                  Clear All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{
                  flex: 1,
                  backgroundColor: '#D32F2F',
                  borderRadius: 12,
                  padding: 12,
                  elevation: 3,
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  shadowColor: '#D32F2F',
                }}
                onPress={() => setShowQuickFilters(false)}
              >
                <Text style={{ 
                  textAlign: 'center', 
                  fontSize: 14, 
                  fontWeight: '600', 
                  color: '#FFFFFF' 
                }}>
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Reanimated.View>
      </View>
    </Modal>
  );

const renderMatchCard = ({ item: match, index }) => (
  <Reanimated.View 
    entering={FadeIn.delay(index * 80).duration(400)} 
    style={{ marginBottom: 20 }}
  >
    <View style={{
      borderRadius: 24,
      overflow: 'hidden',
      elevation: 12,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowColor: '#000000',
    }}>
      <TouchableOpacity
        onPress={() => {
          if (!hasSubscription) {
            navigation.navigate("Subscription");
            return;
          }
          setSelectedProfile(match);
        }}
        activeOpacity={0.92}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        {/* Image Container */}
        <View style={{ position: 'relative', overflow: 'hidden' }}>
          <Image
            source={{ uri: match.profilePhoto }}
            style={{
              width: '100%',
              height: 280,
              backgroundColor: '#F8FAFC'
            }}
            resizeMode="cover"
          />
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.5, 1]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '100%'
            }}
          />
          
          {/* Subtle Pattern Overlay */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            backgroundColor: 'transparent',
            backgroundImage: `linear-gradient(45deg, #5e35b1 25%, transparent 25%, transparent 75%, #5e35b1 75%, #5e35b1),
                              linear-gradient(45deg, #5e35b1 25%, transparent 25%, transparent 75%, #5e35b1 75%, #5e35b1)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px'
          }} />
          
          {/* Overlay for non-subscribers */}
          {match.isBlurred && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.9)'
            }}>
              <View style={{
                backgroundColor: 'rgba(211, 47, 47, 0.95)',
                borderRadius: 20,
                paddingHorizontal: 20,
                paddingVertical: 12,
                shadowColor: '#D32F2F',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.4)'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="lock-closed" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 14, 
                    fontWeight: '700',
                    letterSpacing: 0.5,
                  }}>
                    Subscribe to View
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Top badges */}
          <View style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <View style={{ gap: 8 }}>
              {match.isNew && (
                <View style={{
                  backgroundColor: '#00D4AA',
                  borderRadius: 14,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.4)'
                }}>
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 11, 
                    fontWeight: '800',
                    letterSpacing: 0.8,
                  }}>NEW</Text>
                </View>
              )}
              {match.isVerified && (
                <View style={{
                  backgroundColor: '#007BFF',
                  borderRadius: 14,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.4)'
                }}>
                  <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 11, 
                    fontWeight: '800',
                    letterSpacing: 0.8,
                  }}>VERIFIED</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity
              onPress={() => toggleShortlist(match._id)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 18,
                padding: 7,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)'
              }}
            >
              <Ionicons
                name={match.shortlisted ? "heart" : "heart-outline"}
                size={20}
                color={match.shortlisted ? "#D32F2F" : "#4B5563"}
              />
            </TouchableOpacity>
          </View>

          {/* Compatibility badge */}
          <View style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
          }}>
            <LinearGradient
              colors={getCompatibilityColor(match.compatibility)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 6,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.4)'
              }}
            >
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 13, 
                fontWeight: '800',
                letterSpacing: 0.4
              }}>
                {match.compatibility}% Match
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Card content */}
        <View style={{ padding: 20, backgroundColor: '#FFFFFF' }}>
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start', 
            marginBottom: 16 
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 22, 
                fontWeight: '800', 
                color: '#1F2937',
                marginBottom: 8,
                letterSpacing: -0.3
              }}>
                {hasSubscription ? match.name : maskFirstName(match.name)}
              </Text>
              
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                marginBottom: 8,
              }}>
                <View style={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: 8, 
                  backgroundColor: '#F3F4F6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 8 
                }}>
                  <Ionicons name="calendar-outline" size={10} color="#5e35b1" />
                </View>
                <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>
                  {match.age} years
                </Text>
              </View>
              
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
              }}>
                <View style={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: 8, 
                  backgroundColor: '#F3F4F6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 8 
                }}>
                  <Ionicons name="location-outline" size={10} color="#5e35b1" />
                </View>
                <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>
                  {match.currentCity}
                </Text>
              </View>
            </View>
            
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#F9FAFB',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#F3F4F6'
            }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: match.lastActive === "Recently" ? "#10B981" : "#F59E0B",
                marginRight: 6
              }} />
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>
                {match.lastActive}
              </Text>
            </View>
          </View>

          {/* Bio section */}
          {match.bio && (
            <View style={{
              borderLeftWidth: 3,
              borderLeftColor: '#E5E7EB',
              paddingLeft: 12,
              marginBottom: 16
            }}>
              <Text style={{ 
                fontSize: 13, 
                color: '#6B7280', 
                lineHeight: 18,
                fontStyle: 'italic'
              }} numberOfLines={2}>
                "{match.bio}"
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={() => handleSendInterest(match._id)}
              disabled={match.interestSent}
              style={{
                flex: 1,
                backgroundColor: match.interestSent ? '#10B981' : '#D32F2F',
                borderRadius: 14,
                padding: 14,
                shadowColor: match.interestSent ? '#10B981' : '#D32F2F',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: match.interestSent ? 0.2 : 0.3,
                shadowRadius: 6,
                elevation: match.interestSent ? 2 : 4,
              }}
              activeOpacity={0.85}
            >
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 8 
              }}>
                <Ionicons
                  name={match.interestSent ? "checkmark-circle" : "heart"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 14, 
                  fontWeight: '700',
                }}>
                  {match.interestSent ? "Interest Sent" : "Send Interest"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  </Reanimated.View>
);

  const renderProfileModal = () => (
    <Modal
      visible={!!selectedProfile}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setSelectedProfile(null)}
    >
      <View style={{ 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.8)' 
      }}>
        <SafeAreaView style={{ flex: 1 }}>
          {selectedProfile && (
            <Reanimated.View 
              entering={SlideInDown.duration=300} 
              style={{ flex: 1 }}
            >
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.1)'
              }}>
                <TouchableOpacity
                  onPress={() => setSelectedProfile(null)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: 6,
                  }}
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 16, 
                  fontWeight: '600' 
                }}>
                  Profile Details
                </Text>
                
                <TouchableOpacity
                  onPress={() => toggleShortlist(selectedProfile._id)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: 6,
                  }}
                >
                  <Ionicons
                    name={selectedProfile.shortlisted ? "heart" : "heart-outline"}
                    size={18}
                    color={selectedProfile.shortlisted ? "#D32F2F" : "#FFFFFF"}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {/* Profile Image */}
                <View style={{ height: 320, position: 'relative' }}>
                  <Image
                    source={{ uri: selectedProfile.profilePhoto }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 80,
                      justifyContent: 'flex-end',
                      padding: 16
                    }}
                  >
                    <Text style={{ 
                      color: '#FFFFFF', 
                      fontSize: 22, 
                      fontWeight: '700' 
                    }}>
                      {hasSubscription ? selectedProfile.name : maskFirstName(selectedProfile.name)}
                    </Text>
                    <Text style={{ 
                      color: '#FFFFFF', 
                      fontSize: 14, 
                      opacity: 0.9 
                    }}>
                      {selectedProfile.age} years, {selectedProfile.currentCity}
                    </Text>
                  </LinearGradient>
                </View>

                {/* Profile sections */}
                <View style={{ backgroundColor: '#FFFFFF', flex: 1 }}>
                  {/* Basic Info */}
                  <View style={{ padding: 16 }}>
                    <TouchableOpacity
                      onPress={() => toggleSection('basic')}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12
                      }}
                    >
                      <Text style={{ 
                        fontSize: 18, 
                        fontWeight: '700', 
                        color: '#1F2A44' 
                      }}>
                        Basic Information
                      </Text>
                      <Ionicons
                        name={expandedSections.basic ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#4B5563"
                      />
                    </TouchableOpacity>
                    
                    {expandedSections.basic && (
                      <View style={{ gap: 8 }}>
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="person-outline" size={16} color="#D32F2F" />
                          <Text style={{ fontSize: 14, color: '#4B5563' }}>
                            {selectedProfile.gender}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="calendar-outline" size={16} color="#D32F2F" />
                          <Text style={{ fontSize: 14, color: '#4B5563' }}>
                            Born on {new Date(selectedProfile.dob).toLocaleDateString()}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="location-outline" size={16} color="#D32F2F" />
                          <Text style={{ fontSize: 14, color: '#4B5563' }}>
                            Lives in {selectedProfile.currentCity}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Ionicons name="school-outline" size={16} color="#D32F2F" />
                          <Text style={{ fontSize: 14, color: '#4B5563' }}>
                            {selectedProfile.education}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Professional Info */}
                  {selectedProfile.occupation && (
                    <View style={{ 
                      padding: 16, 
                      borderTopWidth: 1, 
                      borderTopColor: '#E5E7EB' 
                    }}>
                      <TouchableOpacity
                        onPress={() => toggleSection('professional')}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 12
                        }}
                      >
                        <Text style={{ 
                          fontSize: 18, 
                          fontWeight: '700', 
                          color: '#1F2A44' 
                        }}>
                          Professional Details
                        </Text>
                        <Ionicons
                          name={expandedSections.professional ? "chevron-up" : "chevron-down"}
                          size={18}
                          color="#4B5563"
                        />
                      </TouchableOpacity>
                      
                      {expandedSections.professional && (
                        <View style={{ gap: 8 }}>
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="briefcase-outline" size={16} color="#D32F2F" />
                            <Text style={{ fontSize: 14, color: '#4B5563' }}>
                              {selectedProfile.occupation}
                            </Text>
                          </View>
                          {selectedProfile.company && (
                            <View className="flex-row items-center gap-2">
                              <Ionicons name="business-outline" size={16} color="#D32F2F" />
                              <Text style={{ fontSize: 14, color: '#4B5563' }}>
                                Works at {selectedProfile.company}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Family Info */}
                  <View style={{ 
                    padding: 16, 
                    borderTopWidth: 1, 
                    borderTopColor: '#E5E7EB' 
                  }}>
                    <TouchableOpacity
                      onPress={() => toggleSection('family')}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12
                      }}
                    >
                      <Text style={{ 
                        fontSize: 18, 
                        fontWeight: '700', 
                        color: '#1F2A44' 
                      }}>
                        Family Details
                      </Text>
                      <Ionicons
                        name={expandedSections.family ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#4B5563"
                      />
                    </TouchableOpacity>
                    
                    {expandedSections.family && (
                      <View style={{ gap: 8 }}>
                        {selectedProfile.caste && (
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="people-outline" size={16} color="#D32F2F" />
                            <Text style={{ fontSize: 14, color: '#4B5563' }}>
                              {selectedProfile.caste}
                            </Text>
                          </View>
                        )}
                        {selectedProfile.religion && (
                          <View className="flex-row items-center gap-2">
                            <MaterialCommunityIcons name="religion-hindu" size={16} color="#D32F2F" />
                            <Text style={{ fontSize: 14, color: '#4B5563' }}>
                              {selectedProfile.religion}
                            </Text>
                          </View>
                        )}
                        {selectedProfile.familyType && (
                          <View className="flex-row items-center gap-2">
                            <Ionicons name="home-outline" size={16} color="#D32F2F" />
                            <Text style={{ fontSize: 14, color: '#4B5563' }}>
                              {selectedProfile.familyType} Family
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Bio */}
                  <View style={{ 
                    padding: 16, 
                    borderTopWidth: 1, 
                    borderTopColor: '#E5E7EB' 
                  }}>
                    <Text style={{ 
                      fontSize: 18, 
                      fontWeight: '700', 
                      color: '#1F2A44',
                      marginBottom: 8
                    }}>
                      About
                    </Text>
                    <Text style={{ 
                      fontSize: 14, 
                      color: '#4B5563', 
                      lineHeight: 20 
                    }}>
                      {selectedProfile.bio}
                    </Text>
                  </View>

                  {/* Compatibility Score */}
                  <View style={{ 
                    padding: 16, 
                    borderTopWidth: 1, 
                    borderTopColor: '#E5E7EB' 
                  }}>
                    <Text style={{ 
                      fontSize: 18, 
                      fontWeight: '700', 
                      color: '#1F2A44',
                      marginBottom: 12
                    }}>
                      Compatibility Score
                    </Text>
                    <View style={{
                      backgroundColor: '#F5F6F5',
                      borderRadius: 12,
                      padding: 16,
                      alignItems: 'center'
                    }}>
                      <LinearGradient
                        colors={getCompatibilityColor(selectedProfile.compatibility)}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: 8
                        }}
                      >
                        <Text style={{ 
                          color: '#FFFFFF', 
                          fontSize: 20, 
                          fontWeight: '700' 
                        }}>
                          {selectedProfile.compatibility}%
                        </Text>
                      </LinearGradient>
                      <Text style={{ 
                        fontSize: 14, 
                        color: '#4B5563',
                        textAlign: 'center'
                      }}>
                        Based on your preferences and profile match
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Bottom action buttons */}
              <View style={{
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#E5E7EB',
                padding: 16
              }}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => handleSendInterest(selectedProfile._id)}
                    disabled={selectedProfile.interestSent}
                    style={{
                      flex: 1,
                      backgroundColor: selectedProfile.interestSent ? '#22C55E' : '#D32F2F',
                      borderRadius: 12,
                      padding: 12,
                      elevation: selectedProfile.interestSent ? 0 : 3,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: selectedProfile.interestSent ? 0 : 0.2,
                      shadowRadius: 3,
                      shadowColor: '#D32F2F',
                    }}
                  >
                    <View className="flex-row items-center justify-center gap-1">
                      <Ionicons
                        name={selectedProfile.interestSent ? "checkmark-circle" : "heart"}
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={{ 
                        color: '#FFFFFF', 
                        fontSize: 14, 
                        fontWeight: '600' 
                      }}>
                        {selectedProfile.interestSent ? "Interest Sent" : "Send Interest"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      navigation.navigate("Chat", { 
                        matchId: selectedProfile._id, 
                        matchName: selectedProfile.name 
                      });
                      setSelectedProfile(null);
                    }}
                    style={{
                      backgroundColor: '#007BFF',
                      borderRadius: 12,
                      padding: 12,
                      minWidth: 48,
                      alignItems: 'center',
                      elevation: 3,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 3,
                      shadowColor: '#007BFF',
                    }}
                  >
                    <Ionicons name="chatbubble" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </Reanimated.View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );

  if (checkingSubscription) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text style={{ fontSize: 16, color: '#4B5563' }}>Checking subscription...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F6F5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            flex: 1,
          }}
        >
          {/* Header */}
          <View style={{ 
            backgroundColor: '#FFFFFF', 
            paddingHorizontal: 16, 
            paddingTop: 12, 
            paddingBottom: 10,
            elevation: 2,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            shadowColor: '#000000',
          }}>
            <View className="flex-row justify-between items-center mb-3 mt-6">
              <Text style={{ 
                fontSize: 24, 
                fontWeight: '700', 
                color: '#1F2A44' 
              }}>
                Matches
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowQuickFilters(true)}
                  style={{
                    backgroundColor: '#F5F6F5',
                    borderRadius: 16,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: '#D1D5DB'
                  }}
                >
                  <Ionicons name="options" size={18} color="#4B5563" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onRefresh()}
                  style={{
                    backgroundColor: '#D32F2F',
                    borderRadius: 16,
                    padding: 8,
                    elevation: 3,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 3,
                    shadowColor: '#D32F2F',
                  }}
                >
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F6F5',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: '#D1D5DB'
            }}>
              <Ionicons name="search" size={18} color="#4B5563" />
              <TextInput
                style={{ 
                  flex: 1, 
                  marginLeft: 8, 
                  fontSize: 14, 
                  color: '#1F2A44' 
                }}
                placeholder="Search by city..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {renderTabBar()}
          
          <FlatList
            data={filteredMatches}
            renderItem={renderMatchCard}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ 
              padding: 16, 
              paddingBottom: 80 
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                colors={['#D32F2F']}
                tintColor="#D32F2F"
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.2}
            ListFooterComponent={() => 
              isLoading && (
                <View style={{ 
                  padding: 16, 
                  alignItems: 'center' 
                }}>
                  <Text style={{ 
                    fontSize: 14, 
                    color: '#4B5563' 
                  }}>
                    Loading more matches...
                  </Text>
                </View>
              )
            }
            ListEmptyComponent={() => (
              <View style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center', 
                paddingVertical: 40 
              }}>
                <Ionicons name="heart-outline" size={48} color="#D1D5DB" />
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '600', 
                  color: '#4B5563',
                  marginTop: 12,
                  marginBottom: 6
                }}>
                  No matches found
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: '#9CA3AF',
                  textAlign: 'center',
                  paddingHorizontal: 32
                }}>
                  Try adjusting your filters or check back later for new profiles
                </Text>
              </View>
            )}
          />
        </Animated.View>

        {renderQuickFilters()}
        {renderProfileModal()}
        <Toast />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default MatchesScreen;