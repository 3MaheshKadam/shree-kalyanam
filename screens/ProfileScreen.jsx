import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  FlatList,
  Image,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { useSession } from 'context/SessionContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';

const { width: screenWidth } = Dimensions.get('window');

const ProfileScreen = () => {
  const { user } = useSession();
  const [formSections, setFormSections] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [formData, setFormData] = useState({});
  const [adminWillFill, setAdminWillFill] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState('Unverified');
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState({});
  const [photos, setPhotos] = useState([
    { id: 1, url: null, isPrimary: true },
    { id: 2, url: null, isPrimary: false },
    { id: 3, url: null, isPrimary: false },
    { id: 4, url: null, isPrimary: false },
  ]);
  const [fieldErrors, setFieldErrors] = useState({});

  const fieldNameMappings = {
    'Full Name': 'name',
    'Height': 'height',
    'Weight': 'weight',
    'Date of Birth': 'dob',
    'Marital Status': 'maritalStatus',
    'Mother Tongue': 'motherTongue',
    'Current City': 'currentCity',
    'Email Address': 'email',
    'Permanent Address': 'permanentAddress',
    'Gender': 'gender',
    'Blood Group': 'bloodGroup',
    'Wears Lens': 'wearsLens',
    'Complexion': 'complexion',
    'Highest Education': 'education',
    'Occupation': 'occupation',
    'Field of Study': 'fieldOfStudy',
    'Company': 'company',
    'College/University': 'college',
    'Annual Income': 'income',
    "Father's Name": 'fatherName',
    "Mother's Name": 'mother',
    "Parent's Residence City": 'parentResidenceCity',
    "Number of Brothers": 'brothers',
    "Number of Sisters": 'sisters',
    "Married Brothers": 'marriedBrothers',
    "Married Sisters": 'marriedSisters',
    "Native District": 'nativeDistrict',
    "Native City": 'nativeCity',
    "Family Wealth": 'familyWealth',
    "Mama's Surname": 'mamaSurname',
    "Parent's Occupation": 'parentOccupation',
    "Relative Surnames": 'relativeSurname',
    "Religion": 'religion',
    "Sub Caste": 'subCaste',
    "Caste": 'caste',
    "Gothra": 'gothra',
    "Rashi": 'rashi',
    "Nadi": 'nadi',
    "Nakshira": 'nakshira',
    "Mangal Dosha": 'mangal',
    "Charan": 'charan',
    "Birth Place": 'birthPlace',
    "Birth Time": 'birthTime',
    "Gan": 'gan',
    "Gotra Devak": 'gotraDevak',
    "Expected Caste": 'expectedCaste',
    "Preferred City": 'preferredCity',
    "Expected Age Difference": 'expectedAgeDifference',
    "Expected Education": 'expectedEducation',
    "Accept Divorcee": 'divorcee',
    "Expected Height": 'expectedHeight',
    "Expected Income": 'expectedIncome',
  };

  const normalizeFieldName = (name) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        setIsLoading(false);
        return;
      }

      try {
        const sectionsRes = await fetch('https://shiv-bandhan-testing.vercel.app/api/admin/form-sections');
        if (!sectionsRes.ok) throw new Error('Failed to fetch form sections');
        const sectionsData = await sectionsRes.json();

        const transformedSections = sectionsData.map(section => ({
          ...section,
          id: section._id,
          fields: section.fields.map(field => ({
            ...field,
            name: field.name,
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options || [],
            placeholder: field.placeholder || '',
          })),
        }));

        setFormSections(transformedSections);
        if (transformedSections.length > 0) {
          setActiveTab(transformedSections[0]._id);
        }

        const userRes = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/me');
        if (!userRes.ok) throw new Error('Failed to fetch user data');
        const userData = await userRes.json();

        const initialFormData = {};
        transformedSections.forEach(section => {
          section.fields.forEach(field => {
            const mappingEntry = Object.entries(fieldNameMappings).find(
              ([key]) => normalizeFieldName(key) === normalizeFieldName(field.name)
            );
            if (mappingEntry) {
              const [_, backendField] = mappingEntry;
              if (userData[backendField] !== undefined) {
                initialFormData[field.name] = userData[backendField];
              }
            } else if (userData[field.name] !== undefined) {
              initialFormData[field.name] = userData[field.name];
            }
          });
        });

        Object.keys(userData).forEach(key => {
          if (!initialFormData[key]) {
            initialFormData[key] = userData[key];
          }
        });

        setFormData(initialFormData);
        if (userData.profilePhoto) {
          setPhotos(prevPhotos =>
            prevPhotos.map(photo =>
              photo.id === 1 ? { ...photo, url: userData.profilePhoto } : photo
            )
          );
        }

        if (userData.profileSetup?.willAdminFill !== undefined) {
          setAdminWillFill(userData.profileSetup.willAdminFill);
        }

        if (userData.verificationStatus) {
          setVerificationStatus(userData.verificationStatus);
        }

        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Error', `Failed to load profile: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    if (Object.keys(formData).length > 0 && formSections.length > 0) {
      setProfileCompletion(calculateProfileCompletion());
    }
  }, [formData, formSections]);

  const calculateProfileCompletion = (formDataToCheck = formData) => {
    if (!formSections.length) return 0;

    const requiredFields = Object.keys(fieldNameMappings);
    let totalFields = requiredFields.length;
    let filledFields = 0;

    requiredFields.forEach(fieldName => {
      const value = formDataToCheck[fieldName];
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0 && value.some(item => item.trim() !== '')) {
            filledFields++;
          }
        } else if (typeof value === 'boolean') {
          filledFields++;
        } else if (typeof value === 'string' && value.trim() !== '') {
          filledFields++;
        } else if (typeof value === 'number') {
          filledFields++;
        }
      }
    });

    totalFields++;
    if (formDataToCheck.profilePhoto || (photos[0] && photos[0].url)) {
      filledFields++;
    }

    return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  };

  const validateField = (field, value) => {
    if (field.required && (value === undefined || value === '' || value === null)) {
      return `${field.label} is required`;
    }
    if (field.type === 'date' && value) {
      const date = new Date(value);
      if (isNaN(date)) return 'Invalid date format';
    }
    if (field.type === 'number' && value && isNaN(value)) {
      return 'Must be a valid number';
    }
    return '';
  };

  const handleInputChange = (fieldName, value, field) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldName]: value };
      setProfileCompletion(calculateProfileCompletion(newData));
      if (field) {
        const error = validateField(field, value);
        setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
      }
      return newData;
    });
    setShowDropdown({});
  };

  const handleProfileUpdate = async () => {
    setIsSaving(true);
    try {
      const errors = {};
      formSections.forEach(section => {
        section.fields.forEach(field => {
          const error = validateField(field, formData[field.name]);
          if (error) errors[field.name] = error;
        });
      });

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        Alert.alert('Error', 'Please fill all required fields correctly.');
        setIsSaving(false);
        return;
      }

      const currentFormData = JSON.parse(JSON.stringify(formData));
      const transformedData = {
        name: currentFormData['Full Name'],
        email: currentFormData['Email Address'],
        gender: currentFormData['Gender'],
        dob: currentFormData['Date of Birth'],
        height: currentFormData['Height'],
        religion: currentFormData['Religion'],
        currentCity: currentFormData['Current City'],
        education: currentFormData['Highest Education'],
        maritalStatus: currentFormData['Marital Status'],
        motherTongue: currentFormData['Mother Tongue'],
        caste: currentFormData['Caste'],
        subCaste: currentFormData['Sub Caste'],
        gothra: currentFormData['Gothra'],
        fieldOfStudy: currentFormData['Field of Study'],
        college: currentFormData['College/University'],
        occupation: currentFormData['Occupation'],
        company: currentFormData['Company'],
        weight: currentFormData['Weight'],
        permanentAddress: currentFormData['Permanent Address'],
        profilePhoto: currentFormData['profilePhoto'],
        complexion: currentFormData['Complexion'],
        income: currentFormData['Annual Income'],
        bloodGroup: currentFormData['Blood Group'],
        wearsLens: currentFormData['Wears Lens'],
        fatherName: currentFormData["Father's Name"],
        parentResidenceCity: currentFormData["Parent's Residence City"],
        mother: currentFormData["Mother's Name"],
        brothers: currentFormData['Number of Brothers'],
        marriedBrothers: currentFormData['Married Brothers'],
        sisters: currentFormData['Number of Sisters'],
        marriedSisters: currentFormData['Married Sisters'],
        nativeDistrict: currentFormData['Native District'],
        nativeCity: currentFormData['Native City'],
        familyWealth: currentFormData['Family Wealth'],
        relativeSurname: currentFormData['Relative Surnames'],
        parentOccupation: currentFormData["Parent's Occupation"],
        mamaSurname: currentFormData["Mama's Surname"],
        rashi: currentFormData['Rashi'],
        nakshira: currentFormData['Nakshira'],
        charan: currentFormData['Charan'],
        gan: currentFormData['Gan'],
        nadi: currentFormData['Nadi'],
        mangal: currentFormData['Mangal Dosha'],
        birthPlace: currentFormData['Birth Place'],
        birthTime: currentFormData['Birth Time'],
        gotraDevak: currentFormData['Gotra Devak'],
        expectedCaste: currentFormData['Expected Caste'],
        preferredCity: currentFormData['Preferred City'],
        expectedAgeDifference: currentFormData['Expected Age Difference'],
        expectedEducation: currentFormData['Expected Education'],
        divorcee: currentFormData['Accept Divorcee'],
        expectedHeight: currentFormData['Expected Height'],
        expectedIncome: currentFormData['Expected Income'],
      };

      const payload = {
        ...transformedData,
        userId: user?.id,
      };

      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      Alert.alert('Success', 'Profile updated successfully!');
      if (profileCompletion === 100 && verificationStatus === 'Unverified') {
        await handleVerificationSubmit();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', `Failed to update profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerificationSubmit = async () => {
    try {
      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          verificationStatus: 'Pending',
          verificationSubmittedAt: new Date(),
        }),
      });

      if (!response.ok) throw new Error('Failed to submit verification');
      setVerificationStatus('Pending');
      Alert.alert('Success', 'Verification submitted successfully!');
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', `Failed to submit verification: ${error.message}`);
    }
  };

  const handlePhotoUpload = async (photoId) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const formData = new FormData();
        formData.append('file', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: `photo-${photoId}.jpg`,
        });
        formData.append('upload_preset', 'shivbandhan');

        const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dqfum2awz/image/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadResult = await uploadResponse.json();
        if (uploadResult.secure_url) {
          setPhotos(prevPhotos =>
            prevPhotos.map(photo =>
              photo.id === photoId ? { ...photo, url: uploadResult.secure_url } : photo
            )
          );
          if (photoId === 1) {
            handleInputChange('profilePhoto', uploadResult.secure_url);
          }
        }
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo.');
    }
  };

  const handleMakePrimary = (photoId) => {
    setPhotos(photos.map(photo => ({
      ...photo,
      isPrimary: photo.id === photoId,
    })));
    const primaryPhoto = photos.find(photo => photo.id === photoId);
    if (primaryPhoto.url) {
      handleInputChange('profilePhoto', primaryPhoto.url);
    }
  };

  const handleAdminFillToggle = async (enabled) => {
    setAdminWillFill(enabled);
    try {
      const response = await fetch('https://shiv-bandhan-testing.vercel.app/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          profileSetup: {
            willAdminFill: enabled,
            dontAskAgain: formData.profileSetup?.dontAskAgain || false,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to update admin fill setting');
      setFormData(prev => ({
        ...prev,
        profileSetup: { ...prev.profileSetup, willAdminFill: enabled },
      }));
    } catch (error) {
      console.error('Error updating admin fill setting:', error);
      setAdminWillFill(!enabled);
      Alert.alert('Error', `Failed to update admin fill setting: ${error.message}`);
    }
  };

  const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const VerificationBadge = ({ status }) => {
    const statusConfig = {
      Unverified: {
        backgroundColor: '#F3F4F6',
        color: '#1F2937',
        icon: null,
        label: 'Unverified',
      },
      Pending: {
        backgroundColor: '#FEF3C7',
        color: '#B45309',
        icon: <Ionicons name="time-outline" size={12} color="#B45309" style={styles.iconMargin} />,
        label: 'Pending',
      },
      Verified: {
        backgroundColor: '#DCFCE7',
        color: '#15803D',
        icon: <Ionicons name="shield-checkmark-outline" size={12} color="#15803D" style={styles.iconMargin} />,
        label: 'Verified',
      },
      Rejected: {
        backgroundColor: '#FEE2E2',
        color: '#B91C1C',
        icon: <Ionicons name="close-circle-outline" size={12} color="#B91C1C" style={styles.iconMargin} />,
        label: 'Rejected',
      },
    };

    const config = statusConfig[status] || statusConfig.Unverified;

    return (
      <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
        {config.icon}
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const renderFieldInput = (field) => {
    const value = formData[field.name] ?? '';
    const fieldKey = `${field.name}-${field._id}`;
    const error = fieldErrors[field.name];

    const inputStyles = [
      styles.input,
      error && styles.inputError,
      field.type.toLowerCase().includes('address') && styles.inputMultiline,
    ];

    switch (field.type.toLowerCase()) {
      case 'select':
      case 'checkbox':
        const options = field.type.toLowerCase() === 'checkbox' ? ['Yes', 'No'] : field.options;
        return (
          <View style={styles.inputContainer} key={fieldKey}>
            <Text style={styles.inputLabel}>
              {field.label}{field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TouchableOpacity
              style={[styles.selectButton, error && styles.inputError]}
              onPress={() => setShowDropdown(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
            >
              <Text style={[styles.selectText, !value && styles.placeholderText]}>
                {field.type.toLowerCase() === 'checkbox'
                  ? value !== '' ? (value ? 'Yes' : 'No') : `Select ${field.label}`
                  : value || `Select ${field.label}`}
              </Text>
              <Ionicons
                name={showDropdown[fieldKey] ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
            {showDropdown[fieldKey] && (
              <View style={styles.dropdown}>
                {options.map((item, index) => (
                  <TouchableOpacity
                    key={`${fieldKey}-option-${index}`}
                    style={[styles.option, value === item && styles.selectedOption]}
                    onPress={() => handleInputChange(field.name, field.type === 'checkbox' ? item === 'Yes' : item, field)}
                  >
                    <Text style={[styles.optionText, value === item && styles.selectedOptionText]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'date':
        return (
          <View style={styles.inputContainer} key={fieldKey}>
            <Text style={styles.inputLabel}>
              {field.label}{field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={inputStyles}
              value={formatDateToYYYYMMDD(value)}
              onChangeText={(text) => handleInputChange(field.name, text, field)}
              placeholder={field.placeholder || 'YYYY-MM-DD'}
              placeholderTextColor="#9CA3AF"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'number':
        return (
          <View style={styles.inputContainer} key={fieldKey}>
            <Text style={styles.inputLabel}>
              {field.label}{field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={inputStyles}
              value={value.toString()}
              onChangeText={(text) => handleInputChange(field.name, text, field)}
              keyboardType="numeric"
              placeholder={field.placeholder || `Enter ${field.label}`}
              placeholderTextColor="#9CA3AF"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return (
          <View style={styles.inputContainer} key={fieldKey}>
            <Text style={styles.inputLabel}>
              {field.label}{field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={inputStyles}
              value={value}
              onChangeText={(text) => handleInputChange(field.name, text, field)}
              placeholder={field.placeholder || `Enter ${field.label}`}
              placeholderTextColor="#9CA3AF"
              multiline={field.name.toLowerCase().includes('address')}
              numberOfLines={field.name.toLowerCase().includes('address') ? 3 : 1}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );
    }
  };

  const renderTabContent = ({ item: section }) => {
    if (section.label.toLowerCase().includes('photo')) {
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="camera-outline" size={24} color="#F43F5E" />
            <Text style={styles.cardTitle}>{section.label}</Text>
          </View>
          <Animated.View entering={FadeIn} style={styles.alertContainer}>
            <Ionicons name="alert-circle-outline" size=  {20} color="#B45309" style={styles.alertIcon} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Add photos to boost visibility</Text>
              <Text style={styles.alertText}>Profiles with multiple photos attract more attention!</Text>
            </View>
          </Animated.View>
          <View style={styles.photoGrid}>
            {photos.map(photo => (
              <View key={`photo-${photo.id}`} style={styles.photoContainer}>
                <TouchableOpacity
                  style={[styles.photoBox, photo.url && styles.photoBoxFilled]}
                  onPress={() => handlePhotoUpload(photo.id)}
                >
                  {photo.url ? (
                    <Image source={{ uri: photo.url }} style={styles.photoImage} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera-outline" size={24} color="#6B7280" />
                      <Text style={styles.photoText}>Add Photo</Text>
                    </View>
                  )}
                  {photo.isPrimary && photo.url && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={styles.photoButton}
                    onPress={() => handlePhotoUpload(photo.id)}
                  >
                    <Text style={styles.photoButtonText}>{photo.url ? 'Change' : 'Upload'}</Text>
                  </TouchableOpacity>
                  {photo.url && !photo.isPrimary && (
                    <TouchableOpacity
                      style={[styles.photoButton, styles.makePrimaryButton]}
                      onPress={() => handleMakePrimary(photo.id)}
                    >
                      <Text style={[styles.photoButtonText, { color: '#1F2937' }]}>Set Primary</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={getSectionIcon(section.label)} size={24} color="#F43F5E" />
          <Text style={styles.cardTitle}>
            {section.label.includes('Education') ? 'Education & Career' : 
             section.label.includes('Religious') ? 'Religion & Community' : 
             section.label}
          </Text>
        </View>
        {section.fields.map(field => renderFieldInput(field))}
      </View>
    );
  };

  const getSectionIcon = (label) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('photo')) return 'camera-outline';
    if (lowerLabel.includes('personal') || lowerLabel.includes('basic')) return 'person-outline';
    if (lowerLabel.includes('education') || lowerLabel.includes('career')) return 'school-outline';
    if (lowerLabel.includes('family')) return 'people-outline';
    if (lowerLabel.includes('religious') || lowerLabel.includes('religion')) return 'star-outline';
    if (lowerLabel.includes('partner') || lowerLabel.includes('preference')) return 'heart-outline';
    return 'document-outline';
  };

  const SectionModal = () => {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(scale.value) }],
    }));

    return (
      <Modal
        visible={showSectionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, animatedStyle]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Section</Text>
              <TouchableOpacity
                onPress={() => {
                  scale.value = 0.95;
                  setTimeout(() => setShowSectionModal(false), 100);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={formSections}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.modalBody}
              renderItem={({ item: section }) => {
                const label = section.label.includes('Education')
                  ? 'Education & Career'
                  : section.label.includes('Religious')
                  ? 'Religion & Community'
                  : section.label;
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalSectionButton,
                      activeTab === section._id && styles.modalActiveSectionButton,
                    ]}
                    onPress={() => {
                      scale.value = 0.95;
                      setActiveTab(section._id);
                      setTimeout(() => setShowSectionModal(false), 100);
                    }}
                  >
                    <Ionicons
                      name={getSectionIcon(section.label)}
                      size={20}
                      color={activeTab === section._id ? '#F43F5E' : '#6B7280'}
                      style={styles.iconMargin}
                    />
                    <Text
                      style={[
                        styles.modalSectionText,
                        activeTab === section._id && styles.modalActiveSectionText,
                      ]}
                    >
                      {label}
                    </Text>
                    {activeTab === section._id && (
                      <Ionicons name="checkmark" size={20} color="#F43F5E" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F43F5E" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#F43F5E', '#EC4899']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.profileContainer}>
            <TouchableOpacity onPress={() => handlePhotoUpload(1)} style={styles.profileImageContainer}>
              <LinearGradient
                colors={['#F43F5E', '#EC4899']}
                style={styles.profileImageBorder}
              >
                {formData?.profilePhoto ? (
                  <Image
                    source={{ uri: formData.profilePhoto }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Ionicons name="person-outline" size={32} color="#FFF" />
                  </View>
                )}
              </LinearGradient>
              <View style={styles.cameraButton}>
                <Ionicons name="camera-outline" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileDetails}>
              <Text style={styles.nameText}>{formData?.name || 'Your Name'}</Text>
              <View style={styles.infoRow}>
                {formData?.height && <Text style={styles.infoText}>{formData.height} • </Text>}
                {formData?.religion && <Text style={styles.infoText}>{formData.religion}</Text>}
              </View>
              {formData?.currentCity && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#FFF" style={styles.iconMargin} />
                  <Text style={styles.infoText}>{formData.currentCity}</Text>
                </View>
              )}
              <VerificationBadge status={verificationStatus} />
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>Profile Completion: {profileCompletion}%</Text>
              <LinearGradient
                colors={['#F43F5E', '#EC4899']}
                style={styles.progressBar}
              >
                <Animated.View
                  entering={FadeIn}
                  style={[styles.progressFill, { width: `${profileCompletion}%` }]}
                />
              </LinearGradient>
            </View>
            
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionSelector}>
        <TouchableOpacity
          style={styles.sectionSelectorContent}
          onPress={() => setShowSectionModal(true)}
        >
          <Ionicons
            name={getSectionIcon(formSections.find(s => s._id === activeTab)?.label || '')}
            size={20}
            color="#F43F5E"
            style={styles.iconMargin}
          />
          <Text style={styles.sectionSelectorText}>
            {formSections.find(s => s._id === activeTab)?.label.includes('Education')
              ? 'Education & Career'
              : formSections.find(s => s._id === activeTab)?.label.includes('Religious')
              ? 'Religion & Community'
              : formSections.find(s => s._id === activeTab)?.label || 'Select Section'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#6B7280" style={styles.sectionSelectorIcon} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[formSections.find(s => s._id === activeTab)]}
        keyExtractor={(item) => item?._id || 'default'}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={renderTabContent}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleProfileUpdate}
          disabled={isSaving}
        >
          <LinearGradient
            colors={['#F43F5E', '#EC4899']}
            style={styles.saveButtonGradient}
          >
            {isSaving ? (
              <View style={styles.savingContainer}>
                <ActivityIndicator size="small" color="#FFF" />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {profileCompletion === 100 && verificationStatus === 'Unverified' && (
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={handleVerificationSubmit}
          >
            <LinearGradient
              colors={['#15803D', '#22C55E']}
              style={styles.verifyButtonGradient}
            >
              <Text style={styles.verifyButtonText}>Submit for Verification</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      <SectionModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profileImageBorder: {
    borderRadius: screenWidth * 0.1,
    padding: 2,
  },
  profileImage: {
    width: screenWidth * 0.2,
    height: screenWidth * 0.2,
    borderRadius: screenWidth * 0.1 - 2,
  },
  profilePlaceholder: {
    width: screenWidth * 0.2,
    height: screenWidth * 0.2,
    borderRadius: screenWidth * 0.1 - 2,
    backgroundColor: '#FFE4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F43F5E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileDetails: {
    flex: 1,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  infoText: {
    fontSize: 14,
    color: '#FFF',
  },
  iconMargin: {
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  progressContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 12,
    color: '#FFF',
    marginRight: 8,
  },
  toggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6B7280',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#FFF',
  },
  toggleButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
  },
  toggleButtonActive: {
    backgroundColor: '#F43F5E',
    alignSelf: 'flex-end',
  },
  sectionSelector: {
    backgroundColor: '#FFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
  },
  sectionSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  sectionSelectorIcon: {
    marginLeft: 8,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  alertContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIcon: {
    marginRight: 8,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#B45309',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 12,
    color: '#B45309',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoContainer: {
    width: (screenWidth - 48) / 2,
    marginBottom: 16,
  },
  photoBox: {
    aspectRatio: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  photoBoxFilled: {
    borderStyle: 'solid',
    borderColor: '#F43F5E',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#15803D',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '500',
  },
  photoActions: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#F43F5E',
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  makePrimaryButton: {
    backgroundColor: '#E5E7EB',
  },
  photoButtonText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  required: {
    color: '#F43F5E',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectText: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  dropdown: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 150,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectedOption: {
    backgroundColor: '#FEE2E2',
  },
  optionText: {
    fontSize: 14,
    color: '#1F2937',
  },
  selectedOptionText: {
    color: '#F43F5E',
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  saveButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  verifyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  verifyButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalBody: {
    padding: 16,
  },
  modalSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalActiveSectionButton: {
    backgroundColor: '#FEE2E2',
  },
  modalSectionText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  modalActiveSectionText: {
    color: '#F43F5E',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
});

export default ProfileScreen;