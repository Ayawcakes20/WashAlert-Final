import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

// Customer Screens
import HomeScreen from '../screens/customer/HomeScreen';
import BookingScreen from '../screens/customer/BookingScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import OrderDetailScreen from '../screens/customer/OrderDetailScreen';
import TrackingScreen from '../screens/customer/TrackingScreen';
import NotificationsScreen from '../screens/customer/NotificationsScreen';
import ChatScreen from '../screens/customer/ChatScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import EditProfileScreen from '../screens/customer/EditProfileScreen';
import ChangePasswordScreen from '../screens/customer/ChangePasswordScreen';
import SavedAddressesScreen from '../screens/customer/SavedAddressesScreen';
import PaymentMethodsScreen from '../screens/customer/PaymentMethodsScreen';
import TermsAndConditionsScreen from '../screens/customer/TermsAndConditionsScreen';
import PrivacyPolicyScreen from '../screens/customer/PrivacyPolicyScreen';
import PaymentSuccessScreen from '../screens/customer/PaymentSuccessScreen';
import PaymentCancelScreen from '../screens/customer/PaymentCancelScreen';
import ServicesScreen from '../screens/customer/ServicesScreen';

// Driver Screens
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import DriverDeliveriesScreen from '../screens/driver/DriverDeliveriesScreen';
import DeliveryDetailScreen from '../screens/driver/DeliveryDetailScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';

// Staff Screens
import StaffInventoryScreen from '../screens/staff/StaffInventoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─────────────────────────────────────────────────────────────────────────────
// Brsh.-style FLOATING rounded bottom tab bar — Customer
// ─────────────────────────────────────────────────────────────────────────────
const CUSTOMER_TABS = [
  { name: 'Home',          label: 'Home',    icon: 'home-outline',          iconActive: 'home'          },
  { name: 'Orders',        label: 'Orders',  icon: 'receipt-outline',       iconActive: 'receipt'       },
  { name: 'Book',          label: null,      icon: null,                    iconActive: null            }, // FAB centre
  { name: 'Notifications', label: 'Alerts',  icon: 'notifications-outline', iconActive: 'notifications' },
  { name: 'Profile',       label: 'Profile', icon: 'person-outline',        iconActive: 'person'        },
];

function CustomerTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.outerWrapper, { paddingBottom: insets.bottom + 8 }]}>
      {/* Floating pill container */}
      <View style={tabStyles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = CUSTOMER_TABS[index];
          const isBook = route.name === 'Book';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          if (isBook) {
            return (
              <View key={route.key} style={tabStyles.fabSlot}>
                <TouchableOpacity
                  style={[tabStyles.fab, isFocused && tabStyles.fabActive]}
                  onPress={onPress}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="washing-machine" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={tabStyles.tabItem}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View style={[tabStyles.iconWrap, isFocused && tabStyles.iconWrapActive]}>
                <Ionicons
                  name={isFocused ? tab.iconActive : tab.icon}
                  size={21}
                  color={isFocused ? colors.primary : colors.textTertiary}
                />
              </View>
              <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    // Transparent — shows background through
    backgroundColor: 'transparent',
  },
  // The pill itself
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
    height: 68,
    paddingHorizontal: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Regular tab
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryLight,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // FAB (Book button)
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    marginTop: -16, // float above pill
  },
  fabActive: {
    backgroundColor: colors.primaryDark,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared stack header style
// ─────────────────────────────────────────────────────────────────────────────
const stackHeader = (title) => ({
  headerShown: true,
  headerTitle: title,
  headerStyle: {
    backgroundColor: colors.surface,
  },
  headerTitleStyle: {
    fontWeight: '800',
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerBackTitle: '',
  headerShadowVisible: false,
  headerTintColor: colors.primary,
  headerBackButtonMenuEnabled: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer Tabs
// ─────────────────────────────────────────────────────────────────────────────
const CustomerTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomerTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Home"          component={HomeScreen} />
    <Tab.Screen name="Orders"        component={OrdersScreen} />
    <Tab.Screen name="Book"          component={BookingScreen} />
    <Tab.Screen name="Notifications" component={NotificationsScreen} />
    <Tab.Screen name="Profile"       component={ProfileScreen} />
  </Tab.Navigator>
);

// ─────────────────────────────────────────────────────────────────────────────
// Auth Stack
// ─────────────────────────────────────────────────────────────────────────────
const AuthStack = ({ hasSeenOnboarding }) => (
  <Stack.Navigator
    screenOptions={{ headerShown: false }}
    initialRouteName={hasSeenOnboarding ? 'Login' : 'Onboarding'}
  >
    <Stack.Screen name="Onboarding"      component={OnboardingScreen} />
    <Stack.Screen name="Login"           component={LoginScreen} />
    <Stack.Screen name="Register"        component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword"  component={ForgotPasswordScreen} />
    <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
    <Stack.Screen name="ResetPassword"   component={ResetPasswordScreen} />
    <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} options={stackHeader('Terms & Conditions')} />
    <Stack.Screen name="PrivacyPolicy"   component={PrivacyPolicyScreen} options={stackHeader('Privacy Policy')} />
  </Stack.Navigator>
);

// ─────────────────────────────────────────────────────────────────────────────
// Customer Stack
// ─────────────────────────────────────────────────────────────────────────────
const CustomerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CustomerTabs"   component={CustomerTabs} />
    <Stack.Screen name="OrderDetail"    component={OrderDetailScreen}    options={{ headerShown: false }} />
    <Stack.Screen name="Tracking"       component={TrackingScreen}       options={{ headerShown: false }} />
    <Stack.Screen name="Chat"           component={ChatScreen}           options={{ headerShown: false }} />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}    options={stackHeader('Edit Profile')} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={stackHeader('Change Password')} />
    <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} options={stackHeader('Saved Addresses')} />
    <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={stackHeader('Payment Methods')} />
    <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} options={stackHeader('Terms & Conditions')} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={stackHeader('Privacy Policy')} />
    <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} options={stackHeader('Payment Success')} />
    <Stack.Screen name="PaymentCancel"  component={PaymentCancelScreen}  options={stackHeader('Payment Cancelled')} />
    <Stack.Screen name="Services"       component={ServicesScreen}        options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ─────────────────────────────────────────────────────────────────────────────
// Driver Tab Bar — matching pill style for consistency
// ─────────────────────────────────────────────────────────────────────────────
const DRIVER_TABS = [
  { name: 'Dashboard',          label: 'Dashboard',  icon: 'view-dashboard-outline', iconActive: 'view-dashboard', lib: 'mci' },
  { name: 'Deliveries',         label: 'Deliveries', icon: 'truck-outline',          iconActive: 'truck',          lib: 'mci' },
  { name: 'DriverNotifications',label: 'Alerts',     icon: 'notifications-outline',  iconActive: 'notifications',  lib: 'ion' },
  { name: 'DriverProfile',      label: 'Profile',    icon: 'person-outline',         iconActive: 'person',         lib: 'ion' },
];

function DriverTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.outerWrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={tabStyles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = DRIVER_TABS[index];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TouchableOpacity key={route.key} style={tabStyles.tabItem} onPress={onPress} activeOpacity={0.7}>
              <View style={[tabStyles.iconWrap, isFocused && tabStyles.iconWrapActive]}>
                {tab.lib === 'mci' ? (
                  <MaterialCommunityIcons
                    name={isFocused ? tab.iconActive : tab.icon}
                    size={21}
                    color={isFocused ? colors.primary : colors.textTertiary}
                  />
                ) : (
                  <Ionicons
                    name={isFocused ? tab.iconActive : tab.icon}
                    size={21}
                    color={isFocused ? colors.primary : colors.textTertiary}
                  />
                )}
              </View>
              <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const DriverTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <DriverTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Dashboard"           component={DriverDashboardScreen} />
    <Tab.Screen name="Deliveries"          component={DriverDeliveriesScreen} />
    <Tab.Screen name="DriverNotifications" component={NotificationsScreen} />
    <Tab.Screen name="DriverProfile"       component={DriverProfileScreen} />
  </Tab.Navigator>
);

