import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
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
import PaymentSuccessScreen from '../screens/customer/PaymentSuccessScreen';
import PaymentCancelScreen from '../screens/customer/PaymentCancelScreen';

// Driver Screens
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import DriverDeliveriesScreen from '../screens/driver/DriverDeliveriesScreen';
import DeliveryDetailScreen from '../screens/driver/DeliveryDetailScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};

const CustomerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 60,
        },
        headerStyle: {
          backgroundColor: colors.cardBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.text,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="history" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Book"
        component={BookingScreen}
        options={{
          title: 'Book',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="plus-circle" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const CustomerStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          headerShown: true,
          headerTitle: 'Order Details',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
        options={{
          headerShown: true,
          headerTitle: 'Track Order',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          headerTitle: 'IkotAsk',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: true,
          headerTitle: 'Edit Profile',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{
          headerShown: true,
          headerTitle: 'Payment Success',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
        }}
      />
      <Stack.Screen
        name="PaymentCancel"
        component={PaymentCancelScreen}
        options={{
          headerShown: true,
          headerTitle: 'Payment Cancelled',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
        }}
      />
    </Stack.Navigator>
  );
};

const DriverTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 60,
        },
        headerStyle: {
          backgroundColor: colors.cardBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.text,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DriverDashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="speedometer" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Deliveries"
        component={DriverDeliveriesScreen}
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="truck" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverNotifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const DriverStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen
        name="DeliveryDetail"
        component={DeliveryDetailScreen}
        options={{
          headerShown: true,
          headerTitle: 'Delivery Details',
          headerStyle: {
            backgroundColor: colors.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: colors.text,
          },
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { loading, isAuthenticated, user } = useAuth();
  const roleModules = new Set((user?.allowedModules || []).map((item) => String(item).toLowerCase()));
  const isDriver = user?.role === 'driver' || roleModules.has('driver-delivery');

  // Show a loading/splash while checking auth state
  if (loading) {
    return <SplashScreen />;
  }

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
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : isDriver ? (
          <Stack.Screen name="Driver" component={DriverStack} />
        ) : (
          <Stack.Screen name="Customer" component={CustomerStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
