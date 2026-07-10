/* eslint-disable @typescript-eslint/no-require-imports -- Jest: require() em fábricas jest.mock e em re-require tardio (não convertível para import) */
import type React from 'react';

describe('NetworkProvider', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('renders children even when the NetInfo native module is unavailable', () => {
    jest.doMock('@react-native-community/netinfo', () => {
      throw new Error('NativeModule.RNCNetInfo is null');
    });

    jest.doMock('react-native-safe-area-context', () => ({
      useSafeAreaInsets: () => ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }),
    }));

    jest.doMock('../components/ui/Icon', () => ({
      Icon: () => null,
    }));

    jest.doMock('../lib/logger', () => ({
      logger: {
        warn: jest.fn(),
      },
    }));

    let NetworkProvider: React.ComponentType<{ children: React.ReactNode }> | undefined;
    let useNetwork: (() => { isConnected: boolean }) | undefined;

    expect(() => {
      ({ NetworkProvider, useNetwork } = require('../context/NetworkContext'));
    }).not.toThrow();
    expect(typeof NetworkProvider).toBe('function');
    expect(typeof useNetwork).toBe('function');
  });

  it('does not require the NetInfo package when the native module is absent', () => {
    let netInfoRequired = false;

    jest.doMock('@react-native-community/netinfo', () => {
      netInfoRequired = true;
      throw new Error('NativeModule.RNCNetInfo is null');
    });

    jest.doMock('react-native-safe-area-context', () => ({
      useSafeAreaInsets: () => ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      }),
    }));

    jest.doMock('../components/ui/Icon', () => ({
      Icon: () => null,
    }));

    jest.doMock('../lib/logger', () => ({
      logger: {
        warn: jest.fn(),
      },
    }));

    const ReactNative = require('react-native');
    const originalNetInfoModule = ReactNative.NativeModules.RNCNetInfo;
    delete ReactNative.NativeModules.RNCNetInfo;

    const { getNetInfo } = require('../context/NetworkContext');

    expect(getNetInfo()).toBeNull();

    ReactNative.NativeModules.RNCNetInfo = originalNetInfoModule;

    expect(netInfoRequired).toBe(false);
  });
});
