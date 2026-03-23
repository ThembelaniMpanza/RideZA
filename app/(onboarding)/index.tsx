import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Easing,
  StatusBar,
} from "react-native";
import {
  SplashView,
  RelaxView,
  CareView,
  MoodDiaryView,
  WelcomeView,
  TopBackSkipView,
  CenterNextButton,
} from '../../src/screens/Onboarding';
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/theme/ThemeProvider";

const IntroductionAnimationScreen: React.FC = () => {
  const window = useWindowDimensions();
  const { isDark, colors } = useTheme();

  const [currentPage, setCurrentPage] = useState(0);

  const animationController = useRef<Animated.Value>(new Animated.Value(0));
  const animValue = useRef<number>(0);

  useEffect(() => {
    animationController.current.addListener(({ value }) => {
      animValue.current = value;
      setCurrentPage(value);
    });
  }, []);

  const relaxTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [window.height, 0, 0, 0, 0],
  });

  const playAnimation = useCallback(
    (toValue: number, duration: number = 1600) => {
      Animated.timing(animationController.current, {
        toValue,
        duration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
        // here it is false only cause of width animation in 'NextButtonArrow.tsx', as width doesn't support useNativeDriver: true
        // TODO:- find better solution so we can use true here and animation also work
        useNativeDriver: false,
      }).start();
    },
    [],
  );

  const onNextClick = useCallback(async () => {
    let toValue;
    if (animValue.current === 0) {
      toValue = 0.2;
    } else if (animValue.current >= 0 && animValue.current <= 0.2) {
      toValue = 0.4;
    } else if (animValue.current > 0.2 && animValue.current <= 0.4) {
      toValue = 0.6;
    } else if (animValue.current > 0.4 && animValue.current <= 0.6) {
      toValue = 0.8;
    } else if (animValue.current > 0.6 && animValue.current <= 0.8) {
      await AsyncStorage.setItem("hasOnboarded", "true");
      router.replace("/(auth)/signup");
      return;
    }

    toValue !== undefined && playAnimation(toValue);
  }, [playAnimation]);

  const onBackClick = useCallback(() => {
    let toValue;
    if (animValue.current >= 0.2 && animValue.current < 0.4) {
      toValue = 0.0;
    } else if (animValue.current >= 0.4 && animValue.current < 0.6) {
      toValue = 0.2;
    } else if (animValue.current >= 0.6 && animValue.current < 0.8) {
      toValue = 0.4;
    } else if (animValue.current === 0.8) {
      toValue = 0.6;
    }

    toValue !== undefined && playAnimation(toValue);
  }, [playAnimation]);

  const onSkipClick = useCallback(() => {
    playAnimation(0.8, 1200);
  }, [playAnimation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SplashView {...{ onNextClick, animationController }} />

      <Animated.View
        style={[
          styles.scenesContainer,
          { transform: [{ translateY: relaxTranslateY }] },
        ]}
      >
        <RelaxView {...{ animationController }} />

        <CareView {...{ animationController }} />

        <MoodDiaryView {...{ animationController }} />

        <WelcomeView {...{ animationController }} />
      </Animated.View>

      <TopBackSkipView {...{ onBackClick, onSkipClick, animationController }} />

      <CenterNextButton
        {...{ onNextClick, animationController }}
        onLoginClick={() => router.push("/(auth)/login")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scenesContainer: {
    justifyContent: 'center',
    ...StyleSheet.absoluteFillObject,
  },
});

export default IntroductionAnimationScreen;
