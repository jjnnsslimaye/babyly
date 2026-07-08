export default {
  expo: {
    name: "babyly",
    slug: "babyly",
    owner: "jnlimaye",
    version: "1.0.0",
    scheme: "babyly",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.jnlimaye.babyly",
      infoPlist: {
        NSCameraUsageDescription: "Babyly needs camera access to take your profile photo.",
        NSPhotoLibraryUsageDescription: "Babyly needs photo library access to choose your profile photo.",
        NSLocationWhenInUseUsageDescription: "Babyly uses your location to show you listings nearby.",
      }
    },
    android: {
      package: "com.jnlimaye.babyly",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: "resize",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      eas: {
        projectId: "f9e2cd20-6254-4281-b3a0-c375e3f0341a"
      }
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-video",
      "expo-image-picker",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ],
      "expo-file-system",
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Babyly uses your location to show you listings nearby."
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.1006472179706-tusrmoeodg4apvb6s65id3a1k6mulvmt"
        }
      ],
      "expo-apple-authentication"
    ] 
  }
};