// ─────────────────────────────────────────────────────────────────────────────
// Staff Tabs & Stack
// ─────────────────────────────────────────────────────────────────────────────
const STAFF_TABS = [
  { name: 'Inventory', label: 'Inventory', icon: 'package-variant-closed-minus', iconActive: 'package-variant-closed-check', lib: 'mci' },
  { name: 'StaffProfile', label: 'Profile', icon: 'person-outline', iconActive: 'person', lib: 'ion' },
];

function StaffTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.outerWrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={tabStyles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = STAFF_TABS[index];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TouchableOpacity key={route.key} style={tabStyles.tabItem} onPress={onPress} activeOpacity={0.7}>
              <View style={[tabStyles.iconWrap, isFocused && tabStyles.iconWrapActive]}>
                {tab.lib === 'mci' ? (
                  <MaterialCommunityIcons
                    name={isFocused ? tab.iconActive : tab.icon}
                    size={21}
                    color={isFocused ? colors.primary : colors.textTertiary}
                  />
                ) : (
                  <Ionicons
                    name={isFocused ? tab.iconActive : tab.icon}
                    size={21}
                    color={isFocused ? colors.primary : colors.textTertiary}
                  />
                )}
              </View>
              <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const StaffTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <StaffTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Inventory"    component={StaffInventoryScreen} />
    <Tab.Screen name="StaffProfile" component={ProfileScreen} />
  </Tab.Navigator>
);

const StaffStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="StaffTabs"     component={StaffTabs} />
    <Stack.Screen name="EditProfile"   component={EditProfileScreen}    options={stackHeader('Edit Profile')} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={stackHeader('Change Password')} />
    <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} options={stackHeader('Terms & Conditions')} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={stackHeader('Privacy Policy')} />
  </Stack.Navigator>
);

// ─────────────────────────────────────────────────────────────────────────────
// Driver Stack
// ─────────────────────────────────────────────────────────────────────────────
const DriverStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DriverTabs"     component={DriverTabs} />
    <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="EditProfile"    component={EditProfileScreen}    options={stackHeader('Edit Profile')} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={stackHeader('Change Password')} />
    <Stack.Screen name="Chat"           component={ChatScreen}           options={{ headerShown: false }} />
    <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} options={stackHeader('Terms & Conditions')} />
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={stackHeader('Privacy Policy')} />
  </Stack.Navigator>
);

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
const AppNavigator = () => {
  const { loading, isAuthenticated, hasSeenOnboarding, user } = useAuth();
  const roleModules = new Set((user?.allowedModules || []).map((item) => String(item).toLowerCase()));
  const isDriver = user?.role === 'driver' || roleModules.has('driver-delivery');
  const isStaff = user?.role === 'staff' || user?.role === 'admin';
  const requiresDriverPasswordUpdate = isAuthenticated && isDriver && Boolean(user?.mustChangePassword);

  if (loading) return <SplashScreen />;

  const linking = {
    prefixes: ['washalertmobile://'],
    config: {
      screens: {
        Customer: {
          screens: {
            PaymentSuccess: 'payment-success',
            PaymentCancel: 'payment-cancel',
            Tracking: 'tracking/:orderId',
          },
        },
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth">
            {() => <AuthStack hasSeenOnboarding={hasSeenOnboarding} />}
          </Stack.Screen>
        ) : requiresDriverPasswordUpdate ? (
          <Stack.Screen
            name="DriverFirstLoginPasswordUpdate"
            component={ChangePasswordScreen}
            initialParams={{
              forcePasswordUpdate: true,
              securityMessage: 'For your security, please create a new password before continuing.',
            }}
          />
        ) : isDriver ? (
          <Stack.Screen name="Driver" component={DriverStack} />
        ) : isStaff ? (
          <Stack.Screen name="Staff" component={StaffStack} />
        ) : (
          <Stack.Screen name="Customer" component={CustomerStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
