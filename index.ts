import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

// Suppress the yellow box warning for SafeAreaView to make the app look clean
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
LogBox.ignoreAllLogs();

// Polyfill for crypto.getRandomValues to prevent crypto-js from crashing in React Native
if (typeof global.crypto !== 'object') {
  (global as any).crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function (array: Uint8Array | Uint32Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
