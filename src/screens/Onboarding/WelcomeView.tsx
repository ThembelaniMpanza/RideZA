import React, { useRef } from 'react';
import { StyleSheet, Text, Animated, useWindowDimensions } from 'react-native';
import { AppImages } from '../../../assets';
import { useTheme } from '../../theme/ThemeProvider';

interface Props {
  animationController: React.RefObject<Animated.Value>;
}

const IMAGE_WIDTH = 350;
const IMAGE_HEIGHT = 350;

const WelcomeView: React.FC<Props> = ({ animationController }) => {
  const window = useWindowDimensions();
  const { colors } = useTheme();

  const careRef = useRef<Text | null>(null);

  const slideAnim = animationController.current.interpolate({
    inputRange: [0, 0.6, 0.8],
    outputRange: [window.width, window.width, 0],
  });

  const textEndVal = 26 * 2; // 26 being text's height (font size)
  const welcomeTextAnim = animationController.current.interpolate({
    inputRange: [0, 0.6, 0.8],
    outputRange: [textEndVal, textEndVal, 0],
  });

  const imageEndVal = IMAGE_WIDTH * 4;
  const imageAnim = animationController.current.interpolate({
    inputRange: [0, 0.6, 0.8],
    outputRange: [imageEndVal, imageEndVal, 0],
  });

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: slideAnim }] }]}
    >
      <Animated.Image
        style={[styles.image, { transform: [{ translateX: imageAnim }] }]}
        source={AppImages.welcome}
      />
      <Animated.Text
        style={[
          styles.title,
          { color: colors.text, transform: [{ translateX: welcomeTextAnim }] },
        ]}
        ref={careRef}
      >
        Welcome
      </Animated.Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        We’re excited to have you here.{'\n'}
        Book a ride in seconds, track your driver in real time, and travel with confidence.{'\n'}{'\n'}
        Where are we going today?
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 100,
  },
  image: {
    maxWidth: IMAGE_WIDTH,
    maxHeight: IMAGE_HEIGHT,
  },
  title: {
    color: 'black',
    fontSize: 26,
    textAlign: 'center',
    fontFamily: 'WorkSans-Bold',
  },
  subtitle: {
    color: 'black',
    textAlign: 'center',
    fontFamily: 'WorkSans-Regular',
    paddingHorizontal: 64,
    paddingVertical: 16,
  },
});

export default WelcomeView;
